# CLAUDE.md — Qova Development Protocol

> You are the lead engineering AI for Qova, a decentralized credit bureau for autonomous AI agents. You have 11 specialized knowledge domains loaded below. Your mission is to audit, fix, and complete the entire Qova codebase to win the Chainlink Convergence Hackathon across 4 prize tracks worth $36,500+. Every change you make must be correct, production-grade, and aligned with the official documentation for each technology.

---

## PROJECT OVERVIEW

**Qova** computes verifiable reputation scores (0-1000) from on-chain transaction data using Chainlink CRE, then writes those scores back on-chain for any protocol to consume. Think Experian/TransUnion, but for AI agents.

**Hackathon Tracks:**
- CRE & AI ($10,500 1st) — AI-enhanced CRE workflows
- Risk & Compliance ($10,000 1st) — Automated risk monitoring + safeguards
- World ID with CRE ($3,000 1st) — World ID verification via CRE to Base
- Top 10 ($1,500 each) — Best overall CRE projects

**Repo:** https://github.com/brn-mwai/qova
**Team:** Brian Mwai (brian@hausorlabs.tech), Joy C. Lang'at (joy@hausorlabs.tech)
**Runtime:** Bun 1.3.6 | Monorepo: Turborepo | Linting: Biome

---

## MONOREPO STRUCTURE

```
qova/
├── contracts/       # Solidity smart contracts (Foundry) — Base Sepolia
├── sdk/             # TypeScript SDK (@qova/core)
├── api/             # REST API (Hono on Bun)
├── cre/             # Chainlink CRE workflows ← PRIMARY FOCUS
├── dashboard/       # Next.js 15 dashboard (app.qova.cc)
├── docs/            # Documentation site (docs.qova.cc)
├── www/             # Marketing site (qova.cc)
├── integrations/    # Framework stubs (LangGraph, CrewAI, n8n)
├── reference/       # Architecture decisions & planning
├── CLAUDE.md        # THIS FILE
└── .claude/         # Agent prompts + custom commands
```

---

## EXECUTION PRIORITY

Work in this exact order. Each phase builds on the previous:

### Phase 1: CRE Workflows (FOUNDATION)
**Files:** `cre/` — all 4 workflows
**Agent:** CRE Workflow Expert (#1)
**Goal:** Make every workflow simulate successfully via `cre workflow simulate`

### Phase 2: Smart Contracts
**Files:** `contracts/src/`
**Agents:** Smart Contracts (#5) + Cybersecurity (#10)
**Goal:** Contracts compile, pass tests, correctly receive CRE reports

### Phase 3: World ID × CRE
**Files:** `cre/agent-verify/`, `contracts/src/QovaVerificationConsumer.sol`, `dashboard/components/world-id/`
**Agent:** World ID × CRE (#2)
**Goal:** Full verification flow: IDKit → CRE workflow → on-chain

### Phase 4: AI Integration
**Files:** `cre/reputation-oracle/main.ts`
**Agent:** AI Integration (#4)
**Goal:** Add Gemini/LLM call in runInNodeMode to reputation scoring

### Phase 5: Risk & Compliance
**Files:** `cre/transaction-monitor/`, `cre/budget-alert/`
**Agents:** Risk & Compliance (#3) + Smart Contracts (#5)
**Goal:** Real detection → response loops with on-chain enforcement

### Phase 6: SKALE Integration
**Files:** `contracts/`, `sdk/`, `dashboard/`, `api/`
**Agent:** SKALE (#9)
**Goal:** Dual-chain deployment + x402 payment integration

### Phase 7: Dashboard & UI Polish
**Files:** `dashboard/`
**Agent:** Dashboard & UI (#11)
**Goal:** Every page works, data flows correctly, seed data present

### Phase 8: SDK & API Quality
**Files:** `sdk/`, `api/`
**Agent:** SDK & API (#6)
**Goal:** All endpoints work, types align, tests pass

### Phase 9: Security Review
**Files:** All
**Agent:** Cybersecurity (#10)
**Goal:** No hardcoded secrets, proper auth, input validation

### Phase 10: Documentation & Demo Prep
**Files:** `README.md`, `docs/`, `HACKATHON_SUBMISSION.md`
**Agents:** Documentation (#7) + Demo Video (#8)
**Goal:** README links all Chainlink files, video script ready

---

## RULES FOR ALL CODE CHANGES

### Universal Rules
1. **Never hallucinate APIs** — only use documented functions from the official SDK/library docs
2. **Run tests after changes** — `bun test` in the relevant package
3. **Use Biome for formatting** — `bun run lint` at root
4. **BigInt for all financial math** — NEVER use floats for scores, amounts, percentages
5. **No hardcoded secrets** — use env vars, .env files in .gitignore
6. **Explain what you changed** — comment your modifications

### CRE-Specific Rules
7. **`.result()` pattern** — NEVER use async/await for SDK capabilities
8. **`runtime.log()`** — NEVER use console.log (doesn't work in WASM)
9. **`runtime.now()`** — NEVER use Date.now() or new Date()
10. **HTTPClient in `runInNodeMode()` only** — with consensus aggregation
11. **`hexToBase64()`** on all EVM log trigger addresses/topics
12. **`padHex(value, { size: 32 })`** on indexed topic parameters
13. **Explicit `gasLimit`** on all `writeReport()` calls
14. **Zod config schemas** on all workflows

### Contract-Specific Rules
15. **ReceiverTemplate** for all CRE consumer contracts
16. **Replay protection** via report hash mapping
17. **Forwarder address** — different for simulation vs production
18. **Events with indexed params** for CRE log triggers

---

## PHASE 1: CRE WORKFLOWS — DETAILED INSTRUCTIONS

### Project Structure Required
```
cre/
├── project.yaml              # Global CRE config
├── secrets.yaml              # Secret declarations
├── .env                      # Local secrets (gitignored)
├── contracts/abi/            # TypeScript ABI definitions
│   ├── ReputationRegistry.ts
│   ├── TransactionValidator.ts
│   ├── BudgetEnforcer.ts
│   └── index.ts
├── reputation-oracle/
│   ├── package.json
│   ├── tsconfig.json
│   ├── workflow.yaml         # Optional overrides
│   └── main.ts               # Workflow code
├── transaction-monitor/
│   ├── package.json
│   ├── tsconfig.json
│   └── main.ts
├── budget-alert/
│   ├── package.json
│   ├── tsconfig.json
│   └── main.ts
├── agent-verify/
│   ├── package.json
│   ├── tsconfig.json
│   └── main.ts
└── shared/                   # Shared scoring logic
    ├── scoring.ts
    ├── anomaly.ts
    ├── budget.ts
    └── types.ts
```

### Step 1.1: Create project.yaml
```yaml
# cre/project.yaml
staging-settings:
  config:
    chainSelectorName: "base-testnet-sepolia"
    reputationRegistryAddress: "<FROM deployments/base-sepolia.json>"
    transactionValidatorAddress: "<FROM deployments/base-sepolia.json>"
    budgetEnforcerAddress: "<FROM deployments/base-sepolia.json>"
    consumerContractAddress: "<FROM deployments/base-sepolia.json>"
    gasLimit: "500000"
    schedule: "0 */10 * * * *"
  evm:
    chains:
      base-testnet-sepolia:
        rpc: "${BASE_SEPOLIA_RPC_URL}"
        private-key: "${PRIVATE_KEY}"
```

### Step 1.2: Create secrets.yaml
```yaml
# cre/secrets.yaml
secretsNames:
  AI_API_KEY:
    - AI_API_KEY_ENV
  WORLD_ID_APP_ID:
    - WORLD_ID_APP_ID_ENV
```

### Step 1.3: Create shared/types.ts
```typescript
// cre/shared/types.ts
export interface AgentMetrics {
  address: string
  totalVolume: bigint
  txCount: bigint
  successCount: bigint
  failureCount: bigint
  dailySpent: bigint
  dailyLimit: bigint
  monthlySpent: bigint
  monthlyLimit: bigint
  registeredAt: bigint
  currentScore: bigint
}

export interface ScoreResult {
  agent: string
  score: bigint
  changed: boolean
}

export interface AnomalyResult {
  isAnomaly: boolean
  anomalyType: "none" | "volume_spike" | "failure_burst" | "rapid_drain"
  severity: bigint
  details: string
}
```

### Step 1.4: Create shared/scoring.ts
```typescript
// cre/shared/scoring.ts
// ALL BIGINT — NO FLOATS — THIS IS BFT-SAFE

export const SCORE_WEIGHTS = {
  SUCCESS_RATE: 3000n,      // 30% in basis points
  TX_VOLUME: 2500n,         // 25%
  TX_COUNT: 2000n,          // 20%
  BUDGET_COMPLIANCE: 1500n, // 15%
  ACCOUNT_AGE: 1000n,       // 10%
} as const

export const MAX_SCORE = 1000n
export const MIN_SCORE_CHANGE = 10n // Gas optimization threshold

export function computeReputationScore(
  successCount: bigint,
  failureCount: bigint,
  totalVolume: bigint,
  txCount: bigint,
  dailySpent: bigint,
  dailyLimit: bigint,
  monthlySpent: bigint,
  monthlyLimit: bigint,
  accountAgeSec: bigint,
): bigint {
  const totalTxs = successCount + failureCount

  // Factor 1: Success Rate (0-1000)
  const successScore = totalTxs > 0n
    ? (successCount * MAX_SCORE) / totalTxs
    : 500n // Default for no transactions

  // Factor 2: Transaction Volume (log scale, 0-1000)
  // Use step function instead of log (no Math.log in BigInt)
  const volumeScore = volumeToScore(totalVolume)

  // Factor 3: Transaction Count (cap at 1000 txs for max score)
  const countCap = 1000n
  const countScore = txCount >= countCap
    ? MAX_SCORE
    : (txCount * MAX_SCORE) / countCap

  // Factor 4: Budget Compliance (0-1000)
  const budgetScore = computeBudgetCompliance(dailySpent, dailyLimit, monthlySpent, monthlyLimit)

  // Factor 5: Account Age (caps at 365 days)
  const ageCap = 365n * 24n * 60n * 60n // 365 days in seconds
  const ageScore = accountAgeSec >= ageCap
    ? MAX_SCORE
    : (accountAgeSec * MAX_SCORE) / ageCap

  // Weighted sum (basis points → final 0-1000)
  const weightedSum =
    (successScore * SCORE_WEIGHTS.SUCCESS_RATE +
     volumeScore * SCORE_WEIGHTS.TX_VOLUME +
     countScore * SCORE_WEIGHTS.TX_COUNT +
     budgetScore * SCORE_WEIGHTS.BUDGET_COMPLIANCE +
     ageScore * SCORE_WEIGHTS.ACCOUNT_AGE) / 10000n

  return weightedSum > MAX_SCORE ? MAX_SCORE : weightedSum
}

function volumeToScore(volume: bigint): bigint {
  // Step function approximating log scale (all BigInt)
  const eth1 = 1000000000000000000n // 1 ETH in wei
  if (volume >= eth1 * 1000n) return 1000n
  if (volume >= eth1 * 100n) return 900n
  if (volume >= eth1 * 10n) return 750n
  if (volume >= eth1) return 600n
  if (volume >= eth1 / 10n) return 400n
  if (volume >= eth1 / 100n) return 200n
  if (volume > 0n) return 100n
  return 0n
}

function computeBudgetCompliance(
  dailySpent: bigint,
  dailyLimit: bigint,
  monthlySpent: bigint,
  monthlyLimit: bigint,
): bigint {
  if (dailyLimit === 0n && monthlyLimit === 0n) return MAX_SCORE // No limits = fully compliant

  let complianceSum = 0n
  let factors = 0n

  if (dailyLimit > 0n) {
    const dailyUtilBps = (dailySpent * 10000n) / dailyLimit
    // Under 80% = full score, 80-100% = degraded, over 100% = 0
    if (dailyUtilBps <= 8000n) complianceSum += MAX_SCORE
    else if (dailyUtilBps <= 10000n) complianceSum += ((10000n - dailyUtilBps) * MAX_SCORE) / 2000n
    // else 0
    factors += 1n
  }

  if (monthlyLimit > 0n) {
    const monthlyUtilBps = (monthlySpent * 10000n) / monthlyLimit
    if (monthlyUtilBps <= 8000n) complianceSum += MAX_SCORE
    else if (monthlyUtilBps <= 10000n) complianceSum += ((10000n - monthlyUtilBps) * MAX_SCORE) / 2000n
    factors += 1n
  }

  return factors > 0n ? complianceSum / factors : MAX_SCORE
}
```

### Step 1.5: Create each workflow's package.json
```json
{
  "name": "reputation-oracle",
  "private": true,
  "dependencies": {
    "@chainlink/cre-sdk": "^1.1.2",
    "viem": "^2.34.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "@types/bun": "latest"
  }
}
```

### Step 1.6: Implement reputation-oracle/main.ts
Follow the CRE Workflow Expert Agent (Section 13.1) pattern exactly:
- CronCapability trigger at config.schedule
- EVMClient reads from 3 contracts (ReputationRegistry, TransactionValidator, BudgetEnforcer)
- Compute score using shared/scoring.ts
- Only write if delta >= MIN_SCORE_CHANGE
- runtime.report() → evmClient.writeReport() to consumer contract

### Step 1.7: Implement transaction-monitor/main.ts
Follow Risk & Compliance Agent (Section 3) pattern:
- EVMClient logTrigger on TransactionRecorded event
- Decode event, read context, run anomaly detection
- Alert via HTTPClient in runInNodeMode if anomaly detected
- Write anomaly report on-chain

### Step 1.8: Implement budget-alert/main.ts
- EVMClient logTrigger on BudgetUpdated/BudgetExceeded events
- Read utilization, check thresholds (80/90/100%)
- Write enforcement action on-chain

### Step 1.9: Implement agent-verify/main.ts
Follow World ID × CRE Agent (Section 7) pattern:
- HTTPCapability trigger (POST /verify-agent)
- Parse proof from body
- runInNodeMode: call World ID Cloud API with consensusIdenticalAggregation
- If verified: write to QovaVerificationConsumer on-chain

### Step 1.10: Verify with simulation
```bash
cd cre
bun install
cre workflow simulate reputation-oracle --target staging-settings
cre workflow simulate transaction-monitor --target staging-settings
cre workflow simulate budget-alert --target staging-settings
cre workflow simulate agent-verify --target staging-settings --http-payload '{"agent_address":"0x...","nullifier_hash":"0x...","merkle_root":"0x...","proof":"0x...","verification_level":"orb"}'
```

---

## PHASE 2: SMART CONTRACTS — DETAILED INSTRUCTIONS

### Required Contract Updates

#### QovaReputationConsumer.sol
Follow Smart Contracts Agent (Section 3). Must have:
- `ReceiverTemplate` extension
- `onReport()` with `_validateReport()` first
- Replay protection via `processedReports` mapping
- Score range validation (0-1000)
- Staleness check on timestamps
- `ScoreUpdated` event emission
- `getScore()` and `isScored()` view functions

#### QovaVerificationConsumer.sol (NEW)
Follow World ID × CRE Agent (Section 8). Must have:
- `ReceiverTemplate` extension
- Decode: `(address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp)`
- `usedNullifiers` mapping for sybil resistance
- `AgentVerified` event
- `isVerified()` view function

#### TransactionValidator.sol
Ensure events are properly indexed for CRE log triggers:
```solidity
event TransactionRecorded(address indexed agent, uint256 amount, bool success);
```

#### BudgetEnforcer.sol
Ensure events:
```solidity
event BudgetUpdated(address indexed agent, uint256 spent, uint256 limit);
event BudgetExceeded(address indexed agent, uint256 amount);
```

### Test
```bash
cd contracts
forge build
forge test
```

---

## PHASE 3: AI INTEGRATION — DETAILED INSTRUCTIONS

### Modify reputation-oracle/main.ts

Add AI behavioral analysis as a 6th scoring factor (15% weight, reduce others proportionally):

1. After reading on-chain data, call Gemini API in `runInNodeMode`
2. Use `ConsensusAggregationByFields` with median on numeric fields
3. Set `temperature: 0` for deterministic responses
4. Request JSON-only response (`responseMimeType: "application/json"`)
5. Combine AI risk_score with traditional score using BigInt math
6. Store AI API key as CRE secret

Follow AI Integration Agent (Section 3) code pattern exactly.

---

## PHASE 4: SKALE — DETAILED INSTRUCTIONS

### Integration Points

1. **SDK constants.ts**: Add SKALE Base chain config (chain ID 1187947933)
2. **Dashboard chain-selector**: Add SKALE Base option
3. **API**: Add x402 payment handling on premium endpoints
4. **Contracts**: Deploy same contracts to SKALE on Base (zero gas)
5. **State sync**: Service to bridge scores between Base Sepolia (CRE) and SKALE

Follow SKALE Integration Agent for all patterns.

---

## PHASE 5: DASHBOARD — DETAILED INSTRUCTIONS

### Critical Fixes to Verify

1. **Onboarding flow** (5 steps) completes and sets `onboardingComplete`
2. **Agent registration** creates Convex record via `chain.registerAgent`
3. **Score updates** propagate in real-time (Convex subscriptions)
4. **CRE page** seeds 4 workflows on mount, "Run Now" triggers /api/cre/execute
5. **World ID button** opens IDKit widget and sends proof
6. **Budget bars** color correctly at thresholds
7. **Chain selector** filters globally
8. **Seed data** present for demo (10 agents, 90 days of snapshots)

Follow Dashboard & UI Agent for every page's data sources and layout.

---

## PHASE 6: SECURITY — DETAILED INSTRUCTIONS

### Immediate Checks

1. **No hardcoded secrets**: `grep -r "private-key\|api_key\|secret" --include="*.ts" --include="*.sol" --include="*.yaml" .`
2. **`.env` in `.gitignore`**: Verify
3. **Public Convex mutations**: `syncFromChain` and `createServerExecution` — add input validation
4. **Webhook SSRF**: Validate URLs aren't internal IPs
5. **API key comparison**: Use timing-safe equality
6. **CORS**: Restrict to app.qova.cc

Follow Cybersecurity Agent for full threat model and checklist.

---

## PHASE 7: README — DETAILED INSTRUCTIONS

### Root README.md Must Include

```markdown
## Chainlink Integration Map

### CRE Workflows
| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Reputation Oracle | [cre/reputation-oracle/main.ts](./cre/reputation-oracle/main.ts) | Cron (10min) | AI-enhanced reputation scoring |
| Transaction Monitor | [cre/transaction-monitor/main.ts](./cre/transaction-monitor/main.ts) | EVM Log | Real-time anomaly detection |
| Budget Alert | [cre/budget-alert/main.ts](./cre/budget-alert/main.ts) | EVM Log | Budget threshold enforcement |
| Agent Verify | [cre/agent-verify/main.ts](./cre/agent-verify/main.ts) | HTTP | World ID verification via CRE |

### Smart Contracts
| Contract | File | Chainlink Usage |
|---|---|---|
| QovaReputationConsumer | [contracts/src/QovaReputationConsumer.sol](./contracts/src/QovaReputationConsumer.sol) | CRE report receiver |
| QovaVerificationConsumer | [contracts/src/QovaVerificationConsumer.sol](./contracts/src/QovaVerificationConsumer.sol) | World ID CRE receiver |
| CrossChainReputation | [contracts/src/CrossChainReputation.sol](./contracts/src/CrossChainReputation.sol) | CCIP cross-chain |
| PriceFeedConsumer | [contracts/src/PriceFeedConsumer.sol](./contracts/src/PriceFeedConsumer.sol) | Chainlink Data Feeds |

### CRE Configuration
| File | Purpose |
|---|---|
| [cre/project.yaml](./cre/project.yaml) | Global CRE config |
| [cre/secrets.yaml](./cre/secrets.yaml) | Secret declarations |
```

Follow Documentation Agent for full template.

---

## SERVICE QUOTAS TO RESPECT

| Quota | Limit | Impact |
|---|---|---|
| EVM reads per execution | 10 | Batch agent reads or paginate |
| HTTP calls per execution | 5 | AI call + alerts must fit in 5 |
| Execution timeout | 5 min | Score computation must finish |
| Cron minimum interval | 30 sec | 10-min schedule is fine |
| Report payload | 5 KB | Keep encoded data compact |
| Gas per tx | 5,000,000 | Set explicit gasLimit |
| Concurrent executions | 5 per owner | 4 workflows running is tight |
| Log line size | 1 KB | Keep runtime.log() messages short |

---

## CRE SDK QUICK REFERENCE

### Imports
```typescript
import {
  Runner, handler, CronCapability, HTTPCapability,
  EVMClient, HTTPClient, getNetwork, encodeCallMsg,
  bytesToHex, hexToBase64, protoBigIntToBigint,
  LAST_FINALIZED_BLOCK_NUMBER,
  consensusMedianAggregation, consensusIdenticalAggregation,
  ConsensusAggregationByFields,
  type Runtime, type NodeRuntime, type CronPayload, type EVMLog,
} from "@chainlink/cre-sdk"
```

### Workflow Template
```typescript
import { Runner, handler, CronCapability, type Runtime } from "@chainlink/cre-sdk"
import { z } from "zod"

const configSchema = z.object({ /* ... */ })
type Config = z.infer<typeof configSchema>

const onTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("Executing")
  // .result() pattern for all SDK calls
  return "done"
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
```

### Write Pattern
```typescript
// 1. Encode data
const encoded = encodeAbiParameters(parseAbiParameters("..."), [...])
// 2. Generate report
const report = runtime.report({
  encodedPayload: hexToBase64(encoded),
  encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256",
}).result()
// 3. Submit
const tx = evmClient.writeReport(runtime, {
  receiver: consumerAddress, report, gasConfig: { gasLimit: "500000" },
}).result()
```

### HTTP in Node Mode
```typescript
const result = runtime.runInNodeMode(
  (nodeRuntime: NodeRuntime<Config>) => {
    const http = new HTTPClient()
    return http.sendRequest(nodeRuntime, { url, method: "GET", headers }).result()
  },
  consensusIdenticalAggregation()
)().result()
```

---

## CLI COMMANDS

```bash
# CRE
cre login
cre init
cre workflow simulate <dir> --target staging-settings
cre workflow simulate <dir> --target staging-settings --broadcast
cre workflow deploy <dir> --target production-settings
cre workflow activate <dir> --target production-settings
cre secrets create secrets.yaml

# Foundry
cd contracts && forge build && forge test

# Monorepo
bun install          # Install all deps
bun run build        # Build all packages
bun run lint         # Biome lint
bun run test         # Run all tests

# Dashboard
cd dashboard && bun dev     # Dev server
npx convex dev              # Convex dev

# SDK
cd sdk && bun test          # 99 tests, 194 assertions

# API
cd api && bun dev           # Hono dev server
```

---

## HACKATHON SUBMISSION CHECKLIST

### Mandatory (ALL tracks)
- [ ] 3-5 min video showing workflows executing
- [ ] Public GitHub repo
- [ ] README links ALL Chainlink files
- [ ] CRE workflow integrates blockchain + external API/AI

### CRE & AI Track
- [ ] AI/LLM API called within CRE workflow (Gemini in runInNodeMode)
- [ ] AI contributes to scoring decision (not decorative)
- [ ] Temperature 0 for consensus determinism

### Risk & Compliance Track
- [ ] Anomaly detection → alert → on-chain enforcement loop
- [ ] Budget threshold monitoring with auto-enforcement
- [ ] Real protocol safeguard triggers (not just notifications)

### World ID Track
- [ ] CRE orchestrates World ID proof verification
- [ ] Multiple DON nodes verify proof independently
- [ ] Verification result written to Base (where CRE enables it)
- [ ] Sybil resistance via nullifier tracking

### Top 10
- [ ] 4 CRE workflows, 3 trigger types
- [ ] Professional codebase (tests, types, linting)
- [ ] Clear architecture documentation

---

## WHEN IN DOUBT

1. Check the CRE docs: https://docs.chain.link/cre
2. Check the SDK reference: https://docs.chain.link/cre/reference/sdk/overview
3. Check service quotas: https://docs.chain.link/cre/service-quotas
4. Check World ID docs: https://docs.world.org/world-id/concepts
5. Check SKALE docs: https://docs.skale.space/get-started
6. Run `cre workflow simulate` to test
7. Run `forge test` for contracts
8. Run `bun test` for SDK/API

**If a pattern isn't documented, say so. Do NOT hallucinate APIs.**
