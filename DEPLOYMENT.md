# Qova Developer Platform — Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Dashboard      │     │   API Server   │     │   SDK / CLI      │
│   (Next.js)      │     │   (Hono + Bun) │     │   (@qova/core)   │
│                  │     │                │     │                  │
│ • Key CRUD UI    │     │ • REST routes  │     │ • HTTP client    │
│ • Clerk auth     │     │ • CORS + rate  │     │ • Typed methods  │
│ • Convex hooks   │     │ • Auth middleware    │ • CLI debugger   │
└────────┬─────────┘     └────────┬───────┘     └────────┬─────────┘
         │                        │                      │
    Clerk JWT               Bearer token            Bearer token
         │                        │                      │
         ▼                        ▼                      │
┌──────────────────────────────────────────────┐         │
│               Convex Database                 │         │
│                                              │         │
│ • apiKeys table (SHA-256 hashed)             │◄────────┘
│ • Clerk auth for dashboard mutations         │  (via API server)
│ • HTTP actions for API server access         │
│ • Internal mutations (no auth needed)        │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│           Base Sepolia (L2 Chain)             │
│                                              │
│ • QovaRegistry contract                      │
│ • Agent registration + scoring               │
└──────────────────────────────────────────────┘
```

## Test Results

| Layer | Tests | Status |
|-------|-------|--------|
| SDK (all suites) | 120/120 | ✅ |
| API middleware (auth, validate, rate-limit, logger, error) | 32/32 | ✅ |
| API routes (agents, budgets, health, scores, transactions, verify) | 25/25 | ✅ |
| API services (enrichment, scoring) | 7/7 | ✅ |
| **Total** | **184/184** | ✅ |
| SDK type check | 0 errors | ✅ |
| API type check | 0 errors | ✅ |

---

## Step 1: Environment Variables

### API Server (`api/.env`)

```bash
PORT=3001
RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x...your_deployer_key...

# Convex
CONVEX_URL=https://your-project.convex.cloud
CONVEX_SERVICE_SECRET=<generate with: openssl rand -hex 32>

NODE_ENV=production
```

### Convex Dashboard Environment Variables

Set in Convex dashboard (Settings → Environment Variables):

```
CONVEX_SERVICE_SECRET=<same value as API server>
```

This shared secret authenticates the API server when calling Convex HTTP actions.

### Dashboard (`dashboard/.env.local`)

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

---

## Step 2: Deploy Convex

The Convex layer must go first — it's the database both the API and dashboard depend on.

```bash
cd dashboard

# Install dependencies
bun install

# Deploy Convex functions (mutations, queries, HTTP actions)
npx convex deploy
```

**What gets deployed:**
- `convex/mutations/apiKeys.ts` — create, revoke, delete, touchLastUsed (with internal variants)
- `convex/queries/apiKeys.ts` — listByUser (with internal variant)
- `convex/queries/apiKeyLookup.ts` — getByHash (used by API auth middleware)
- `convex/http.ts` — HTTP action router at `/api-keys/*` (service-secret authenticated)
- `convex/schema.ts` — apiKeys table with `by_user` and `by_hash` indexes

**Verify:** After deploy, confirm the HTTP actions are live:

```bash
curl -X POST https://your-project.convex.cloud/api-keys/list \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: your-secret-here" \
  -d '{"userId":"test"}'

# Should return: {"keys":[]}
```

---

## Step 3: Deploy Dashboard

```bash
cd dashboard

# Build Next.js
bun run build

# Deploy (Vercel)
vercel --prod
```

**Verify:** Log in, navigate to Developers → API Keys, and create your first key. You should see the key once with a copy button. This is the bootstrap — the dashboard uses Clerk auth, so no existing API key is needed.

---

## Step 4: Build & Publish SDK

```bash
cd sdk

# Install dependencies
bun install

# Type check
npx tsc --noEmit

# Run tests
npx vitest run

# Build to dist/
npx tsc

# Publish to npm
npm publish --access public
```

**Package exports:**

| Import | What |
|--------|------|
| `@qova/core` | HTTP SDK (default) — `new Qova("qova_xxx")` |
| `@qova/core/chain` | On-chain SDK (advanced) — direct contract calls |
| `@qova/core/http` | HTTP SDK only |
| `@qova/core/abi` | Contract ABIs |
| `@qova/core/types` | TypeScript types |

**CLI:** After global install, `qova` binary is available:

```bash
npm install -g @qova/core
export QOVA_API_KEY=qova_your_key
qova health
qova score 0xAGENT_ADDRESS
```

---

## Step 5: Deploy API Server

```bash
cd api

# Install dependencies
bun install

# Run tests (requires SDK to be built first)
npx vitest run

# Start production server
NODE_ENV=production bun run src/index.ts
```

**Recommended deployment targets:** Railway, Fly.io, or any platform that supports Bun.

**Docker (optional):**

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY api/ ./api/
COPY sdk/ ./sdk/
WORKDIR /app/sdk
RUN bun install && npx tsc
WORKDIR /app/api
RUN bun install
ENV NODE_ENV=production
EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
```

**Verify:** After deploy, hit the public endpoints:

```bash
# Health (no auth)
curl https://api.qova.cc/api/health

# Docs (no auth) — opens Scalar UI
open https://api.qova.cc/api/docs

# Authenticated request
curl https://api.qova.cc/api/agents/0xAGENT \
  -H "Authorization: Bearer qova_your_api_key"
```

---

## What's Wired End-to-End

### API Key Lifecycle

```
Dashboard "Create Key" button
  │
  ├─ Convex mutation (Clerk auth) generates key
  ├─ SHA-256 hash stored in apiKeys table
  ├─ Full key shown once → user copies it
  │
  ▼
Developer uses key in SDK: new Qova("qova_xxx")
  │
  ├─ SDK sends Authorization: Bearer qova_xxx
  ├─ API middleware extracts token
  ├─ SHA-256 hash computed
  ├─ Cache check (5-min TTL)
  ├─ Cache miss → Convex query: apiKeyLookup.getByHash
  ├─ Scope check (agents:read, agents:write, etc.)
  ├─ lastUsedAt updated (fire-and-forget via HTTP action)
  │
  ▼
Request reaches route handler → response returned
```

### Scope Enforcement Matrix

| Endpoint | Method | Required Scope |
|----------|--------|---------------|
| `/api/agents` | GET | agents:read |
| `/api/agents/*` | GET | agents:read |
| `/api/agents/*` | POST | agents:write |
| `/api/scores/*` | GET/POST | scores:read |
| `/api/transactions/*` | GET | transactions:read |
| `/api/transactions/*` | POST | transactions:write |
| `/api/budgets/*` | GET | agents:read |
| `/api/budgets/*` | POST | agents:write |
| `/api/verify/*` | POST | agents:read |
| `/api/keys/*` | ALL | admin |
| `/api/health` | GET | none |
| `/api/docs` | GET | none |

Admin scope grants access to everything.

### Rate Limits

| Route Group | Limit |
|-------------|-------|
| Agents | 120 req/min |
| Scores | 120 req/min |
| Transactions | 60 req/min |
| Budgets | 60 req/min |
| Verify | 60 req/min |
| Keys | 20 req/min |

Rate limit keyed by API key prefix (per-key quotas). Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

The SDK automatically retries on 429 with exponential backoff.

### CORS

All origins allowed with standard headers. `Authorization` header exposed for browser-based SDK consumers. Preflight cached for 24h.

### Request Logging

Every request logged as structured JSON:

```json
{
  "level": "info",
  "requestId": "uuid",
  "method": "GET",
  "path": "/api/agents/0x...",
  "status": 200,
  "duration": 45,
  "keyPrefix": "qova_prod_8x",
  "timestamp": "2026-03-04T..."
}
```

`X-Request-Id` propagated from client or generated server-side.

---

## Files Modified (4 commits, 46 files)

### SDK (`sdk/`)
- `src/http/` — 12 files: fetch transport, error classes, typed resource modules, barrel export
- `src/cli/index.ts` — CLI tool with 8 commands
- `src/index.ts` — barrel export (HTTP SDK as default)
- `test/http-client.test.ts` — 21 tests
- `package.json` — bin field, dual exports
- `README.md` — HTTP SDK as primary interface
- `examples/` — 4 quickstart examples

### API (`api/`)
- `src/middleware/auth.ts` — Bearer token validation, scope checking, 5-min cache, lastUsedAt tracking
- `src/middleware/rate-limit.ts` — sliding window, per-key, standard headers
- `src/middleware/logger.ts` — structured JSON, X-Request-Id
- `src/routes/index.ts` — CORS, rate limiting, read/write scope split
- `src/routes/keys.ts` — key CRUD via Convex HTTP actions
- `src/routes/docs.ts` — OpenAPI 3.1 spec + Scalar UI
- `src/types/env.ts` — typed Hono context variables
- `test/` — 8 test files, shared helpers
- `.env.example` — documented env vars

### Dashboard (`dashboard/`)
- `convex/mutations/apiKeys.ts` — dual auth (Clerk + internal), touchLastUsed
- `convex/queries/apiKeys.ts` — listByUser with identity-based auth
- `convex/queries/apiKeyLookup.ts` — getByHash for API auth middleware
- `convex/http.ts` — HTTP action bridge (4 service-authenticated endpoints)
- `src/app/(dashboard)/developers/keys/page.tsx` — full CRUD UI with scope picker

---

## First Developer Experience

```bash
# 1. Install
npm install @qova/core

# 2. Initialize (key from dashboard)
import Qova from "@qova/core";
const qova = new Qova("qova_your_api_key");

# 3. Use
const { score, grade } = await qova.agents.score("0xAGENT");
const { verified } = await qova.verify("0xAGENT");
const { withinBudget } = await qova.budgets.check("0xAGENT", "1000000000");
```
