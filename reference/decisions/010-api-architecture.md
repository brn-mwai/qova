# ADR-010: REST API Architecture (Hono on Bun)

## Status
Accepted

## Date
2026-02-26

## Context
The Qova dashboard (Phase 5) and CRE workflows (Phase 3) both need a structured
JSON API to query agent reputation data, transaction stats, and budget status from
the Base Sepolia contracts. CRE workflows were previously configured to call a mock
API at `/v1/` paths. The API must serve both consumers without breaking existing
CRE workflow configurations.

## Decision

### Framework: Hono on Bun
- **Hono** for routing, middleware, and request handling (not Express/Fastify)
- **Bun** as the runtime (native `Bun.serve` entry point)
- **@brnmwai/qova-core** SDK for all chain interactions (never raw viem calls)
- **Zod** for request validation on every POST body
- **Vitest** for testing with mocked SDK client

### Route Architecture
Six route modules under `/api/`:

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| health | 1 | Liveness + contract connectivity |
| agents | 7 | Agent CRUD + enriched details |
| transactions | 2 | Stats + recording |
| budgets | 4 | Status, limits, check, spend |
| scores | 5 | CRE-compat + compute + breakdown |
| verify | 2 | Verification + sanctions |

Total: 21 endpoints.

### CRE Backward Compatibility
`/v1/` routes mirror the mock API response shapes:
- `GET /v1/agents` -- agent list
- `POST /v1/enrich` -- off-chain enrichment
- `POST /v1/anomaly-check` -- anomaly detection
- `POST /v1/sanctions/check` -- sanctions screening
- `POST /v1/webhook` -- alert receiver

### Middleware Stack
1. CORS (localhost + qova.cc)
2. Logger (Hono built-in)
3. Pretty JSON (Hono built-in)
4. Error handler (maps SDK errors to HTTP status codes)
5. Address validation (regex-based per-route)
6. Body validation (Zod per-route)

### Data Enrichment
Raw on-chain data (bigints, raw scores) is enriched using SDK utilities:
- `getGrade()`, `getScoreColor()` -- letter grades and colors
- `formatScore()`, `scoreToPercentage()` -- display formatting
- `formatWei()`, `formatBasisPoints()` -- unit conversion
- `shortenAddress()` -- truncated display addresses

### Scoring Algorithm Sync
The CRE scoring algorithm is re-implemented in `api/src/services/scoring.ts`
(identical to `cre/shared/scoring.ts`) since the CRE package is not a workspace
dependency. Both implementations must stay in sync manually.

### In-Memory Cache
Read-heavy endpoints use a simple Map-based TTL cache (30s default) to reduce
redundant RPC calls. No external cache dependency for the hackathon.

## Consequences

### Positive
- SDK-first: all chain reads go through `@brnmwai/qova-core`, ensuring type safety
- CRE workflows work without config changes (same `/v1/` response shapes)
- Dashboard gets enriched JSON (grades, colors, formatted values)
- 44 tests provide confidence in route behavior and error mapping
- Hono is lightweight and Bun-native (fast cold start)

### Negative
- Scoring algorithm duplication between api/ and cre/ (manual sync required)
- In-memory cache lost on restart (acceptable for hackathon)
- No auth middleware yet (Phase 5 will add Clerk JWT)
- No rate limiting yet (to be added before production)

### Risks
- BigInt serialization: all bigint values converted to strings in JSON responses
- Cache staleness: 30s TTL means dashboard may show slightly stale data
