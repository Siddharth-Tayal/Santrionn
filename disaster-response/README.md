# Disaster Response Platform

A single Next.js 16 application (App Router) with Mongoose talking to MongoDB.
CRUD, location resolution, geospatial nearby-resources, community reports,
caching, real-time updates, auth — all in one process.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the design rationale, or the
[`postman/`](postman/) folder for a runnable collection of every endpoint.

---

## Setup (60 seconds)

```bash
# 1. Start MongoDB
docker compose up -d mongo
# or:  mongod  (if you have one running natively on :27017)

# 2. Install and seed
cp .env.example .env
npm install
npm run seed

# 3. Run
npm run dev
# → http://localhost:3000
```

Sign in on the login page with **admin / Admin@12345** or click a demo-account
button. The seed also creates `contributor / Contrib@12345` (contributor role)
and `reliefops / Relief@12345` (contributor role).

---

## The endpoints

Base URL: `http://localhost:3000/api`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST   | `/auth/login`                        | — | Sets `dr_access` httpOnly + `dr_csrf` cookies |
| POST   | `/auth/logout`                       | — | Clears both cookies |
| GET    | `/auth/me`                           | ✓ | Whoami |
| GET    | `/auth/demo-users`                   | — | Demo accounts for the UI |
| GET    | `/disasters`                         | — | List; `?status=&tag=&q=&sort=&page=&limit=` |
| POST   | `/disasters`                         | contrib+ | Create |
| GET    | `/disasters/:id`                     | — | One |
| PATCH  | `/disasters/:id`                     | contrib+ | Update (reopen resolved = admin only) |
| DELETE | `/disasters/:id`                     | admin | Delete + cascade cached reports |
| GET    | `/disasters/:id/resources`           | — | Nearby, `?radius=km&type=&lat=&lng=` |
| GET    | `/disasters/:id/reports`             | — | Cached community feed |
| GET    | `/resources`                         | — | Flat listing; `?lat=&lng=&radius=&type=` |
| GET    | `/events`                            | — | SSE stream (`disaster.*`, `resource.*`) |
| GET    | `/health`                            | — | Liveness + Mongo state |

Every response is enveloped:

```json
{ "success": true, "data": ..., "meta": { … } }
{ "success": false, "error": { "code":"...", "message":"...", "details":[…], "requestId":"…" } }
```

Every response carries `X-Request-Id`, echoed in logs and error envelopes.

---

## Architecture at a glance

```
Browser
  │ fetch('/api/…', { credentials: 'same-origin' })
  ▼
Next.js Node runtime
  │
  ▼
withHandler(  … withValidation( … ) …  )
  │  request-id · rate limit · CSRF · cookie auth · role gate · Zod
  │
  ▼
lib/server/services/*   → geocoding, reports (2-layer cache), events, cache
lib/server/models/*     → User, Disaster, Resource, Report
  │
  ▼
{ success, data, meta }  |  { success:false, error }
```

Full walkthrough: [ARCHITECTURE.md](../ARCHITECTURE.md).

---

## Technical decisions

### Database — MongoDB + Mongoose

- **Native geospatial.** `2dsphere` indexes on `Disaster.location.point` and
  `Resource.location.point` let the "nearby resources" query be a single
  `$geoWithin` predicate.
- **TTL index for cache eviction.** The `Report` collection is a level-2
  cache; a TTL index on `fetchedAt` (`REPORTS_TTL_SECONDS`) lets MongoDB evict
  stale reports for us without a cron job.
- **Text index for search.** `title` + `description` are indexed as text so
  `?q=manhattan` uses `$text: {$search}`.
- **Sanitized filters** are on globally
  (`mongoose.set('sanitizeFilter', true)`). Two known operators
  (`$geoWithin` and `$text`) are wrapped in `mongoose.trusted()` where used —
  see the code comments for why: without the opt-out, Mongoose silently
  wraps them in `$eq` and the query returns zero rows.

### Geospatial search

`GET /disasters/:id/resources?radius=km&type=&lat=&lng=`

1. Pick the origin: the query's `lat/lng` if given, else the disaster's own
   `location.point`.
2. `Resource.find({ 'location.point': mongoose.trusted({ $geoWithin: {
   $centerSphere: [[lng, lat], radiusKm / 6371] } }) }).limit(100).lean()`
3. In Node, re-filter by measured haversine distance (accounts for the tiny
   disagreement between `$geoWithin`'s earth model and haversine's), then
   sort ascending by `distanceKm`.

Why `$geoWithin` + `$centerSphere` over `$near`: `$near` sorts by distance
for you but forbids combining with `$or`, and forces a sort over the whole
result set. `$geoWithin` is a pure predicate that composes with the `type=`
filter and lets us bound the candidate set at 100 before the client sort.

### Caching

Two layers, both implemented in [`lib/server/services/reports.js`](lib/server/services/reports.js):

- **L1 — in-process TTL/LRU** with single-flight. N concurrent misses on
  the same disaster collapse into one loader run. Default TTL 60 s.
- **L2 — the `reports` collection**. Idempotent upserts on
  `{ disaster, externalId }`. A MongoDB TTL index on `fetchedAt`
  auto-expires stale rows.
- **External refetch** only when the newest L2 row is older than
  `REPORTS_TTL_SECONDS / 3`.

Cache miss & external provider is down:
- If L2 has anything at all, we serve it with `meta.degraded = true` and
  `freshness: "stale-fallback"`.
- If L2 is empty, we return `502 BAD_GATEWAY`.

That fallback lives in the service, not the controller — the handler cannot
accidentally omit it.

### External API failures

- Every outgoing call runs with a timeout (`SOCIAL_API_TIMEOUT_MS`,
  `GEOCODER_TIMEOUT_MS`) and an `AbortController`.
- Failures are logged with structured metadata (requestId, disaster id,
  error message).
- The reports service degrades gracefully; the geocoder falls back to the
  offline gazetteer.
- `SOCIAL_API_FAILURE_RATE` in `.env` can be set to inject failures in
  order to demonstrate the degraded path live.

### Auth

- `bcryptjs` hashes stored in `passwordHash` with `select: false`.
- JWT (HS256) in an **httpOnly, SameSite=Lax** cookie — the browser cannot
  read it, so XSS cannot exfiltrate a session token.
- Companion CSRF cookie `dr_csrf` is readable and echoed in
  `x-csrf-token` on mutations (**double-submit invariant**: a cross-origin
  attacker can cause the cookie to be sent ambiently but cannot set a custom
  request header).
- Three rate-limit buckets: `read` (300/15m), `write` (60/15m),
  `auth` (10/15m) — the auth bucket is aggressive to blunt credential
  stuffing.
- One authorization rule: **reopening a resolved incident requires the
  `admin` role**. Enforced by the service and covered by an integration test.

---

## Real-time

`GET /api/events` streams `text/event-stream`. Events published on:
`disaster.created`, `disaster.updated`, `disaster.deleted`,
`resource.created`, `resource.updated`, `resource.deleted`.

Client uses a tiny `useEventStream` hook with exponential-backoff reconnect,
jitter, and a `visibilitychange` listener so a hidden tab does not reconnect
on every wobble.

Test it from a terminal:

```bash
curl -N http://localhost:3000/api/events
# then, in another terminal:
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -c /tmp/c.txt \
  -d '{"username":"admin","password":"Admin@12345"}'
CSRF=$(jq -r .data.csrfToken /dev/null 2>/dev/null || awk '/dr_csrf/{print $NF}' /tmp/c.txt)
curl -X POST http://localhost:3000/api/disasters \
  -H 'Content-Type: application/json' -H "x-csrf-token: $CSRF" -b /tmp/c.txt \
  -d '{"title":"Test","description":"Heavy flooding has affected Manhattan","status":"active"}'
# The first terminal will print a `disaster.created` event.
```

---

## Testing

```bash
npm test              # runs unit + integration against mongodb-memory-server
npm run test:coverage
```

- **Endpoint** — `POST /api/disasters` full flow (happy path, mass-assignment 422, 401).
- **Validation** — NoSQL-op payload `{"$ne": null}` rejected at the schema layer.
- **Business rule** — reopening a resolved incident from a `contributor` returns 403.
- **Integration** — mock social provider fails ⇒ `getReportsForDisaster` returns
  `meta.degraded = true` with the last cached page, or `502` when the cache is empty.
- **Unit** — haversine distance, gazetteer resolution, TTL/LRU + single-flight.

---

## Trade-offs and non-goals

- **No LLM in the resolver.** A curated gazetteer is deterministic and offline.
  The interface is one call, so an LLM can be dropped in without touching
  anything else.
- **No Redis by default.** In-process cache + Mongo TTL covers the assignment.
  The knob (`REDIS_URL`) is documented so swapping is a config change, not a
  redesign.
- **SSE is single-process only.** Redis pub/sub is the documented path to
  horizontal scale; not built.
- **Thin frontend.** The assignment says a polished UI is not required. The
  UI here is a demonstration surface — dark theme, plain CSS, no design
  framework.
- **Offset pagination.** Cursor-based is where I'd go next; not needed at
  demo scale.

---

## AI usage

- **Tool:** Claude Code / Claude (Opus 4.7).
- **Where it helped:** scaffolding boilerplate (models, schemas, route
  handlers), catching subtle bugs (Mongoose `sanitizeFilter` silently
  wrapping `$geoWithin` in `$eq`; a `SameSite=Strict` cookie blocking the
  demo login; Next.js dev-mode CSP missing `'unsafe-eval'`), and preparing
  the seed corpus.
- **Manually authored / verified:** the architecture, data model, cache
  strategy, choice of `$geoWithin`+`$centerSphere` over `$near`, CSRF
  double-submit design, and every test assertion. I reviewed and edited each
  generated file — every route, service, and index change is one I would
  defend in a code review.
