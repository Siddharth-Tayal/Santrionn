'use strict';

const config = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Sliding window rate limiter, in-process. Three buckets, one map per bucket.
 * State does not survive a restart — that is fine for this deployment scope.
 * Redis-backed would be a swap in this file only.
 */
const BUCKETS = {
  read:  { max: config.RATE_LIMIT_MAX, window: config.RATE_LIMIT_WINDOW_MS, store: new Map() },
  write: { max: config.WRITE_RATE_LIMIT_MAX, window: config.RATE_LIMIT_WINDOW_MS, store: new Map() },
  auth:  { max: config.AUTH_RATE_LIMIT_MAX, window: config.RATE_LIMIT_WINDOW_MS, store: new Map() },
};

function checkRateLimit(bucketName, ip) {
  const bucket = BUCKETS[bucketName] || BUCKETS.read;
  const now = Date.now();
  const list = bucket.store.get(ip) || [];
  const cutoff = now - bucket.window;
  const recent = list.filter((ts) => ts > cutoff);

  if (recent.length >= bucket.max) {
    throw AppError.rateLimited(`Too many requests in bucket "${bucketName}"`);
  }

  recent.push(now);
  bucket.store.set(ip, recent);

  // Cheap GC — every ~100 requests per bucket, drop empties.
  if (bucket.store.size > 1000 && Math.random() < 0.01) {
    for (const [k, v] of bucket.store) {
      const kept = v.filter((ts) => ts > cutoff);
      if (kept.length) bucket.store.set(k, kept);
      else bucket.store.delete(k);
    }
  }
}

function resetRateLimits() {
  Object.values(BUCKETS).forEach((b) => b.store.clear());
}

module.exports = { checkRateLimit, resetRateLimits };
