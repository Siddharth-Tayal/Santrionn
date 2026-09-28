'use strict';

const config = require('../config/env');
const logger = require('../utils/logger');
const { toGeoJSONPoint } = require('../utils/geo');
const { cache } = require('./cache');

/**
 * Offline gazetteer — real coordinates so seeded and user-created data
 * exercises the same location model. Aliases are the ways a person writes it.
 */
const GAZETTEER = {
  manhattan:      { label: 'Manhattan, New York City',   lat: 40.7128, lng: -74.006,  aliases: ['new york city', 'nyc', 'new york', 'midtown', 'lower manhattan'] },
  brooklyn:       { label: 'Brooklyn, New York City',    lat: 40.6782, lng: -73.9442, aliases: ['williamsburg', 'dumbo', 'red hook', 'coney island'] },
  queens:         { label: 'Queens, New York City',      lat: 40.7282, lng: -73.7949, aliases: ['astoria', 'flushing'] },
  bronx:          { label: 'The Bronx, New York City',   lat: 40.8448, lng: -73.8648, aliases: ['the bronx'] },
  newark:         { label: 'Newark, New Jersey',         lat: 40.7357, lng: -74.1724, aliases: ['newark, nj'] },
  yonkers:        { label: 'Yonkers, New York',          lat: 40.9312, lng: -73.8988, aliases: [] },
  stamford:       { label: 'Stamford, Connecticut',      lat: 41.0534, lng: -73.5387, aliases: [] },
  'washington dc':{ label: 'Washington, DC',             lat: 38.9072, lng: -77.0369, aliases: ['washington', 'dc', 'capitol hill', 'anacostia', 'georgetown'] },
  boston:         { label: 'Boston, Massachusetts',      lat: 42.3601, lng: -71.0589, aliases: ['boston, ma', 'back bay', 'cambridge'] },
  miami:          { label: 'Miami, Florida',             lat: 25.7617, lng: -80.1918, aliases: ['miami beach', 'little havana', 'miami, fl'] },
  'new orleans':  { label: 'New Orleans, Louisiana',     lat: 29.9511, lng: -90.0715, aliases: ['nola', 'french quarter', 'the french quarter'] },
  'los angeles':  { label: 'Los Angeles, California',    lat: 34.0522, lng: -118.2437, aliases: ['la', 'hollywood', 'downtown la', 'griffith park'] },
  'san francisco':{ label: 'San Francisco, California',  lat: 37.7749, lng: -122.4194, aliases: ['sf', 'mission district', 'fishermans wharf'] },
  chicago:        { label: 'Chicago, Illinois',          lat: 41.8781, lng: -87.6298, aliases: ['the loop'] },
  mumbai:         { label: 'Mumbai, Maharashtra',        lat: 19.076,  lng: 72.8777,  aliases: ['bombay', 'chembur', 'dadar', 'kurla'] },
  delhi:          { label: 'Delhi, India',               lat: 28.6139, lng: 77.209,   aliases: ['new delhi', 'ncr'] },
  kathmandu:      { label: 'Kathmandu, Nepal',           lat: 27.7172, lng: 85.324,   aliases: ['kathmandu valley'] },
  jakarta:        { label: 'Jakarta, Indonesia',         lat: -6.2088, lng: 106.8456, aliases: [] },
  manila:         { label: 'Manila, Philippines',        lat: 14.5995, lng: 120.9842, aliases: ['metro manila'] },
  sydney:         { label: 'Sydney, New South Wales',    lat: -33.8688,lng: 151.2093, aliases: [] },
  london:         { label: 'London, United Kingdom',     lat: 51.5074, lng: -0.1278,  aliases: [] },
  tokyo:          { label: 'Tokyo, Japan',               lat: 35.6762, lng: 139.6503, aliases: [] },
  istanbul:       { label: 'Istanbul, Turkey',           lat: 41.0082, lng: 28.9784,  aliases: [] },
  'cape town':    { label: 'Cape Town, South Africa',    lat: -33.9249,lng: 18.4241,  aliases: [] },
  nairobi:        { label: 'Nairobi, Kenya',             lat: -1.2921, lng: 36.8219,  aliases: [] },
  'mexico city':  { label: 'Mexico City, Mexico',        lat: 19.4326, lng: -99.1332, aliases: ['cdmx'] },
  toronto:        { label: 'Toronto, Ontario',           lat: 43.6532, lng: -79.3832, aliases: [] },
  vancouver:      { label: 'Vancouver, British Columbia',lat: 49.2827, lng: -123.1207,aliases: [] },
};

const COORD_PAIR = /(-?\d{1,2}(?:\.\d+)?)\s*[,/]\s*(-?\d{1,3}(?:\.\d+)?)/;

function parseCoordinatePair(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(COORD_PAIR);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Wider range disambiguates order: |lat| <= 90, |lng| <= 180.
  const [lat, lng] = Math.abs(b) > 90 ? [a, b] : [a, b];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function wordBoundaryHit(text, phrase) {
  // Only match on token boundaries so "la" does not fire inside "landslide".
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}([^a-z0-9]|$)`, 'i');
  return re.test(text);
}

function matchGazetteer(text) {
  if (typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  // Longest match first so "new york city" beats "new york".
  const collected = [];
  for (const [key, entry] of Object.entries(GAZETTEER)) {
    collected.push({ key, hit: key, entry, len: key.length });
    for (const alias of entry.aliases) collected.push({ key, hit: alias, entry, len: alias.length });
  }
  collected.sort((a, b) => b.len - a.len);
  for (const c of collected) {
    if (wordBoundaryHit(lower, c.hit)) return { key: c.key, hit: c.hit, entry: c.entry };
  }
  return null;
}

async function nominatimLookup(query) {
  const url = `${config.GEOCODER_BASE_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.GEOCODER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': config.GEOCODER_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const r = rows[0];
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: r.display_name || query, provider: 'nominatim' };
  } catch (err) {
    logger.warn('nominatim lookup failed', { message: err.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a description to a location record.
 * Return shape matches the Disaster.location subschema.
 */
async function resolveLocation(description) {
  const cacheKey = `geo:${String(description || '').slice(0, 200)}`;
  const { value } = await cache.singleflight(cacheKey, async () => {
    // 1. Coordinate-pair fast path.
    const pair = parseCoordinatePair(description);
    if (pair) {
      return {
        label: pair.label, query: pair.label, source: 'resolved',
        provider: 'coordinate-pair', point: toGeoJSONPoint(pair.lat, pair.lng),
      };
    }
    // 2. Gazetteer.
    const g = matchGazetteer(description);
    if (g) {
      return {
        label: g.entry.label, query: g.hit, source: 'resolved',
        provider: 'gazetteer', point: toGeoJSONPoint(g.entry.lat, g.entry.lng),
      };
    }
    // 3. Optional Nominatim.
    if (config.GEOCODER_PROVIDER === 'nominatim') {
      const n = await nominatimLookup(description);
      if (n) {
        return {
          label: n.label, query: description, source: 'resolved',
          provider: 'nominatim', point: toGeoJSONPoint(n.lat, n.lng),
        };
      }
    }
    return { label: null, query: null, source: 'unresolved', provider: null };
  }, 60 * 60 * 1000);
  return value;
}

module.exports = { resolveLocation, parseCoordinatePair, matchGazetteer, GAZETTEER };
