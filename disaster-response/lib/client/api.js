'use client';

/**
 * Client-side API wrapper. Same-origin only, so no NEXT_PUBLIC_API_URL needed:
 * Route Handlers live under /api on the same host.
 *
 *  - httpOnly `dr_access` cookie carries the session; we never read it.
 *  - Readable `dr_csrf` cookie is echoed in `x-csrf-token` on mutations.
 *  - Every response is the envelope { success, data, meta } | { success:false, error }.
 */

const CSRF_COOKIE = 'dr_csrf';
const CSRF_HEADER = 'x-csrf-token';
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status, code, details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 0;
    this.code = code || 'UNKNOWN';
    this.details = details || null;
    this.requestId = requestId || null;
  }
}

export function isUnauthorised(err) {
  return err instanceof ApiError && (err.status === 401 || err.code === 'UNAUTHORIZED');
}
export function isForbidden(err) {
  return err instanceof ApiError && (err.status === 403 || err.code === 'FORBIDDEN');
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;
}

function buildUrl(path, query) {
  const base = path.startsWith('/') ? path : `/${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function request(path, { method = 'GET', body, query, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (MUTATING.has(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) headers[CSRF_HEADER] = token;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('Request timed out', { code: 'TIMEOUT' });
    throw new ApiError('Could not reach the API', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return { data: null, meta: null };
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const err = payload && payload.error ? payload.error : {};
    throw new ApiError(err.message || `Request failed (${response.status})`, {
      status: response.status,
      code: err.code,
      details: err.details,
      requestId: err.requestId || response.headers.get('x-request-id'),
    });
  }
  return { data: payload ? payload.data : null, meta: payload ? payload.meta : null };
}

export async function apiFetch(path, options = {}) {
  const { data } = await request(path, options);
  return data;
}
export async function apiFetchWithMeta(path, options = {}) {
  return request(path, options);
}
export function eventStreamUrl() {
  return `/api/events`;
}
