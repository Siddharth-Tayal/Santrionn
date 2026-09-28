'use strict';

/**
 * The single wrapper every Route Handler goes through. It:
 *  - assigns a request id
 *  - runs the handler
 *  - catches everything and turns it into the standard error envelope
 *  - always sends {success,data,meta} on the happy path
 *
 * Handlers return a plain object: { data, meta } or a Response.
 */

const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { connectDatabase } = require('../db');
const { parseCookies } = require('../auth/cookies');
const { verifyAccessToken } = require('../auth/jwt');
const { checkRateLimit } = require('./withRateLimit');

function clientIp(request) {
  const hops = config.TRUST_PROXY_HOPS;
  if (hops > 0) {
    const fwd = request.headers.get('x-forwarded-for');
    if (fwd) {
      const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
      const idx = Math.max(0, parts.length - hops);
      if (parts[idx]) return parts[idx];
    }
  }
  return request.headers.get('x-real-ip') || '0.0.0.0';
}

function buildSuccessResponse({ data, meta, status = 200, cookies = [], extraHeaders = {}, requestId }) {
  const body = { success: true, data: data === undefined ? null : data };
  if (meta !== undefined) body.meta = meta;
  const headers = new Headers({ 'Content-Type': 'application/json', 'X-Request-Id': requestId });
  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  // Each cookie is a full Set-Cookie value; append preserves the semi-colons.
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function buildErrorResponse(err, requestId) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const payload = {
    success: false,
    error: {
      code: isApp ? err.code : 'INTERNAL_ERROR',
      message: isApp ? err.message : 'An unexpected error occurred',
      details: isApp ? err.details : undefined,
      requestId,
    },
  };
  if (!isApp && config.NODE_ENV !== 'production') {
    payload.error.debug = err.message;
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
  });
}

function mutating(method) {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

function csrfCheck(request) {
  const method = request.method.toUpperCase();
  if (!mutating(method)) return;
  const cookies = parseCookies(request.headers.get('cookie'));
  const csrfCookie = cookies[config.CSRF_COOKIE_NAME];
  const header = request.headers.get(config.CSRF_HEADER_NAME);
  // On login the cookie does not exist yet — the handler chooses whether to
  // require it. Auth routes opt out of the CSRF check.
  if (!csrfCookie || !header) throw AppError.forbidden('CSRF token missing');
  if (csrfCookie !== header) throw AppError.forbidden('CSRF token mismatch');
}

async function resolveAuth(request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[config.AUTH_COOKIE_NAME];
  const claims = verifyAccessToken(token);
  if (!claims) return null;
  return { userId: claims.sub, username: claims.username, role: claims.role };
}

/**
 * Wrap a route handler.
 *
 * @param {(ctx) => Promise<{data?,meta?,status?,extraHeaders?}|Response>} handler
 * @param {object} options
 * @param {'read'|'write'|'auth'} [options.rateBucket]
 * @param {boolean} [options.auth]      require a session
 * @param {string[]} [options.roles]    require one of these roles
 * @param {boolean} [options.skipCsrf]  auth/login only
 * @param {boolean} [options.skipDb]    health check / static
 */
function withHandler(handler, options = {}) {
  return async function wrapped(request, context) {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    const start = Date.now();
    const method = request.method.toUpperCase();
    let user = null;

    try {
      if (!options.skipDb) await connectDatabase();

      const bucket = options.rateBucket || (mutating(method) ? 'write' : 'read');
      checkRateLimit(bucket, clientIp(request));

      if (!options.skipCsrf) csrfCheck(request);

      user = await resolveAuth(request);

      if (options.auth && !user) throw AppError.unauthorized();
      if (options.roles && user && !options.roles.includes(user.role)) {
        throw AppError.forbidden(`Role ${user.role} cannot perform this action`);
      }
      if (options.roles && !user) throw AppError.unauthorized();

      const params = context && context.params ? await context.params : {};
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams.entries());
      let body = null;
      if (mutating(method)) {
        const raw = await request.text();
        if (raw) {
          try { body = JSON.parse(raw); } catch { throw AppError.badRequest('Request body is not valid JSON'); }
        }
      }

      const result = await handler({
        request,
        params,
        query,
        body,
        user,
        requestId,
        clientIp: clientIp(request),
      });

      if (result instanceof Response) return result;

      logger.info('request', {
        requestId, method, path: url.pathname, status: result?.status || 200,
        ms: Date.now() - start, user: user?.username || null,
      });

      return buildSuccessResponse({ ...result, requestId });
    } catch (err) {
      const url = new URL(request.url);
      logger.warn('request failed', {
        requestId, method, path: url.pathname,
        code: err.code || 'INTERNAL_ERROR', status: err.status || 500,
        ms: Date.now() - start, user: user?.username || null,
        message: err.message,
      });
      return buildErrorResponse(err, requestId);
    }
  };
}

module.exports = { withHandler, clientIp };
