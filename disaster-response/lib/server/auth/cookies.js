'use strict';

const crypto = require('crypto');
const config = require('../config/env');

const ONE_HOUR = 60 * 60;

function buildAuthCookie(token) {
  const parts = [
    `${config.AUTH_COOKIE_NAME}=${token}`,
    `Max-Age=${ONE_HOUR}`,
    'Path=/',
    'HttpOnly',
    // SameSite=Lax lets top-level nav (bookmark, external link) send the
    // cookie while still blocking the classic cross-site form-POST CSRF path.
    'SameSite=Lax',
  ];
  if (config.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function buildCsrfCookie(token) {
  const parts = [
    `${config.CSRF_COOKIE_NAME}=${token}`,
    `Max-Age=${ONE_HOUR}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (config.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function clearedCookie(name) {
  const parts = [`${name}=`, 'Max-Age=0', 'Path=/'];
  if (config.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** RFC 6265: parse a `Cookie` header into a plain map. */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  });
  return out;
}

module.exports = {
  buildAuthCookie,
  buildCsrfCookie,
  clearedCookie,
  generateCsrfToken,
  parseCookies,
};
