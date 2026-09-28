'use strict';

const { GEO } = require('../constants');

const RAD = Math.PI / 180;

/** GeoJSON is [lng, lat]. Named parameters make it hard to swap by accident. */
function toGeoJSONPoint(latitude, longitude) {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

function fromGeoJSONPoint(point) {
  if (!point || !Array.isArray(point.coordinates)) return null;
  const [lng, lat] = point.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { latitude: lat, longitude: lng };
}

/** Great-circle distance in kilometres. */
function haversineKm(a, b) {
  const dLat = (b.latitude - a.latitude) * RAD;
  const dLng = (b.longitude - a.longitude) * RAD;
  const lat1 = a.latitude * RAD;
  const lat2 = b.latitude * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * GEO.EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clampRadiusKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return GEO.DEFAULT_RADIUS_KM;
  return Math.min(GEO.MAX_RADIUS_KM, Math.max(GEO.MIN_RADIUS_KM, n));
}

module.exports = { toGeoJSONPoint, fromGeoJSONPoint, haversineKm, clampRadiusKm };
