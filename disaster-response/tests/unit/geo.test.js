'use strict';

const { haversineKm, toGeoJSONPoint, fromGeoJSONPoint, clampRadiusKm } = require('../../lib/server/utils/geo');

describe('geo utils', () => {
  test('haversine distance NYC → LA is ~3936 km', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const la  = { latitude: 34.0522, longitude: -118.2437 };
    const km = haversineKm(nyc, la);
    expect(km).toBeGreaterThan(3900);
    expect(km).toBeLessThan(4000);
  });

  test('toGeoJSONPoint stores [lng, lat]', () => {
    const p = toGeoJSONPoint(40.7128, -74.006);
    expect(p.type).toBe('Point');
    expect(p.coordinates).toEqual([-74.006, 40.7128]);
  });

  test('fromGeoJSONPoint inverses toGeoJSONPoint', () => {
    const p = toGeoJSONPoint(34.0522, -118.2437);
    expect(fromGeoJSONPoint(p)).toEqual({ latitude: 34.0522, longitude: -118.2437 });
  });

  test('clampRadiusKm bounds the radius', () => {
    expect(clampRadiusKm(0)).toBeGreaterThan(0);
    expect(clampRadiusKm(500)).toBeLessThanOrEqual(200);
    expect(clampRadiusKm('abc')).toBe(10);
  });
});
