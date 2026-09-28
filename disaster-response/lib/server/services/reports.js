'use strict';

const config = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { cache } = require('./cache');
const Report = require('../models/Report');
const { fetchReports } = require('../integrations/mockSocial');

const L1_TTL_MS = 60 * 1000;
const STALE_MS = Math.floor((config.REPORTS_TTL_SECONDS * 1000) / 3);

/**
 * Two-layer cache read for community reports.
 * Flow follows Assignment §5 exactly:
 *   L1 hit          → return
 *   L1 miss + L2 fresh → return, warm L1
 *   L1 miss + L2 stale → refetch, upsert, return, warm L1
 *   L1 miss + provider down + L2 non-empty → return stale with degraded flag
 *   L1 miss + provider down + L2 empty     → 502
 */
async function getReportsForDisaster(disaster, { limit = 20 } = {}) {
  const disasterId = String(disaster._id || disaster.id);
  const cacheKey = `reports:${disasterId}:${limit}`;

  const { value, hit } = await cache.singleflight(
    cacheKey,
    async () => loadReports(disaster, limit),
    L1_TTL_MS
  );

  return { ...value, l1Hit: hit === true, coalesced: hit === 'coalesced' };
}

async function loadReports(disaster, limit) {
  const disasterId = String(disaster._id || disaster.id);
  const existing = await Report.find({ disaster: disasterId })
    .sort({ priority: -1, externalCreatedAt: -1 })
    .limit(limit)
    .lean({ virtuals: false });

  const newest = existing[0]?.fetchedAt ? new Date(existing[0].fetchedAt).getTime() : 0;
  const stale = !existing.length || Date.now() - newest > STALE_MS;

  if (!stale) {
    return {
      data: existing.map(shape),
      meta: {
        total: existing.length,
        provider: 'mock-social',
        freshness: 'db-cache',
        degraded: false,
      },
    };
  }

  try {
    const external = await fetchReports(disaster, { timeout: config.SOCIAL_API_TIMEOUT_MS });
    if (Array.isArray(external) && external.length) {
      const now = new Date();
      await Report.bulkWrite(
        external.map((entry) => ({
          updateOne: {
            filter: { disaster: disasterId, externalId: entry.externalId },
            update: {
              $set: {
                source: 'mock-social',
                content: entry.content,
                author: entry.author,
                priority: entry.priority,
                externalCreatedAt: entry.externalCreatedAt,
                fetchedAt: now,
              },
              $setOnInsert: { disaster: disasterId, externalId: entry.externalId },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }

    const fresh = await Report.find({ disaster: disasterId })
      .sort({ priority: -1, externalCreatedAt: -1 })
      .limit(limit)
      .lean({ virtuals: false });

    return {
      data: fresh.map(shape),
      meta: {
        total: fresh.length,
        provider: 'mock-social',
        freshness: 'network',
        degraded: false,
      },
    };
  } catch (err) {
    logger.warn('reports provider failed', { disasterId, message: err.message });
    if (existing.length) {
      return {
        data: existing.map(shape),
        meta: {
          total: existing.length,
          provider: 'mock-social',
          freshness: 'stale-fallback',
          degraded: true,
          reason: err.message,
        },
      };
    }
    throw AppError.badGateway('Reports provider is unavailable and no cache is available');
  }
}

function shape(row) {
  return {
    id: String(row._id),
    disaster: String(row.disaster),
    externalId: row.externalId,
    source: row.source,
    content: row.content,
    author: row.author,
    priority: row.priority,
    externalCreatedAt: row.externalCreatedAt,
    fetchedAt: row.fetchedAt,
  };
}

async function invalidateDisasterReports(disasterId) {
  await Report.deleteMany({ disaster: String(disasterId) });
  // Invalidate any L1 keys for this disaster.
  for (let limit = 1; limit <= 100; limit++) cache.delete(`reports:${disasterId}:${limit}`);
}

module.exports = { getReportsForDisaster, invalidateDisasterReports };
