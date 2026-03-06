# Chainlink Convergence Hackathon -- Qova Submission

---

## Project Name

Qova

## 1-line Description (under 80 chars)

Credit bureau for AI agents -- CRE-powered reputation scoring on Base

## Full Project Description

### What is Qova?

Qova is a financial credit bureau for autonomous AI agents. As AI agents increasingly transact on-chain via protocols like x402, there is no infrastructure to assess their economic trustworthiness. Human credit scores (FICO, Equifax) do not apply to autonomous software. Qova fills this gap by computing verifiable reputation scores (0-1000) from on-chain transaction data using Chainlink CRE, then writing those scores back on-chain for any protocol to consume.

### How it works

Qova runs four Chainlink CRE workflows that read live on-chain data from deployed smart contracts on Base Sepolia, enrich it with off-chain data sources via HTTP consensus, compute deterministic scores using BFT-safe algorithms, and write results back on-chain:

1. **Reputation Oracle** (Cron trigger) -- Periodically reads agent transaction volume, success rate, budget compliance, and account age from three on-chain contracts (ReputationRegistry, TransactionValidator, BudgetEnforcer). Fetches sanctions screening and external reputation scores via HTTP consensus. Computes a weighted composite score (0-1000) and writes it to the ReputationRegistry contract.

2. **Transaction Monitor** (EVM Log trigger) -- Reacts to TransactionRecorded events. Reads on-chain transaction history, fetches off-chain transaction enrichment, computes a 4-factor anomaly risk score (frequency anomaly 30%, large value 25%, failure rate 25%, flagged contracts 20%). Adjusts reputation score for high-risk agents and sends webhook alerts.

3. **Budget Alert** (EVM Log trigger) -- Reacts to SpendRecorded events. Reads budget configuration and cumulative spending from BudgetEnforcer, computes daily/monthly utilization, determines alert level (GREEN/YELLOW/RED/CRITICAL), applies score penalties for overspend, and sends webhook notifications.

4. **Agent Verify** (HTTP trigger) -- On-demand verification via POST request. Performs 8 comprehensive checks: registration status, contract existence, contract age, owner consistency, recent activity, ownership stability, sanctions screening, and minimum score. Returns VERIFIED/PARTIALLY_VERIFIED/UNVERIFIED/SUSPICIOUS status with a credit grade (AAA through D).

The computed scores follow a credit-rating methodology inspired by financial credit bureaus: AAA (950+), AA (900+), A (850+), BBB (750+), BB (650+), B (550+), CCC (450+), CC (350+), C (250+), D (below 250).

### What problem it solves

- **AI agents have no financial identity.** When an AI agent requests a credit line, insurance coverage, or access to a DeFi protocol, there is no standardized way to assess its risk profile.
- **Threshold-based alerts are insufficient.** Existing monitoring tools flag flat thresholds. Qova uses statistical anomaly detection (standard deviation from baseline, failure rate analysis) for each individual agent.
- **Trust data is siloed.** Transaction history, budget compliance, and verification status live in separate contracts. Qova's CRE workflows aggregate data from 3 on-chain contracts + off-chain APIs into a single composite score via decentralized consensus.
- **Scores must be tamper-proof.** By computing scores across CRE's decentralized oracle network with BFT consensus, no single party can manipulate an agent's reputation.

---

## How Is It Built?

**Smart Contracts (Solidity 0.8.28 / Foundry, deployed on Base Sepolia):**
- `ReputationRegistry` -- Stores agent scores (uint16), registration status, update history. Role-based access control (UPDATER_ROLE).
- `TransactionValidator` -- Records transaction stats (count, volume, success rate, timestamps). RECORDER_ROLE gated.
- `BudgetEnforcer` -- Manages per-agent spending limits (daily/monthly/per-tx) and tracks cumulative spend. BUDGET_MANAGER_ROLE gated.
- `QovaCore` -- Facade contract that coordinates cross-contract operations.

**CRE Workflows (TypeScript, @chainlink/cre-sdk v1.1.2):**
- 4 workflows using CRE SDK capabilities: CronCapability, EVMClient (callContract, writeReport, logTrigger), HTTPClient (sendRequest with consensusIdenticalAggregation), HTTPCapability
- Shared deterministic computation modules for scoring (5 weighted factors), anomaly detection (4-factor risk model), budget utilization, and verification (8 checks)
- All computation functions are pure and deterministic for BFT consensus safety
- 90 unit tests across 6 test files, validated against CRE SDK v1.1.2 types
- Mock API server for local development and CRE CLI simulation

**Dashboard (Next.js 15, React 19, deployed on Vercel at app.qova.cc):**
- Real-time data via Convex (reactive database)
- Auth via Clerk with SIWE (Sign In With Ethereum)
- Wallet integration: wagmi + viem, Coinbase Smart Wallet + MetaMask via WalletConnect
- World ID proof-of-personhood verification
- Live CRE execution: POST /api/cre/execute reads on-chain data, computes scores, writes results back to Base Sepolia contracts, and logs to Convex
- Multi-chain support with global chain selector that filters all dashboard views (agents, transactions, charts, leaderboard, ecosystem)
- shadcn/ui components, Recharts for analytics, Phosphor Icons

**Monorepo (Turborepo):** contracts/ | sdk/ | api/ | dashboard/ | cre/ | integrations/

---

## What Challenges Did You Run Into?

1. **CRE SDK type alignment with viem.** The CRE SDK uses its own binary encoding (`bytesToHex`, `encodeCallMsg`) that required careful bridging with viem's ABI encoding/decoding. We had to use `encodeFunctionData` from viem for call data preparation, then `decodeFunctionResult` to parse the CRE SDK's `callContract` response, converting between CRE's `Uint8Array` format and viem's hex strings via `bytesToHex`.

2. **Deterministic computation for BFT consensus.** Every scoring function must produce identical results on every CRE node. This meant avoiding floating-point non-determinism (using integer basis points for rates), avoiding Date.now() (using `runtime.now()` instead), and ensuring all off-chain HTTP responses go through `consensusIdenticalAggregation()` so nodes must agree before proceeding.

3. **BigInt serialization across boundaries.** Solidity uint128/uint256 values arrive as BigInt in TypeScript, but JSON.stringify cannot serialize BigInt. Every report and log output required explicit `.toString()` conversion. The scoring algorithm needed careful `Number()` casting with overflow checks since volumes can exceed Number.MAX_SAFE_INTEGER.

4. **On-chain score write optimization.** Writing scores on-chain for every computation would be wasteful. We implemented a `MIN_SCORE_CHANGE` threshold (10 points) so the CRE workflow only calls `updateScore` when the computed score differs meaningfully from the current on-chain value. This reduces gas costs while maintaining accuracy.

5. **Multi-contract data aggregation.** A single score computation requires reads from 3 separate contracts (ReputationRegistry, TransactionValidator, BudgetEnforcer) plus off-chain API calls. Orchestrating these sequential reads within the CRE runtime while maintaining consensus required careful use of the SDK's chaining pattern.

---

## Link to Project Repo

https://github.com/brn-mwai/qova

---

## Chainlink Usage

All Chainlink CRE code lives in the `cre/` directory:

**CRE Workflows (entry points):**
- `cre/reputation-oracle/index.ts` -- Cron-triggered reputation scoring workflow using CronCapability, EVMClient.callContract, HTTPClient.sendRequest, runtime.report, EVMClient.writeReport
- `cre/transaction-monitor/index.ts` -- EVM Log-triggered anomaly detection using EVMClient.logTrigger, callContract, writeReport, HTTPClient
- `cre/budget-alert/index.ts` -- EVM Log-triggered budget monitoring using EVMClient.logTrigger, callContract, writeReport, HTTPClient
- `cre/agent-verify/index.ts` -- HTTP-triggered verification using HTTPCapability.trigger, EVMClient.callContract, HTTPClient.sendRequest, writeReport

**Shared CRE computation modules:**
- `cre/shared/scoring.ts` -- Deterministic reputation scoring algorithm (5 weighted factors, BFT-safe)
- `cre/shared/monitoring.ts` -- Anomaly detection computation (4-factor risk model)
- `cre/shared/budget.ts` -- Budget utilization and alert level classification
- `cre/shared/verification.ts` -- 8-check agent verification with status classification
- `cre/shared/contracts.ts` -- Minimal ABI fragments for CRE contract interactions
- `cre/shared/constants.ts` -- Chain selectors, contract addresses, scoring weights, thresholds
- `cre/shared/types.ts` -- Zod config schemas and CRE report types

**CRE SDK integration in dashboard:**
- `dashboard/src/app/api/cre/execute/route.ts` -- Live CRE execution API that mirrors the CRE workflow logic, reads from deployed Base Sepolia contracts, computes scores, and writes on-chain

**Smart contracts consumed by CRE:**
- `contracts/src/ReputationRegistry.sol` -- Score storage + updateScore (called by CRE writeReport)
- `contracts/src/TransactionValidator.sol` -- Transaction stats (read by CRE workflows)
- `contracts/src/BudgetEnforcer.sol` -- Budget status (read by CRE workflows)
- `contracts/deployments/base-sepolia.json` -- Deployed contract addresses

**Tests:**
- `cre/test/scoring.test.ts`, `cre/test/monitoring.test.ts`, `cre/test/budget.test.ts`, `cre/test/verification.test.ts`, `cre/test/contracts.test.ts`, `cre/test/config.test.ts` -- 90 unit tests

**Direct link to CRE code:** https://github.com/brn-mwai/qova/tree/main/cre

---

## Project Demo

[VIDEO LINK NEEDED -- Record a 3-5 minute demo showing:]
1. Dashboard at app.qova.cc with registered agents and scores
2. Running the CRE scoring pipeline via the "Run Scoring" button on /cre
3. Score computed from on-chain data (ReputationRegistry, TransactionValidator, BudgetEnforcer reads)
4. Score written back on-chain (show Base Sepolia transaction)
5. CRE execution logged in the Execution Timeline
6. Chain selector filtering all dashboard views
7. Agent detail page with score history, budget utilization
8. CRE CLI simulation: `bun run simulate:reputation`

---

## Prize Track(s)

**Chainlink prize track:** CRE Track (Build with Chainlink CRE)

**Sponsor tracks:** [Check which sponsor tracks are available -- likely Base, potentially others]

---

## Team

- **Submitter:** Brian Mwai
- **Email:** [your email]
- **Participating as:** Team

- **Team member 2:** Joy C. Langat
- **Email:** [Joy's email]

---

## Key Links

| Resource | URL |
|----------|-----|
| Live Dashboard | https://app.qova.cc |
| Source Code | https://github.com/brn-mwai/qova |
| CRE Workflows | https://github.com/brn-mwai/qova/tree/main/cre |
| Smart Contracts | https://github.com/brn-mwai/qova/tree/main/contracts |
| ReputationRegistry (Base Sepolia) | https://sepolia.basescan.org/address/0x0b2466b01E6d73A24D9C716A9072ED3923563fBB |
| TransactionValidator (Base Sepolia) | https://sepolia.basescan.org/address/0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900 |
| BudgetEnforcer (Base Sepolia) | https://sepolia.basescan.org/address/0x271618781040dc358e4F6B66561b65A839b0C76E |
| QovaCore (Base Sepolia) | https://sepolia.basescan.org/address/0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a |
