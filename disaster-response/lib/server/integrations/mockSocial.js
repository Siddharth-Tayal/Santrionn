'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Deterministic mock social provider.
 * A stable seed per disaster means the same content re-emerges after cache
 * expiry, which is what a real feed would look like too (retrievals see the
 * same posts unless something is deleted).
 */

const TEMPLATES = [
  { priority: 'high',   text: (p) => `Roads are impassable near ${p}, need rescue` },
  { priority: 'high',   text: (p) => `Family of four trapped in ${p} — send help` },
  { priority: 'normal', text: (p) => `Our neighbourhood in ${p} has no clean water since yesterday` },
  { priority: 'normal', text: (p) => `Can donate dry food to the collection point in ${p}` },
  { priority: 'normal', text: (p) => `Medical supplies running low at the ${p} shelter` },
  { priority: 'low',    text: (p) => `Air quality still poor across ${p}, but power is back` },
  { priority: 'low',    text: (p) => `Volunteers gathering at the community centre in ${p}` },
  { priority: 'normal', text: (p) => `Which shelters are open tonight in ${p}?` },
  { priority: 'high',   text: (p) => `Building collapse reported in ${p}, please avoid the area` },
  { priority: 'low',    text: (p) => `Bus service partially resumed through ${p}` },
];

const AUTHORS = ['nyc_resident', 'street_corner_reporter', 'neighbor_amy', 'first_responder', 'metro_watch', 'aid_volunteer', 'delhi_pulse', 'mumbai_local', 'la_news_now'];

function hash(s) {
  return crypto.createHash('sha1').update(s).digest();
}

/**
 * Fetch community reports for a disaster.
 * @returns {Promise<Array<{externalId,content,author,priority,externalCreatedAt}>>}
 */
async function fetchReports(disaster, { timeout } = {}) {
  // Simulate network latency.
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));

  const failureRate = config.SOCIAL_API_FAILURE_RATE;
  if (failureRate > 0 && Math.random() < failureRate) {
    throw AppError.badGateway('mock social provider is down (simulated)');
  }

  if (timeout && timeout < 25) {
    // Honour a very tight timeout — the caller expects a failure.
    throw AppError.badGateway('mock social provider timed out');
  }

  const seed = hash(String(disaster._id || disaster.id));
  const placeName = disaster?.location?.label || disaster?.title?.split(' ').slice(-2).join(' ') || 'the area';

  const count = 5 + (seed[0] % 6); // 5..10
  const reports = [];
  for (let i = 0; i < count; i++) {
    const idx = seed[i + 1] % TEMPLATES.length;
    const tpl = TEMPLATES[idx];
    const authorIdx = seed[i + 2] % AUTHORS.length;
    const externalId = `${String(disaster._id || disaster.id).slice(-8)}-${i}`;
    const minutesAgo = (seed[i + 3] % 240) + i * 7;
    const externalCreatedAt = new Date(Date.now() - minutesAgo * 60 * 1000);
    reports.push({
      externalId,
      content: tpl.text(placeName),
      author: AUTHORS[authorIdx],
      priority: classifyPriority(tpl.text(placeName), tpl.priority),
      externalCreatedAt,
    });
  }
  return reports;
}

/**
 * Simple keyword classifier — bonus §11. Deterministic and testable.
 */
function classifyPriority(content, fallback = 'normal') {
  const c = content.toLowerCase();
  const HIGH = ['rescue', 'trapped', 'collapse', 'stranded', 'medical', 'emergency', 'urgent'];
  const LOW = ['resumed', 'still poor', 'volunteers', 'open tonight'];
  if (HIGH.some((k) => c.includes(k))) return 'high';
  if (LOW.some((k) => c.includes(k))) return 'low';
  return fallback;
}

module.exports = { fetchReports, classifyPriority };
