'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { toObjectId } = require('../utils/ids');
const { toGeoJSONPoint, fromGeoJSONPoint, haversineKm, clampRadiusKm } = require('../utils/geo');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { EVENTS, GEO } = require('../constants');
const { resolveLocation } = require('./geocoding');
const { publish } = require('./events');
const { invalidateDisasterReports } = require('./reports');
// Register User too — populate('createdBy') resolves the model by name at
// query time, so the model must have been loaded at least once.
require('../models/User');
const Disaster = require('../models/Disaster');
const Resource = require('../models/Resource');

const AUTHOR_PROJECTION = { username: 1, displayName: 1, role: 1 };

function shape(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  if (obj.location?.point) {
    const p = fromGeoJSONPoint(obj.location.point);
    if (p) { obj.location.latitude = p.latitude; obj.location.longitude = p.longitude; }
  }
  if (obj.location) delete obj.location.point;

  if (obj.createdBy && typeof obj.createdBy === 'object' && obj.createdBy._id) {
    const author = obj.createdBy;
    obj.createdBy = String(author._id);
    obj.createdByUser = {
      username: author.username,
      displayName: author.displayName ?? null,
      role: author.role,
    };
  }
  return obj;
}

async function buildLocation(providedLocation, description) {
  if (providedLocation && providedLocation.latitude != null && providedLocation.longitude != null) {
    return {
      label: null,
      query: null,
      source: 'provided',
      provider: null,
      point: toGeoJSONPoint(providedLocation.latitude, providedLocation.longitude),
    };
  }
  return resolveLocation(description || '');
}

async function listDisasters({ status, tag, q, sort, page, limit }) {
  const { skip, limit: perPage, page: currentPage } = parsePagination({ page, limit });

  const filter = {};
  if (status) filter.status = status;
  if (tag) filter.tags = String(tag).trim().toLowerCase();
  if (q) filter.$text = mongoose.trusted({ $search: q });

  const sortSpec =
    sort === 'oldest' ? { createdAt: 1 } :
    sort === 'status' ? { status: 1, createdAt: -1 } :
    { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Disaster.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(perPage)
      .populate('createdBy', AUTHOR_PROJECTION)
      .lean({ virtuals: false }),
    Disaster.countDocuments(filter),
  ]);

  return {
    data: docs.map(shape),
    meta: buildMeta(
      { total, limit: perPage, page: currentPage },
      { filters: { status: status ?? null, tag: tag ?? null, q: q ?? null, sort } }
    ),
  };
}

async function getDisaster(id) {
  const _id = toObjectId(id, 'disaster id');
  const doc = await Disaster.findById(_id).populate('createdBy', AUTHOR_PROJECTION);
  if (!doc) throw AppError.notFound(`No disaster found with id ${id}`);
  return shape(doc);
}

async function createDisaster({ title, description, tags, status, location }, user) {
  const built = await buildLocation(location, description);
  const doc = await Disaster.create({
    title, description,
    tags: tags ?? [],
    status: status || 'active',
    location: built,
    createdBy: user.userId,
  });
  await doc.populate('createdBy', AUTHOR_PROJECTION);
  const payload = shape(doc);
  publish(EVENTS.DISASTER_CREATED, { disaster: payload });
  return payload;
}

async function updateDisaster(id, patch, user) {
  const _id = toObjectId(id, 'disaster id');
  const existing = await Disaster.findById(_id);
  if (!existing) throw AppError.notFound(`No disaster found with id ${id}`);

  // Business rule: reopening a resolved incident is admin-only.
  if (patch.status === 'active' && existing.status === 'resolved' && user.role !== 'admin') {
    throw AppError.forbidden('Only an admin can reopen a resolved incident');
  }

  const update = {};
  const changed = [];
  for (const key of ['title', 'description', 'tags', 'status']) {
    if (patch[key] !== undefined && String(patch[key]) !== String(existing[key])) {
      update[key] = patch[key];
      changed.push(key);
    }
  }
  if (patch.location) {
    update.location = await buildLocation(patch.location, patch.description ?? existing.description);
    changed.push('location');
  } else if (patch.description && patch.description !== existing.description) {
    // If description changed and no explicit location was given, re-resolve.
    update.location = await resolveLocation(patch.description);
    changed.push('location');
  }

  if (!Object.keys(update).length) return shape(existing);

  const doc = await Disaster.findByIdAndUpdate(_id, update, { new: true, runValidators: true })
    .populate('createdBy', AUTHOR_PROJECTION);
  const payload = shape(doc);
  publish(EVENTS.DISASTER_UPDATED, { changed, disaster: payload });
  return payload;
}

async function deleteDisaster(id) {
  const _id = toObjectId(id, 'disaster id');
  const doc = await Disaster.findByIdAndDelete(_id);
  if (!doc) throw AppError.notFound(`No disaster found with id ${id}`);
  await invalidateDisasterReports(String(_id));
  publish(EVENTS.DISASTER_DELETED, { id: String(_id) });
  return { id: String(_id) };
}

async function nearbyResources(disasterId, { lat, lng, radius, type }) {
  const _id = toObjectId(disasterId, 'disaster id');
  const disaster = await Disaster.findById(_id);
  if (!disaster) throw AppError.notFound(`No disaster found with id ${disasterId}`);

  let originLat = lat;
  let originLng = lng;
  let originSource = 'query';

  if (originLat === undefined || originLng === undefined) {
    const point = fromGeoJSONPoint(disaster.location?.point);
    if (!point) {
      throw AppError.badRequest(
        'This incident has no resolved coordinates. Provide lat and lng in the query string.'
      );
    }
    originLat = point.latitude;
    originLng = point.longitude;
    originSource = disaster.location?.source || 'resolved';
  }

  const radiusKm = clampRadiusKm(radius);
  const radiusInRadians = radiusKm / GEO.EARTH_RADIUS_KM;

  const filter = {
    'location.point': mongoose.trusted({
      $geoWithin: { $centerSphere: [[originLng, originLat], radiusInRadians] },
    }),
  };
  if (type) filter.type = type;

  const rows = await Resource.find(filter).limit(100).lean({ virtuals: false });
  const origin = { latitude: originLat, longitude: originLng };

  const data = rows
    .map((r) => {
      const p = fromGeoJSONPoint(r.location?.point);
      return {
        id: String(r._id),
        name: r.name,
        type: r.type,
        capacity: r.capacity ?? null,
        notes: r.notes ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        location: {
          label: r.location?.label ?? null,
          source: r.location?.source ?? 'provided',
          provider: r.location?.provider ?? null,
          ...p,
        },
        distanceKm: p ? Number(haversineKm(origin, p).toFixed(3)) : null,
      };
    })
    .filter((r) => r.distanceKm !== null && r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    data,
    meta: {
      origin: { latitude: originLat, longitude: originLng, source: originSource },
      radiusKm,
      count: data.length,
      disasterId: String(_id),
    },
  };
}

module.exports = {
  listDisasters, getDisaster, createDisaster, updateDisaster, deleteDisaster,
  nearbyResources, buildLocation, shape,
};
