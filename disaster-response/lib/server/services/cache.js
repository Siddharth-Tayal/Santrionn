'use strict';

const config = require('../config/env');

/**
 * In-process TTL/LRU cache with single-flight.
 *
 * Single-flight: N concurrent misses on the same key run ONE loader and share
 * its result. The classic thundering-herd fix without a job queue.
 */
class TTLCache {
  constructor({ maxEntries, defaultTtlMs } = {}) {
    this.max = maxEntries || config.CACHE_MAX_ENTRIES;
    this.defaultTtl = defaultTtlMs || config.CACHE_TTL_SECONDS * 1000;
    this.map = new Map();
    this.inflight = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU position.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtl);
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    if (this.map.size > this.max) {
      // Delete oldest.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  delete(key) { this.map.delete(key); this.inflight.delete(key); }
  clear() { this.map.clear(); this.inflight.clear(); }
  size() { return this.map.size; }

  async singleflight(key, loader, ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return { value: cached, hit: true };

    if (this.inflight.has(key)) {
      const value = await this.inflight.get(key);
      return { value, hit: 'coalesced' };
    }

    const promise = Promise.resolve().then(() => loader()).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    const value = await promise;
    if (value !== undefined) this.set(key, value, ttlMs);
    return { value, hit: false };
  }
}

const shared = new TTLCache();

module.exports = { TTLCache, cache: shared };
