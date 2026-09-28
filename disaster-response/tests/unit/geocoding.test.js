'use strict';

const { resolveLocation, parseCoordinatePair, matchGazetteer } = require('../../lib/server/services/geocoding');

describe('geocoding service', () => {
  test('gazetteer resolves "Manhattan, NYC" to a location', async () => {
    const loc = await resolveLocation('Heavy flooding has affected Manhattan, NYC.');
    expect(loc.source).toBe('resolved');
    expect(loc.provider).toBe('gazetteer');
    expect(loc.point.coordinates[0]).toBeCloseTo(-74.006, 1);
    expect(loc.point.coordinates[1]).toBeCloseTo(40.7128, 1);
  });

  test('coordinate-pair fast path beats gazetteer', async () => {
    const loc = await resolveLocation('Storm reported at 12.9716, 77.5946');
    expect(loc.source).toBe('resolved');
    expect(loc.provider).toBe('coordinate-pair');
    expect(loc.point.coordinates).toEqual([77.5946, 12.9716]);
  });

  test('returns unresolved for text with no recognisable place', async () => {
    const loc = await resolveLocation('An event happened somewhere unspecified.');
    expect(loc.source).toBe('unresolved');
    expect(loc.point).toBeUndefined();
  });

  test('matchGazetteer prefers longest match', () => {
    const m = matchGazetteer('flooding across new york city');
    expect(m.key).toBe('manhattan');
    expect(m.entry.label).toContain('Manhattan');
  });

  test('parseCoordinatePair reads decimals', () => {
    expect(parseCoordinatePair('at 40.7128, -74.006 tonight')).not.toBeNull();
    expect(parseCoordinatePair('no numbers here')).toBeNull();
  });
});
