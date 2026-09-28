# Architecture — Disaster Response Coordination Platform

A single Next.js 16 application (App Router) with Mongoose talking to MongoDB.
One process, one deploy, one codebase. Everything the assignment asks for —
CRUD, location resolution, geospatial nearby-resources, community reports,
caching, real-time updates, auth — is implemented as Route Handlers under
`app/api/*` and shared server-only libraries under `lib/server/*`.

The frontend under `app/(routes)/*` is intentionally thin: it is a demonstration
surface for the API, not a product. Every non-trivial rule lives on the server
so a hand-crafted `curl` and the browser reach the same conclusion.

---

## 1. Why this shape

The assignment is backend-focused, but it also asks for a runnable demo, a
Postman collection, tests, and clear docs. Two viable shapes:

| Option | Cost | Verdict |
|---|---|---|
| Express API + separate Next.js client (current repo) | Two servers, two deploys, CORS, two `package.json`s | Rejected — extra ceremony without new capability |
| **Single Next.js app: Route Handlers + App Router pages** | One process; SSR pages can pre-fetch server-side; Node.js runtime is Mongoose-compatible | **Chosen** |

Next.js Route Handlers (`app/api/**/route.js`) are Express-shaped enough that
controllers, validators, and middleware translate 1:1. The App Router's server
components render the initial page from Mongoose on the same process, so the
first paint carries data instead of a spinner.

Route Handlers run on Node.js (`export const runtime = 'nodejs'`), not the
Edge runtime — Mongoose, `bcryptjs`, and `jsonwebtoken` need Node APIs.

---

## 2. Top-level layout

```
.
├── app/
│   ├── (routes)/                     # public UI — thin, demonstrates the API
│   │   ├── disasters/
│   │   │   ├── page.jsx               # list + filters (server component, SSR'd)
│   │   │   ├── new/page.jsx           # create form (client, gated)
│   │   │   └── [id]/page.jsx          # detail (SSR shell, client hydration)
│   │   ├── login/page.jsx
│   │   └── layout.jsx                 # AuthProvider, NavBar, SSE bootstrap
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.js
│   │   │   ├── logout/route.js
│   │   │   ├── me/route.js
│   │   │   └── demo-users/route.js
│   │   ├── disasters/
│   │   │   ├── route.js               # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.js           # GET one, PATCH, DELETE
│   │   │       ├── resources/route.js # GET nearby
│   │   │       └── reports/route.js   # GET reports (cached)
│   │   ├── resources/route.js         # optional flat listing
│   │   ├── events/route.js            # SSE stream
│   │   └── health/route.js
│   ├── layout.jsx                     # root html
│   └── globals.css
├── lib/
│   ├── server/                        # NEVER imported from client bundles
│   │   ├── db.js                      # mongoose connection + cached promise
│   │   ├── models/                    # User, Disaster, Resource, Report
│   │   ├── auth/                      # jwt + password + cookies + requireRole
│   │   ├── validation/                # Zod schemas per resource
│   │   ├── services/
│   │   │   ├── geocoding.js           # gazetteer + Nominatim fallback
│   │   │   ├── reports.js             # L1 mem + L2 Mongo + external provider
│   │   │   ├── cache.js               # in-process TTL/LRU + single-flight
│   │   │   └── events.js              # SSE hub (in-process pub/sub)
│   │   ├── integrations/
│   │   │   └── mockSocial.js          # mock external social provider
│   │   ├── middleware/
│   │   │   ├── withAuth.js            # unwraps JWT cookie → req.user
│   │   │   ├── withRateLimit.js       # sliding-window per IP
│   │   │   ├── withValidation.js      # Zod → 422 with structured errors
│   │   │   └── errorEnvelope.js       # every response has {success,data|error}
│   │   ├── utils/
│   │   │   ├── AppError.js            # typed errors with status + code
│   │   │   ├── geo.js                 # GeoJSON helpers + haversine
│   │   │   └── logger.js              # JSON lines to stdout
│   │   └── config/env.js              # Zod-validated env
│   └── client/                        # safe to import from client components
│       ├── api.js                     # single fetch wrapper (CSRF, timeout)
│       ├── auth-context.js
│       └── useEventStream.js          # SSE hook, exponential backoff
├── components/                        # UI — pure presentational
├── tests/
│   ├── unit/                          # Jest — services, utils
│   ├── integration/                   # supertest against Next handler + mongodb-memory-server
│   └── fixtures/
├── scripts/
│   ├── seed.js                        # idempotent
│   ├── check-db.js                    # preflight, zero deps
│   └── check-syntax.js
├── postman/DisasterResponse.postman_collection.json
├── openapi.yaml
├── docker-compose.yml                 # mongo only; the app runs on host
├── .env.example
├── ARCHITECTURE.md                    # this file
└── README.md
```

**One import boundary that matters:** anything under `lib/server/` is
server-only. Client components import `lib/client/*` instead. The linter has a
`no-restricted-imports` rule to keep Mongoose and `bcryptjs` out of the browser
bundle.

---

## 3. Request flow

Every API request follows the same shape.

```
Browser
  │  fetch('/api/disasters?tag=flood', { credentials: 'include' })
  ▼
Next.js Node runtime
  │
  ▼
app/api/disasters/route.js
  │
  ├── withCors()                    only same-site by default
  ├── withRequestId()               X-Request-Id echoed and logged
  ├── withRateLimit(bucket)         reads / writes / auth in separate buckets
  ├── withAuth({ optional: true })  reads are public; writes call requireRole()
  ├── withValidation(querySchema)   Zod parses & normalises input
  │
  ▼
Controller (async function inside route.js)
  │
  ├── lib/server/services/*         geocoding, reports, cache, events
  ├── lib/server/models/*           Mongoose
  │
  ▼
res JSON envelope
  { success: true, data: ..., meta: ... }        (2xx)
  { success: false, error: { code, message, details, requestId } }  (4xx/5xx)
```

**Envelopes are non-negotiable.** Both success and error paths return the same
outer shape so the client has one code path, and so every error carries a
requestId matching the server log line.

---

## 4. Data model

### Users

```js
{ _id, username (unique, lowercase, indexed),
  displayName, passwordHash (select:false),
  role: 'admin' | 'contributor',
  createdAt, updatedAt }
```

`passwordHash` uses `select: false` so it never leaves the DB by accident.
`authenticate()` runs a bcrypt compare against a dummy hash when the user does
not exist so response timing does not reveal which usernames are registered.

### Disasters

```js
{ _id, title, description, tags: [String],
  status: 'active'|'monitoring'|'resolved',
  location: {
    label,      // "Manhattan, New York City"
    query,      // the phrase the resolver matched
    source,     // 'resolved' | 'provided' | 'unresolved'
    provider,   // 'gazetteer' | 'nominatim' | null
    point: { type: 'Point', coordinates: [lng, lat] }  // GeoJSON
  },
  createdBy: ObjectId(User),
  createdAt, updatedAt }
```

Indexes:
- `location.point` — `2dsphere` (for `$geoWithin` queries)
- `{ status: 1, createdAt: -1 }` — the default sort
- `{ tags: 1 }` — tag filtering
- `{ title, description }` — `text` index for `?q=`

Tags are normalised (trim, lowercase, dedupe, cap at 10) in a `pre('validate')`
hook. Tag filters normalise the same way, so `?tag=Flood` and `?tag=flood`
behave identically.

### Resources

```js
{ _id, name, type: 'shelter'|'hospital'|'food'|'water'|'rescue',
  location: { label, source, provider, point: { type:'Point', coordinates:[lng,lat] } },
  capacity, notes,
  createdAt, updatedAt }
```

Indexes:
- `location.point` — `2dsphere` (**required** for nearby search)
- `{ type: 1, 'location.point': '2dsphere' }` — combined index used when the
  UI filters by type as well

### Reports (cache-only)

```js
{ _id, disaster: ObjectId(Disaster), externalId, source,
  content, author, priority: 'low'|'normal'|'high',
  externalCreatedAt, fetchedAt }
```

Indexes:
- `{ disaster: 1, externalId: 1 }` unique — idempotent upserts
- `{ disaster: 1, priority: -1, externalCreatedAt: -1 }` — the read pattern
- `{ fetchedAt: 1 }` TTL — MongoDB evicts stale reports automatically

Reports are **level-2 cache**. They persist across restarts and survive
provider outages, but they expire without a cron job.

---

## 5. Location resolution (Assignment §2)

Two-stage resolver in `lib/server/services/geocoding.js`.

1. **Coordinate-pair fast path.** If the description contains a `lat, lng`
   pair, use it directly. Latitudes are ±90, longitudes are ±180, so the wider
   range disambiguates order.
2. **Phrase extraction → offline gazetteer.** A small curated dictionary of
   ~50 cities and neighbourhoods with real coordinates and aliases (e.g.
   `manhattan` matches "NYC", "midtown", "lower manhattan"). Phrase extraction
   looks at capitalised token runs and named landmarks first, then falls back
   to a full description scan.
3. **Optional live geocoder.** If `GEOCODER_PROVIDER=nominatim`, the resolver
   calls OpenStreetMap Nominatim with a 3-second timeout and the required
   `User-Agent`. On timeout or non-2xx, the gazetteer answer wins. A live
   provider is never a hard dependency.

The result is a `{label, query, source, provider, point}` object that is
persisted verbatim on the disaster.

**Why no LLM.** The demo has to be reproducible offline, and a curated gazetteer
is faster, cheaper, and more predictable than an LLM call for a 50-city radius.
The interface is the same shape (`resolveLocation(text)`), so swapping in an
LLM is a one-file change.

---

## 6. Nearby resources (Assignment §3)

**Endpoint:** `GET /api/disasters/:id/resources?radius=10&type=shelter`
(with optional `lat`, `lng` to override the disaster's own coordinates).

**Query:**

```js
Resource.find({
  'location.point': mongoose.trusted({
    $geoWithin: { $centerSphere: [[lng, lat], radiusKm / EARTH_RADIUS_KM] }
  }),
  ...(type && { type })
}).limit(100).lean();
```

Then a haversine pass in Node re-filters to the exact radius and sorts
ascending by distance. Two things worth naming:

1. **`$geoWithin` + `$centerSphere`, not `$near`.** `$near` sorts by distance
   for you but forbids combining with `$or`, and it forces a sort over the
   whole result set. `$geoWithin` is a pure predicate that plays nicely with
   the tag/type filter and lets us bound the result at 100 candidates before
   the O(n log n) client-side sort.
2. **`mongoose.trusted()` is required.** With `mongoose.set('sanitizeFilter',
   true)` on globally, Mongoose silently wraps operator objects in `$eq`,
   which turns a valid geo query into a literal-equality lookup that always
   returns zero. `trusted()` opts this one operator sub-document out. The
   coordinates come from Zod-validated numbers, not user objects, so
   injection is not possible.

**Answer stability.** `$geoWithin` is inclusive of the boundary and haversine
uses a slightly different earth model, so a resource sitting exactly on the
radius can flip between calls. Re-filtering client-side on the measured
distance makes "within radius" literally true.

---

## 7. Community reports (Assignment §4, §5)

**Two-layer cache** — L1 in-process, L2 in MongoDB — with the assignment's
exact request diagram implemented literally.

```
GET /api/disasters/:id/reports
        │
        ▼
lib/server/services/reports.js — getReportsForDisaster(id)
        │
        ├── L1 cache.get(id)                        ← in-process TTL/LRU, TTL 60s
        │       hit → return { data, freshness: 'fresh', provider }
        │
        ├── singleflight(id, async () => {           ← coalesce concurrent misses
        │
        │       reports = await Report.find({disaster:id})
        │                              .sort({ priority:-1, externalCreatedAt:-1 })
        │                              .limit(50).lean();
        │
        │       stale = !reports.length ||
        │               (Date.now() - reports[0].fetchedAt) > STALE_MS;
        │
        │       if (!stale) return { data: reports, freshness: 'db-cache' };
        │
        │       try {
        │           external = await mockSocial.fetch(disaster, { timeout: 2500 });
        │           await Report.bulkWrite(upserts(external));   // idempotent
        │           return { data: freshFromDb(id), freshness: 'network' };
        │       } catch (err) {
        │           if (reports.length) return { data: reports,
        │                                        freshness: 'stale',
        │                                        degraded: true };
        │           throw AppError.badGateway('reports provider unavailable');
        │       }
        │
        │   })
        │
        └── cache.set(id, result, TTL=60s) → return
```

- **Single-flight** collapses N simultaneous misses into one network call.
- **TTL is layered:** L1 60s, L2 15 minutes (a MongoDB TTL index on
  `fetchedAt`), external refetch when the newest row crosses `STALE_MS`.
- **Degraded fallback:** if the external provider errors and we have *any*
  reports, we serve them and set `meta.degraded = true`. The UI shows a
  yellow banner instead of an error.
- **Idempotent upserts:** `{disaster, externalId}` is unique, so replaying the
  same feed does not duplicate rows.

Failure semantics live in the service, not the controller: the handler cannot
accidentally omit the fallback.

**Why not Redis.** L1 in-process + L2 in Mongo already gives durability across
restarts, provider outage resilience, and no cron. Swapping L1 to Redis is a
one-file change (`cache.js`), and that same Redis would then also be the pub/sub
for horizontally-scaled SSE. Both are documented, neither is required for the
assignment scope.

---

## 8. Real-time updates (Assignment §6)

**Server-Sent Events**, not WebSockets. Reasons:

- One-directional (`server → client`), which is exactly the shape.
- Cookie auth flows through the standard `Cookie` header — no separate token
  handshake.
- Automatic reconnect with `Last-Event-ID` from the browser.
- No handshake framing to debug when something breaks.

**Implementation** (`lib/server/services/events.js`):

- An in-process `EventEmitter` hub tracks connected subscribers.
- `GET /api/events` streams `text/event-stream` and calls `publish()`
  on `disaster.created`, `disaster.updated`, `disaster.deleted`,
  `resource.created`, `resource.updated`, `resource.deleted`.
- A 25s heartbeat comment (`: keep-alive`) prevents load balancer timeouts.
- Capacity bound: `SSE_MAX_CLIENTS`, oldest evicted on overflow.
- Publish is fire-and-forget after the mutation response has been sent — a
  slow subscriber must not delay a write.

The client hook `useEventStream()` implements exponential backoff (200ms →
30s), with jitter, and pauses when the tab is hidden.

**Horizontal scaling:** a single process is fine for the assignment scope. For
N processes, replace the in-process EventEmitter with Redis pub/sub — that is
where the optional `REDIS_URL` is used.

---

## 9. Auth (Assignment §7)

Cookie-based JWT, CSRF token as a companion cookie, in-process user table.

- **`POST /api/auth/login`** — verifies bcrypt hash, sets two cookies:
  - `dr_access` — httpOnly, SameSite=Lax, contains a JWT `{sub, role, exp}`.
    (`SameSite=Lax` rather than `Strict`: `Strict` blocks the cookie on
    top-level cross-site navigations, which breaks post-login redirects
    from bookmarks and OAuth callbacks in the future.)
  - `dr_csrf` — readable, sent back in `x-csrf-token` on mutating requests.
- **JWT verification** on every request via `withAuth`. The token lives only
  in the httpOnly cookie — the browser never reads it, so an XSS cannot
  exfiltrate a reusable session credential.
- **CSRF check** on `POST`/`PATCH`/`DELETE`: the header must equal the cookie.
  A cross-origin attacker can cause the cookie to be sent ambiently but
  cannot set a custom header — that is the double-submit invariant.

Roles:
- `admin` → create, update, delete, reopen a resolved incident, manage resources
- `contributor` → create, update

Every route enforces its role via `requireRole(...)` on the server. The client
also hides controls it cannot use, but that is UX, not security — the API
rejects a hand-crafted `curl` with the same 403.

Rate limiting has three buckets: reads (`RATE_LIMIT_MAX`), writes
(`WRITE_RATE_LIMIT_MAX`), auth (`AUTH_RATE_LIMIT_MAX`). Auth is aggressive
(10/15min) to blunt credential stuffing; writes are amplification-sensitive
(60/15min); reads are permissive (300/15min).

---

## 10. Validation and error handling

- **Zod** at the boundary — every route defines `bodySchema`, `querySchema`,
  and `paramsSchema` and runs them through `withValidation` before the
  controller runs.
- **`strict()`** on every schema so mass-assignment `{"role":"admin"}` on a
  create fails with a 422 at the schema layer.
- **Structured 422** responses list every offending field.
- **`AppError`** carries `status`, `code`, `message`, `details`. The error
  middleware turns any thrown value into an envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "field": "title", "issue": "too_small", "message": "..." }],
    "requestId": "f142137c-…"
  }
}
```

- **Never leak stack traces** past `NODE_ENV=production` — a boot-time
  Zod check refuses to start if `NODE_ENV=production` and `JWT_SECRET` is
  the dev default, or if `CORS_ORIGINS=*`.

---

## 11. Testing (Assignment §9)

Jest + supertest + `mongodb-memory-server`. Three tiers:

| Tier | Runs against | Example |
|---|---|---|
| Unit | Pure functions | `geo.js` haversine, `geocoding.js` phrase extraction, `cache.js` TTL/LRU eviction |
| Integration | Route handlers + in-memory Mongo | `POST /api/disasters` (happy path, 422, 401, 403), `GET /disasters/:id/resources` boundary distance, reports L2 hit vs miss vs degraded |
| Contract | External-integration mock | `mockSocial` failure injected, service returns `degraded:true` and stale reports |

`NODE_ENV=test` swaps the Mongo URL to an in-memory server started by the
global setup; each test file drops its collections in `afterEach`. Tests do
not talk to real Nominatim; `GEOCODER_PROVIDER=mock` is forced.

Covered explicitly, matching the assignment:
- **One endpoint** — `POST /disasters` full flow.
- **One validation** — `{ "username": {"$ne": null} }` NoSQL-op payload
  returns 422 at the schema, before Mongoose sees it.
- **One business rule** — reopening a `resolved` incident requires `admin`;
  a `contributor` gets 403.
- **One integration** — mock social provider timing out → 200 with
  `meta.degraded = true`.

---

## 12. Configuration

`lib/server/config/env.js` — a single Zod schema is the source of truth for
every `process.env.*`. If a variable is missing or malformed, the process
refuses to start with a message naming the exact field.

`.env.example` documents every variable. `.env` is gitignored.

Runtime settings that matter:

| Var | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/disaster_response` | connection string |
| `JWT_SECRET` | dev sentinel, rejected in production | HMAC key |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated; wildcard rejected in production |
| `GEOCODER_PROVIDER` | `mock` | `mock` or `nominatim` |
| `CACHE_TTL_SECONDS` | 300 | L1 default |
| `REPORTS_TTL_SECONDS` | 900 | L2 (Mongo TTL index) |
| `SSE_HEARTBEAT_MS` | 25000 | keep-alive comment interval |
| `SSE_MAX_CLIENTS` | 200 | overflow evicts oldest |
| `RATE_LIMIT_MAX` / `WRITE_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | 300 / 60 / 10 | per 15m per IP |
| `TRUST_PROXY_HOPS` | 0 | number of reverse-proxy hops to trust for client IP |

---

## 13. Security posture

- `helmet`-equivalent headers set by Next.js `headers()` in `next.config.mjs`:
  CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY`, `Permissions-Policy` locking down camera / mic /
  geolocation / interest-cohort.
- **CSP:** `default-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`;
  `connect-src 'self'` plus the API origin; `script-src 'self' 'unsafe-inline'`
  and, **only in development**, `'unsafe-eval'` (Next.js hot-reload requires
  it — omitting it is what previously prevented React from mounting).
- `express-mongo-sanitize`-equivalent middleware on Route Handlers strips
  `$` and `.` from user objects before they reach Mongoose.
- `hpp`-equivalent duplicate query-param collapse on read routes.
- `mongoose.set('sanitizeFilter', true)` globally; specific geo/text operators
  wrapped in `mongoose.trusted()`.
- Every response carries `X-Request-Id` (also in error envelopes and log lines).

---

## 14. Real-time contract

```
event: disaster.created
data: {"id":"…","title":"…","status":"active"}

event: disaster.updated
data: {"id":"…","changed":["status"],"disaster":{…}}

event: disaster.deleted
data: {"id":"…"}

event: resource.created
data: {"id":"…","near":{"disasterId":"…","distanceKm":0.83}}

: keep-alive
```

Names are `<resource>.<verb>`, not `resource_verb`, so the client can subscribe
by prefix (`disaster.*`) if it wants. `:` lines are SSE comments and keep the
connection warm without triggering a message on the client.

---

## 15. Trade-offs and non-goals

- **No LLM in the resolver.** A curated gazetteer is deterministic and offline.
  The interface is one call, so an LLM can be dropped in without touching
  anything else.
- **No Redis in the default topology.** In-process cache + Mongo TTL covers
  the assignment. The knob (`REDIS_URL`) is documented in `.env.example` so
  swapping is a config change, not a redesign.
- **No file uploads.** The reports feed is text-only.
- **No multi-tenant.** Users share one namespace.
- **No pagination cursor.** Offset/limit with a max of 100. Fine for demo
  scale; cursor-based is where I would go next.
- **Frontend is thin.** The assignment says a polished UI is not required.
  The React app demonstrates every endpoint and the SSE stream, and that is
  the scope.
- **SSE is single-process only.** Redis pub/sub is the documented path to
  horizontal scale; not built.
- **Delete cascades resources? No.** A resource is not owned by a disaster.
  Delete only removes cached reports for that disaster.

---

## 16. Deploy shape

- `docker-compose.yml` runs MongoDB. The Next.js app runs on the host
  (`npm run dev`) or from a `next start` container.
- Zero external services required to run the demo end-to-end.
- `npm run seed` is idempotent — three users, fifteen disasters spanning
  three statuses, thirty-plus resources across eleven cities. Reruns
  converge, never duplicate.
- `npm run check` validates syntax and require graph before any test runs.

---

## 17. What each Assignment section maps to

| Assignment | Where it lives |
|---|---|
| §1 CRUD | `app/api/disasters/**`, `lib/server/models/Disaster.js`, `lib/server/validation/disaster.schema.js` |
| §2 Location resolution | `lib/server/services/geocoding.js` |
| §3 Nearby resources | `app/api/disasters/[id]/resources/route.js`, 2dsphere index on `Resource.location.point`, `mongoose.trusted($geoWithin)` |
| §4 Community reports | `app/api/disasters/[id]/reports/route.js`, `lib/server/services/reports.js`, `lib/server/integrations/mockSocial.js` |
| §5 Caching | `lib/server/services/cache.js` (L1) + `Report` TTL index (L2) |
| §6 Real-time | `app/api/events/route.js`, `lib/server/services/events.js`, `lib/client/useEventStream.js` |
| §7 Auth | `app/api/auth/**`, `lib/server/auth/**`, cookie + JWT + CSRF |
| §8 Judgement | This document; the "why" comments in `services/*` |
| §9 Testing | `tests/**` per §11 above |
| §10 README | `README.md` covers setup + this doc for architecture |

**Bonus (choose one):** priority classification of reports — a small classifier
in `lib/server/services/reports.js` that reads keywords ("rescue", "trapped",
"medical") to promote priority. Deterministic, testable, no external call.
