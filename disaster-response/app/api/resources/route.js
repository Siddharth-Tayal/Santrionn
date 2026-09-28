import mongoose from 'mongoose';
import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { listResourcesQuery } from '@/lib/server/validation/resource.schema';
import Resource from '@/lib/server/models/Resource';
import { GEO } from '@/lib/server/constants';
import { fromGeoJSONPoint, haversineKm, clampRadiusKm } from '@/lib/server/utils/geo';
import { parsePagination, buildMeta } from '@/lib/server/utils/pagination';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shape(r, origin) {
  const p = fromGeoJSONPoint(r.location?.point);
  const doc = {
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
  };
  if (origin && p) doc.distanceKm = Number(haversineKm(origin, p).toFixed(3));
  return doc;
}

export const GET = withHandler(
  withValidation({ query: listResourcesQuery })(async ({ query }) => {
    const { type, lat, lng, radius, page, limit } = query;
    const { skip, limit: perPage, page: currentPage } = parsePagination({ page, limit });

    if (lat !== undefined && lng !== undefined) {
      const radiusKm = clampRadiusKm(radius);
      const origin = { latitude: lat, longitude: lng };
      const filter = {
        'location.point': mongoose.trusted({
          $geoWithin: { $centerSphere: [[lng, lat], radiusKm / GEO.EARTH_RADIUS_KM] },
        }),
      };
      if (type) filter.type = type;
      const rows = await Resource.find(filter).limit(100).lean({ virtuals: false });
      const data = rows
        .map((r) => shape(r, origin))
        .filter((r) => r.distanceKm !== null && r.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, perPage);
      return {
        data,
        meta: buildMeta({ total: data.length, limit: perPage, page: 1 }, { radiusKm, origin, mode: 'geo' }),
      };
    }

    const filter = type ? { type } : {};
    const [rows, total] = await Promise.all([
      Resource.find(filter).sort({ name: 1 }).skip(skip).limit(perPage).lean({ virtuals: false }),
      Resource.countDocuments(filter),
    ]);
    return {
      data: rows.map((r) => shape(r)),
      meta: buildMeta({ total, limit: perPage, page: currentPage }, { mode: 'list' }),
    };
  })
);
