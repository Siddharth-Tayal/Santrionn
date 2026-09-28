'use strict';

const { TTLCache } = require('../../lib/server/services/cache');

describe('TTLCache', () => {
  test('returns undefined after TTL', () => {
    const c = new TTLCache({ defaultTtlMs: 20 });
    c.set('k', 1);
    expect(c.get('k')).toBe(1);
    return new Promise((r) => setTimeout(() => {
      expect(c.get('k')).toBeUndefined();
      r();
    }, 30));
  });

  test('LRU eviction beyond max', () => {
    const c = new TTLCache({ maxEntries: 3, defaultTtlMs: 10_000 });
    c.set('a', 1); c.set('b', 2); c.set('c', 3);
    c.get('a'); // refresh a
    c.set('d', 4);
    expect(c.get('b')).toBeUndefined(); // b was oldest
    expect(c.get('a')).toBe(1);
  });

  test('singleflight coalesces concurrent misses', async () => {
    const c = new TTLCache({ defaultTtlMs: 500 });
    let calls = 0;
    const loader = () => new Promise((r) => setTimeout(() => { calls += 1; r('value-' + calls); }, 30));
    const [a, b, d] = await Promise.all([
      c.singleflight('key', loader),
      c.singleflight('key', loader),
      c.singleflight('key', loader),
    ]);
    expect(calls).toBe(1);
    expect(a.value).toBe('value-1');
    expect(b.value).toBe('value-1');
    expect(d.value).toBe('value-1');
    expect(a.hit).toBe(false);
    expect(b.hit === 'coalesced' || b.hit === false).toBe(true);
  });
});
