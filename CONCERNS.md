# Qova — Comprehensive Concerns Audit

> Full security, code quality, testing, and architecture review across all packages.

---

## Table of Contents

- [1. Smart Contracts](#1-smart-contracts)
- [2. SDK (@brnmwai/qova-core)](#2-sdk-brnmwaiqova-core)
- [3. API (@qova/api)](#3-api-qovaapi)
- [4. CRE Workflows (Chainlink)](#4-cre-workflows-chainlink)
- [5. Dashboard (Next.js)](#5-dashboard-nextjs)
- [6. Integrations (LangGraph, CrewAI, n8n)](#6-integrations-langgraph-crewai-n8n)
- [7. CI/CD & Infrastructure](#7-cicd--infrastructure)
- [8. Priority Remediation Plan](#8-priority-remediation-plan)

---

## 1. Smart Contracts

### 1.1 Security Vulnerabilities

| # | Severity | Issue | File | Lines |
|---|----------|-------|------|-------|
| C-1 | **CRITICAL** | Silent refund failure — excess ETH stuck in contract with no event emitted | `contracts/src/CrossChainReputation.sol` | 219–224 |
| C-2 | **HIGH** | Missing zero-address validation in `CREReceiver` constructor — `address(0)` forwarder bypasses all access control | `contracts/src/base/CREReceiver.sol` | 18–20 |
| C-3 | **HIGH** | Missing zero-address validation in `QovaVerificationConsumer` constructor | `contracts/src/QovaVerificationConsumer.sol` | 87 |
| C-4 | **HIGH** | Unsafe `uint256` → `uint16` cast in `QovaReputationConsumer` — values > 65535 silently truncate even though they pass the `> 1000` check | `contracts/src/QovaReputationConsumer.sol` | 99, 106, 108 |
| C-5 | **HIGH** | Unsafe `int256` → `uint256` cast in PriceFeedConsumer — malicious oracle post-validation could cause underflow | `contracts/src/PriceFeedConsumer.sol` | 112–113 |
| C-6 | **MEDIUM** | `uint256` → `uint128` amount truncation without validation in `TransactionValidator.recordTransaction` | `contracts/src/TransactionValidator.sol` | 146–148 |
| C-7 | **MEDIUM** | Same `uint256` → `uint128` truncation in `QovaCore.executeAgentAction` — budget enforcement can be bypassed for amounts > 2^128 | `contracts/src/QovaCore.sol` | 172–173, 185 |
| C-8 | **MEDIUM** | Unbounded `_crossChainScores` array — no per-agent limit enables DoS via storage bloat | `contracts/src/CrossChainReputation.sol` | 277–282 |
| C-9 | **MEDIUM** | Replay protection event not indexed on `reportHash` — off-chain indexing cannot filter by both agent and hash | `contracts/src/QovaReputationConsumer.sol` | 88–92 |
| C-10 | **MEDIUM** | No nullifier hash format validation — arbitrary `uint256` accepted as World ID nullifier | `contracts/src/QovaVerificationConsumer.sol` | 114–115 |
| C-11 | **LOW** | `uint48` timestamp casting silently truncates after year 2106 | Multiple files | — |
| C-12 | **LOW** | Hardcoded CCIP gas limit (200,000) — not adjustable per chain without redeployment | `contracts/src/CrossChainReputation.sol` | 202, 248 |

### 1.2 Gas Optimization

| # | Issue | File | Estimated Savings |
|---|-------|------|-------------------|
| C-G1 | `storage` pointer used in `view` functions (`checkBudget`, `getBudgetStatus`) instead of `memory` | `contracts/src/BudgetEnforcer.sol` | ~4,200 gas/call |
| C-G2 | Double storage read in `getScore` — `_agents[agent]` read twice | `contracts/src/ReputationRegistry.sol` | ~2,100 gas/call |
| C-G3 | No max batch size in `batchUpdateScores` — gas limit revert is opaque | `contracts/src/ReputationRegistry.sol` | Prevents OOG reverts |
| C-G4 | `BudgetState` struct packing suboptimal — reordering saves one slot | `contracts/src/BudgetEnforcer.sol` | ~20,000 gas/setBudget |
| C-G5 | View function `getCrossChainScores` returns unbounded array — DoS for high-activity agents | `contracts/src/CrossChainReputation.sol` | Add pagination |

### 1.3 Testing Gaps

| # | Issue | Details |
|---|-------|---------|
| C-T1 | No boundary tests for daily/monthly reset timing (1 second before/after reset) | `test/BudgetEnforcer.t.sol` |
| C-T2 | No nullifier reuse tests after revocation with boundary values (0, `type(uint256).max`) | `test/QovaVerificationConsumer.t.sol` |
| C-T3 | No pause/unpause mid-operation or cross-contract pause tests | `test/QovaIntegration.t.sol` |
| C-T4 | No fuzz tests for large amounts, time jumps, or batch array sizes | All test files |
| C-T5 | No tests for batch update with duplicate agent addresses | `test/ReputationRegistry.t.sol` |
| C-T6 | No CCIP refund edge cases (contract recipient, OOG during refund) | `test/QovaCrossChainReputation.t.sol` |
| C-T7 | No price feed edge cases (1 wei, `type(uint128).max`, non-8-decimal feeds) | `test/QovaPriceFeedConsumer.t.sol` |
| C-T8 | No cross-contract state consistency tests (pause one while others operate) | All test files |
| C-T9 | No zero-forwarder constructor test | `test/QovaReputationConsumer.t.sol` |
| C-T10 | No invariant/property-based tests (`score ∈ [0,1000]`, `spent ≤ limit`) | None exist |

### 1.4 Best Practices

| # | Issue | Details |
|---|-------|---------|
| C-B1 | Inconsistent access control: some contracts use `AccessControl`, others `Ownable` | `QovaReputationConsumer` vs `ReputationRegistry` |
| C-B2 | No proxy/upgrade pattern — bugs require full redeployment | All core contracts |
| C-B3 | No state export/migration functions | All core contracts |
| C-B4 | Custom errors lack parameter info for debugging (e.g., `InvalidPrice()` vs `InvalidPrice(int256)`) | `contracts/src/PriceFeedConsumer.sol` |
| C-B5 | No initialization events in constructors | Most contracts |
| C-B6 | No batch event consolidation — large batches emit N individual events | `contracts/src/ReputationRegistry.sol` |
| C-B7 | Code duplication: `uint48(block.timestamp)` pattern repeated in 6+ contracts | Multiple files |
| C-B8 | Code duplication: period reset logic duplicated within BudgetEnforcer | `contracts/src/BudgetEnforcer.sol` |
| C-B9 | Inconsistent naming: `i_forwarder` (snake_case immutable) vs `reputationRegistry` (camelCase) | `CREReceiver` vs others |
| C-B10 | Hardcoded magic numbers (3600s stale price, 200k CCIP gas) — should be named constants | `PriceFeedConsumer`, `CrossChainReputation` |

### 1.5 Deployment

| # | Issue |
|---|-------|
| C-D1 | No post-deployment verification script |
| C-D2 | No constructor argument assertions in deploy script |
| C-D3 | No role assignment verification in deploy script |
| C-D4 | Missing `.env.example` entries for Chainlink addresses |
| C-D5 | No documented deployment checklist |

---

## 2. SDK (@brnmwai/qova-core)

### 2.1 Security

| # | Severity | Issue | File | Lines |
|---|----------|-------|------|-------|
| S-1 | **HIGH** | Unsafe `Record<string, unknown>` casting in event processing — properties accessed without existence/type validation | `sdk/src/events.ts` | 65, 100, 135 |
| S-2 | **MEDIUM** | Contract address resolution can cast `undefined` to `Address` when both config and defaults are partial objects | `sdk/src/client.ts` | 154–160 |
| S-3 | **MEDIUM** | No client-side validation of array length matching in `batchUpdateScores` before contract call | `sdk/src/contracts/reputation.ts` | 184–210 |
| S-4 | **LOW** | Hardcoded public RPC URLs as defaults without rate-limit documentation | `sdk/src/constants.ts` | 51–55 |

### 2.2 Error Handling

| # | Severity | Issue | File |
|---|----------|-------|------|
| S-E1 | **MEDIUM** | All contract functions catch errors generically — no differentiation between network, timeout, and contract revert | All contract files |
| S-E2 | **MEDIUM** | Event watchers have no error handler for RPC client creation failures | `sdk/src/events.ts` |
| S-E3 | **MEDIUM** | Generic `Error` thrown in events instead of typed `QovaError` | `sdk/src/events.ts` lines 56, 91, 126 |
| S-E4 | **LOW** | `Number()` conversions can produce NaN silently (e.g., `Number(a.oldScore)` when `a.oldScore` is undefined) | Multiple files |
| S-E5 | **MEDIUM** | Callback errors in event watchers propagate uncaught — no error boundary | `sdk/src/events.ts` |

### 2.3 Type Safety

| # | Severity | Issue | File |
|---|----------|-------|------|
| S-T1 | **HIGH** | Event args double-cast (`unknown` → `Address`, `unknown` → `bigint`) bypasses all type checking | `sdk/src/events.ts` |
| S-T2 | **MEDIUM** | Nullable contract address resolution — coalescing operator can return `undefined` cast to `Address` | `sdk/src/client.ts` |
| S-T3 | **MEDIUM** | No validation before `BigInt()` conversions — can throw on invalid input | Multiple contract files |

### 2.4 Code Quality

| # | Issue | File |
|---|-------|------|
| S-Q1 | Redundant `wallet.account ?? undefined` pattern (7 occurrences) | All contract files |
| S-Q2 | Identical error handling pattern duplicated in 13 contract functions — should extract shared helper | All contract files |
| S-Q3 | Score grade thresholds duplicated between `constants.ts` and `utils/score.ts` | `sdk/src/constants.ts`, `sdk/src/utils/score.ts` |
| S-Q4 | `mapContractError` always passes `"unknown"` for agent — loses debugging context | `sdk/src/types/errors.ts` |
| S-Q5 | Legacy `types.ts` (Zod schemas) appears unused — dead code | `sdk/src/types.ts` |
| S-Q6 | Inconsistent chain support: client supports `skale-base` but events module does NOT | `sdk/src/client.ts` vs `sdk/src/events.ts` |
| S-Q7 | No input validation for score values (0–1000) in `updateScore()` before sending to contract | `sdk/src/contracts/reputation.ts` |

### 2.5 Testing Gaps

| # | Issue |
|---|-------|
| S-TG1 | No integration tests for any contract function (getScore, registerAgent, updateScore, etc.) |
| S-TG2 | No error scenario tests (contract reverts, network errors, invalid addresses) |
| S-TG3 | Event tests only check unsubscribe function return — no actual event parsing, filtering, or type conversion tests |
| S-TG4 | No mocks for viem PublicClient/WalletClient |
| S-TG5 | No batch array length mismatch tests |
| S-TG6 | No tests for `skale-base` chain or custom contract partial overrides |

### 2.6 Performance

| # | Issue | File |
|---|-------|------|
| S-P1 | Each event watcher creates a new `PublicClient` — multiple watchers = multiple transport connections (potential memory leak) | `sdk/src/events.ts` |
| S-P2 | No memoization of client creation for identical configs | `sdk/src/client.ts` |

### 2.7 Dependencies

| # | Issue |
|---|-------|
| S-D1 | `viem: ^2.21.0` has no upper bound — breaking changes in 2.x can affect event structure |
| S-D2 | viem as regular dependency instead of peer dependency — consumers can't control version |

---

## 3. API (@qova/api)

### 3.1 Security

| # | Severity | Issue | File | Lines |
|---|----------|-------|------|-------|
| A-1 | **CRITICAL** | IP header spoofing bypasses rate limiter — `x-forwarded-for` and `x-real-ip` accepted without proxy trust validation | `api/src/middleware/rate-limit.ts` | 64–66 |
| A-2 | **CRITICAL** | `DEPLOYER_PRIVATE_KEY` loaded into memory without secure handling — no zeroing, appears in error logs if parsing fails | `api/src/services/chain.ts` | 64 |
| A-3 | **HIGH** | No replay protection for x402 payments — same authorization can be replayed indefinitely | `api/src/services/x402.ts` | 198–264 |
| A-4 | **HIGH** | Missing security headers (X-Frame-Options, X-Content-Type-Options, HSTS, CSP) | `api/src/app.ts` | 31–69 |
| A-5 | **MEDIUM** | Hardcoded USDC and payment addresses — cannot change without code redeploy | `api/src/services/x402.ts` | 16, 19 |
| A-6 | **MEDIUM** | `atob()` on untrusted X-Payment header with no length limit — potential DoS | `api/src/services/x402.ts` | 160–164 |
| A-7 | **MEDIUM** | No BigInt overflow/underflow validation on budget limit strings | `api/src/routes/budgets.ts` | 44–45 |
| A-8 | **MEDIUM** | CORS accepts both dev and production origins simultaneously | `api/src/app.ts` | 17–29 |
| A-9 | **MEDIUM** | No CSRF protection — relies on CORS only | All POST endpoints |
| A-10 | **MEDIUM** | Logger middleware logs all headers including `X-Payment` (contains base64 payment authorization) | `api/src/app.ts` | 67 |

### 3.2 Error Handling

| # | Issue | File |
|---|-------|------|
| A-E1 | `console.error` logs full error objects to stdout — internal details accessible via logs | `api/src/middleware/error.ts` |
| A-E2 | No error ID or request correlation for debugging | `api/src/middleware/error.ts` |
| A-E3 | `Promise.all()` without timeout — hanging RPC calls exhaust workers | `api/src/routes/scores.ts` |
| A-E4 | Validation errors return full Zod issue details — may reveal schema structure | `api/src/middleware/validate.ts` |
| A-E5 | Health check silently marks contracts as inaccessible — no error logging | `api/src/routes/health.ts` |

### 3.3 Code Quality

| # | Issue | File |
|---|-------|------|
| A-Q1 | Scoring algorithm duplicated between `api/src/services/scoring.ts` and `cre/shared/scoring.ts` — comment warns "MUST be synced manually" | `api/src/services/scoring.ts` |
| A-Q2 | Mock agent addresses (3 hardcoded) duplicated across 3 files | `app.ts`, `routes/agents.ts`, `routes/scores.ts` |
| A-Q3 | Normalization logic duplicated between route handler and enrichment service | `routes/scores.ts`, `services/enrichment.ts` |
| A-Q4 | Magic numbers without named constants (1e18, 1000, 0.8, 365, 86400) | `api/src/routes/scores.ts` |
| A-Q5 | Inconsistent HTTP status codes for similar write operations (201 vs 200) | `routes/agents.ts`, `routes/budgets.ts` |
| A-Q6 | High cyclomatic complexity in x402 payment verification (67 lines, 6 nested conditions) | `api/src/services/x402.ts` |
| A-Q7 | Inconsistent error response structure — some include `code`, some don't; some include `details` | Multiple middleware files |

### 3.4 Configuration

| # | Issue | File |
|---|-------|------|
| A-C1 | No runtime environment variable validation — missing RPC_URL causes undefined behavior | No validation layer |
| A-C2 | `DEPLOYER_PRIVATE_KEY` not validated for format before use — fails only on write operations | `api/src/services/chain.ts` |
| A-C3 | Default chain hardcoded to `base-sepolia` — cannot change without code modification | `api/src/services/chain.ts` |
| A-C4 | Server starts without verifying RPC connectivity or contract accessibility | `api/src/index.ts` |
| A-C5 | No separate staging/production config — only `NODE_ENV` checked for CORS | `api/src/app.ts` |

### 3.5 Performance

| # | Issue | File |
|---|-------|------|
| A-P1 | No request timeout on RPC calls — three parallel calls can hang indefinitely | `api/src/routes/scores.ts` |
| A-P2 | Unbounded in-memory cache — grows indefinitely, expired entries cleaned only every 60s | `api/src/middleware/cache.ts` |
| A-P3 | No cache invalidation after writes — reads return stale data | `api/src/routes/agents.ts` |
| A-P4 | In-memory rate limiter — doesn't scale across multiple API instances | `api/src/middleware/rate-limit.ts` |

### 3.6 API Design

| # | Issue |
|---|-------|
| A-D1 | No API versioning strategy — future breaking changes will affect all clients |
| A-D2 | No pagination on list endpoints — `GET /api/agents` returns hardcoded 3 agents |
| A-D3 | No request ID correlation — impossible to trace requests across services |
| A-D4 | No OpenAPI/Swagger specification |
| A-D5 | No rate limit documentation — clients don't know limits exist |
| A-D6 | No error code reference — codes like `AGENT_NOT_REGISTERED` not documented |

### 3.7 Testing Gaps

| # | Issue |
|---|-------|
| A-TG1 | No rate limit bypass tests (IP header spoofing) |
| A-TG2 | No x402 replay attack tests |
| A-TG3 | No BigInt overflow boundary tests |
| A-TG4 | No concurrent request tests (race conditions in cache/rate limiting) |
| A-TG5 | No CORS preflight tests |
| A-TG6 | No cache invalidation/expiration tests |
| A-TG7 | No authentication bypass tests — no tests verify payment gate on scores endpoint |
| A-TG8 | No load tests for rate limiter effectiveness |

---

## 4. CRE Workflows (Chainlink)

### 4.1 Security

| # | Severity | Issue | File |
|---|----------|-------|------|
| W-1 | **CRITICAL** | Hardcoded agent address — only one agent scored in production | `cre/reputation-oracle/main.ts` line 161 |
| W-2 | **HIGH** | Unvalidated HTTP response parsing — `JSON.parse(response.body)` then `.choices[0].message.content` without structure checks | `cre/reputation-oracle/main.ts` lines 137–139 |
| W-3 | **MEDIUM** | API key exposed in runtime logs — no header redaction | `cre/reputation-oracle/main.ts` line 121 |
| W-4 | **MEDIUM** | Authorization key optional on HTTP trigger — endpoint open to anyone if `authorizedKey` not configured | `cre/agent-verify/main.ts` lines 259–265 |
| W-5 | **MEDIUM** | Unvalidated decoded EVM data cast to `Record<string, number \| bigint \| boolean>` | `cre/agent-verify/main.ts` lines 106–115 |
| W-6 | **MEDIUM** | Secrets not validated at runtime — missing secrets fail silently | `cre/secrets.yaml` |

### 4.2 Logic Correctness

| # | Severity | Issue | File |
|---|----------|-------|------|
| W-L1 | **MEDIUM** | Score adjustment not idempotent — every CRITICAL alert reduces score by 25; multiple alerts collapse score to 0 | `cre/budget-alert/main.ts` line 145 |
| W-L2 | **MEDIUM** | Consensus ignores `behavioral_flags` — divergent nodes have different flags with no reconciliation (not BFT for behavior analysis) | `cre/reputation-oracle/main.ts` lines 315–318 |
| W-L3 | **MEDIUM** | Account age uses `lastActivityTimestamp` not creation time — new active agents get zero age | `cre/reputation-oracle/main.ts` lines 250–252 |
| W-L4 | **LOW** | Budget utilization can exceed 10000 bps — score jumps directly from partial to zero | `cre/shared/scoring.ts` line 104 |
| W-L5 | **LOW** | Volume scoring has large non-linear jump (600→400) at 0.1 ETH boundary | `cre/shared/scoring.ts` lines 85–95 |
| W-L6 | **LOW** | Hardcoded penalty amounts (25 points) and thresholds (7000/9000 bps) with no config | Multiple CRE files |

### 4.3 Error Handling

| # | Issue |
|---|-------|
| W-E1 | Missing try-catch on `evmClient.callContract()` and `httpClient.sendRequest()` in most workflows |
| W-E2 | No timeout configuration on HTTP clients |
| W-E3 | No retry logic — single network failure = workflow failure |
| W-E4 | AI integration failures don't differentiate network vs parsing vs rate-limit errors |

### 4.4 Configuration

| # | Issue |
|---|-------|
| W-C1 | Duplicate workflow implementations — `reputation-oracle/main.ts` and `reputation-oracle/index.ts` use different schemas |
| W-C2 | Hardcoded thresholds require code deploy to change — should be on-chain parameters |

### 4.5 Testing Gaps

| # | Issue |
|---|-------|
| W-TG1 | No AI consensus tests |
| W-TG2 | No end-to-end workflow simulation |
| W-TG3 | No failure scenario tests (malformed responses, timeouts, rate limits) |
| W-TG4 | No concurrency/race condition tests |

---

## 5. Dashboard (Next.js)

### 5.1 Security

| # | Severity | Issue | File |
|---|----------|-------|------|
| D-1 | **CRITICAL** | Zero test coverage — `"test": "echo 'No dashboard tests yet'"` | `dashboard/package.json` |
| D-2 | **HIGH** | No Content Security Policy (CSP) headers | `dashboard/next.config.ts` |
| D-3 | **HIGH** | `dangerouslySetInnerHTML` usage in onboarding page — XSS risk if content from untrusted source | `dashboard/src/app/(dashboard)/onboarding/page.tsx` |
| D-4 | **MEDIUM** | Optional Clerk config — if env vars missing, ALL routes (including webhooks) become public | `dashboard/src/middleware.ts` lines 13–18 |
| D-5 | **MEDIUM** | `DEPLOYER_PRIVATE_KEY` used in API route — could be exposed in error messages | `dashboard/src/app/api/cre/execute/route.ts` |
| D-6 | **MEDIUM** | Full API key displayed on screen (developers/keys page) — screenshot/recording risk | `dashboard/src/app/(dashboard)/developers/keys/page.tsx` lines 264–266 |
| D-7 | **MEDIUM** | World ID integration defaults to empty strings if env vars missing — verification silently fails | `dashboard/src/components/world-id/verify-button.tsx` |
| D-8 | **MEDIUM** | No CSRF protection explicit — forms use default Next.js handling | API routes |

### 5.2 State Management & Error Handling

| # | Issue |
|---|-------|
| D-S1 | No Error Boundary components — single component error crashes entire app |
| D-S2 | No input sanitization before state update — address validation only on button click |
| D-S3 | Convex data hooks have no response validation — malformed data breaks UI |
| D-S4 | No environment variable validation on startup |

### 5.3 Performance

| # | Issue |
|---|-------|
| D-P1 | 57 dependencies — estimated >500KB bundle, slow mobile first-load |
| D-P2 | Unoptimized PNG images (1MB+) — no WebP alternatives |
| D-P3 | No dynamic imports/code splitting visible |
| D-P4 | `scoreHistory.slice(0, 5)` called every render — should be memoized |

### 5.4 Accessibility

| # | Issue |
|---|-------|
| D-A1 | Missing alt text on images (logos, chain icons, integration logos) |
| D-A2 | Color-only rank indicators — not distinguishable for color-blind users |
| D-A3 | No keyboard navigation testing |

---

## 6. Integrations (LangGraph, CrewAI, n8n)

### 6.1 Security

| # | Issue | File |
|---|-------|------|
| I-1 | API key stored as plaintext in Python object — should use secure vault or per-request retrieval | `integrations/langgraph/src/qova_langchain/client.py` |
| I-2 | API key logged in HTTP headers — visible in debug mode or proxy logs | `integrations/langgraph/src/qova_langchain/client.py` line 62 |
| I-3 | Empty API key silently accepted — requests fail later without clear error | `integrations/langgraph/src/qova_langchain/client.py` line 53 |
| I-4 | Hardcoded test keys in test files | `integrations/langgraph/tests/test_tools.py` |

### 6.2 Error Handling

| # | Issue |
|---|-------|
| I-E1 | Broad `except Exception` hides real errors | `integrations/langgraph/src/qova_langchain/client.py` |
| I-E2 | No retry logic — single network failure = tool failure |
| I-E3 | httpx exceptions not explicitly handled in CrewAI client |

### 6.3 Testing Gaps

| # | Issue |
|---|-------|
| I-TG1 | Only basic client initialization tests — no API call simulation |
| I-TG2 | No error scenario, rate limiting, timeout, or malformed response tests |
| I-TG3 | n8n node has structure tests only — no execution tests |

### 6.4 n8n Specific

| # | Issue | File |
|---|-------|------|
| I-N1 | Hardcoded base URL (`https://api.qova.cc`) — hard to override for self-hosted | `integrations/n8n/src/credentials/QovaApi.credentials.ts` |
| I-N2 | Password field may not hide API key in all n8n versions | `integrations/n8n/src/credentials/QovaApi.credentials.ts` line 18 |

---

## 7. CI/CD & Infrastructure

### 7.1 Workflow Gaps

| # | Severity | Issue |
|---|----------|-------|
| CI-1 | **HIGH** | Only one CI workflow exists (`publish-sdk.yml`) — no CI for API, dashboard, contracts, CRE, or integrations |
| CI-2 | **HIGH** | No dependency vulnerability scanning (npm audit, safety check) |
| CI-3 | **MEDIUM** | No SAST (static application security testing) |
| CI-4 | **MEDIUM** | No load/performance testing |
| CI-5 | **MEDIUM** | Version already-published check insufficient — doesn't handle version reverts |

### 7.2 Build Configuration

| # | Issue | File |
|---|-------|------|
| CI-B1 | `turbo.json`: `check` (linting) has no task dependencies — tests can run without passing lint | `turbo.json` |
| CI-B2 | `tsconfig.json`: `skipLibCheck: true` skips validation of dependency type definitions | `tsconfig.json` |
| CI-B3 | Root `package.json`: `turbo` and `@biomejs/biome` pinned to `"latest"` — breaking changes uncontrolled | `package.json` |
| CI-B4 | Mixed package managers: Bun configured but npm used in some workflows — potential lock-file conflicts | `package.json`, `publish-sdk.yml` |

### 7.3 Biome Linter

| # | Issue | File |
|---|-------|------|
| CI-L1 | Only `suspicious.noExplicitAny` rule overridden — no security, accessibility, or complexity rules enabled | `biome.json` |
| CI-L2 | CSS linting disabled | `biome.json` |

### 7.4 Missing Documentation

| # | Issue |
|---|-------|
| CI-D1 | No `SECURITY.md` (security model, threat model, incident response) |
| CI-D2 | No deployment guide (dashboard, API, CRE workflows, secrets configuration) |
| CI-D3 | No API rate limit documentation for consumers |
| CI-D4 | No contract architecture/governance documentation |
| CI-D5 | No error code reference for API clients |

---

## 8. Priority Remediation Plan

### Immediate (Week 1) — Critical & High

1. **C-2, C-3**: Add zero-address validation in `CREReceiver` and `QovaVerificationConsumer` constructors
2. **C-4**: Fix unsafe `uint256` → `uint16` cast with intermediate bounds re-check
3. **C-1**: Emit event on refund failure in `CrossChainReputation`
4. **A-1**: Validate trusted proxies for `x-forwarded-for` header
5. **A-3**: Implement nonce tracking for x402 replay protection
6. **A-4**: Add security headers middleware (X-Frame-Options, HSTS, CSP)
7. **W-1**: Make agent address dynamic (config/registry-driven)
8. **W-2**: Add response structure validation for all HTTP calls
9. **D-1**: Set up dashboard testing infrastructure (Vitest + React Testing Library)
10. **D-2**: Add Content Security Policy headers
11. **CI-1**: Add CI workflows for API, contracts, dashboard, CRE

### Short-term (Week 2–3) — Medium

12. **C-6, C-7**: Add `uint128` overflow validation before casting
13. **C-8**: Add per-agent limit to `_crossChainScores` array
14. **S-1**: Replace unsafe `Record<string, unknown>` event casting with type guards
15. **S-Q6**: Add `skale-base` support to events module (or remove from client)
16. **A-Q1**: Extract shared scoring module to eliminate duplication
17. **A-C1**: Add startup environment variable validation
18. **A-P1**: Add request timeouts to all RPC calls
19. **W-L1**: Make score penalties idempotent (track penalized state)
20. **D-4**: Require Clerk config — don't silently disable auth
21. **CI-2**: Add dependency vulnerability scanning to CI

### Medium-term (Month 2) — Improvements

22. **C-G1–G5**: Gas optimizations (storage → memory in views, struct packing, batch limits)
23. **C-B1**: Standardize on `AccessControl` for all contracts
24. **C-B2**: Evaluate UUPS proxy pattern for core contracts
25. **S-TG1–TG6**: Add comprehensive SDK integration tests
26. **A-TG1–TG8**: Add API security and edge case tests
27. **W-TG1–TG4**: Add CRE workflow integration tests
28. **D-P1–P4**: Dashboard performance optimization (code splitting, image optimization)
29. **CI-D1–D5**: Write missing documentation (security model, deployment, architecture)

---

> **Total concerns identified: 200+** across security (40+), testing (35+), code quality (30+), error handling (20+), performance (15+), configuration (15+), API design (10+), documentation (15+), deployment (10+), and dependencies (10+).
