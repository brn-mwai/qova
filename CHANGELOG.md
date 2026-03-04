# Changelog

All notable changes to the Qova Developer Platform are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-03-04

### API

#### Added
- **RFC 7807 Problem Details** on every error response (`application/problem+json`)
  - Fields: `type`, `title`, `status`, `detail`, `instance`, `code`, `requestId`
  - Validation errors include `errors[]` with field-level detail
  - Rate limit errors include `retryAfter`
- **Idempotency** — `Idempotency-Key` header on all POST endpoints
  - 24h in-memory cache, per-API-key namespacing
  - `Idempotency-Replayed: true` header on cached responses
  - 422 on key reuse across different endpoints
- **Cursor-based pagination** on agent list with `limit`, `cursor`, `sort` params
  - Response shape: `{ data, pagination: { total, limit, hasMore, nextCursor } }`
- **Filtering** — `registered`, `min_score`, `max_score` query params on agent list
- **Sorting** — `sort=asc|desc` on agent list (by score)
- **Field selection** — `fields=address,score` to select returned fields
- **Circuit breaker** middleware for graceful degradation
  - CLOSED → OPEN (after threshold) → HALF_OPEN (after cooldown) → CLOSED
  - Returns 503 with Problem Details when circuit is open
- **Prometheus metrics** at `GET /api/metrics`
  - Request count, error count, latency histograms, active requests, uptime
  - Circuit breaker state gauges, path normalization
- **Readiness probe** `GET /api/health/ready` — chain RPC + circuit state
- **Liveness probe** `GET /api/health/live` — cheap process-alive check
- **Webhook delivery engine** — HMAC-SHA256 signed, 3 retries with backoff, delivery logs
  - Events: agent.registered, agent.score.updated, transaction.recorded, budget.exceeded, key.created, key.revoked
- **CI/CD** — GitHub Actions workflows
  - `ci.yml`: test + type check, SDK Node 18/20/22 matrix
  - `release.yml`: npm publish on tag, auto GitHub release notes

#### Changed
- All errors → RFC 7807 format
- Health includes `circuits` object, version `0.2.0`
- CORS: allow `Idempotency-Key`, expose `Idempotency-Replayed`

### SDK (`@qova/core`)

#### Added
- **Request/response interceptors** — `onRequest`, `onResponse` hooks
- **Retry jitter** — ±25% randomization on retry delays
- **RFC 7807 parsing** — falls back to legacy `{ error, code }` format
- **Idempotency keys** — `register("0x...", { idempotencyKey })`, `record(input, { idempotencyKey })`
- **`PageIterator`** async iterable: `for await`, `.toArray()`, `.take(n)`
- **`agents.list(params)`** with `PaginationParams`
- **`agents.listAll(params)`** → `PageIterator<AgentSummary>`
- **`AgentSummary`** type: `{ address, score, isRegistered }`
- **Mock server** — `createMockServer()` for SDK testing
- **Integration test suite** — 14 tests against mock server

#### Changed
- Version `0.2.0`
- `AgentListResponse` → `PaginatedResponse<AgentSummary>`
- Interceptor types exported from barrel

## [0.1.0] — 2026-03-04

### Added
- Initial developer platform: SDK, API, Dashboard
- Bearer token auth, scope enforcement, rate limiting, CORS, request logging
- OpenAPI 3.1 spec with Scalar docs
- 184 tests (120 SDK + 64 API)
