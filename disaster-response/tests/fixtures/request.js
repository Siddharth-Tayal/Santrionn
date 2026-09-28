'use strict';

/**
 * Build a Web-standard Request the way a Route Handler expects. Bypasses the
 * whole HTTP server so tests hit the handler function directly.
 */
function buildRequest({ method = 'GET', path = '/', body, headers = {}, cookies } = {}) {
  const url = `http://test.local${path}`;
  const h = new Headers({ 'Content-Type': 'application/json', ...headers });
  if (cookies) h.set('Cookie', Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  return new Request(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function callHandler(handler, opts = {}) {
  const req = buildRequest(opts);
  const ctx = opts.params ? { params: Promise.resolve(opts.params) } : undefined;
  const res = await handler(req, ctx);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, headers: res.headers, body };
}

module.exports = { buildRequest, callHandler };
