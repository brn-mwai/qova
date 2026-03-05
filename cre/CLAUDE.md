# cre/ -- Chainlink CRE Workflows

## Overview
Chainlink CRE (Compute Runtime Environment) workflows for decentralized reputation
scoring, transaction monitoring, budget alerts, and agent verification.
Built with @chainlink/cre-sdk v1.1.2, TypeScript, Bun runtime.

## Workflows

### reputation-oracle/
- **Trigger:** CronCapability (configurable schedule)
- **Flow:** Fetch agents -> read on-chain data -> off-chain enrichment -> compute score -> write on-chain
- **Output:** Updated ReputationRegistry score snapshot via CRE report

### transaction-monitor/
- **Trigger:** EVMClient.logTrigger (TransactionRecorded events)
- **Flow:** Capture event -> read tx stats -> off-chain enrichment -> compute anomaly risk score -> write report on-chain -> webhook alert
- **Output:** Monitoring report with risk score (0-100), anomaly flags, and on-chain score adjustment
- **Risk factors:** Frequency anomaly (30%), large value (25%), failure rate (25%), flagged contracts (20%)

### budget-alert/
- **Trigger:** EVMClient.logTrigger (SpendRecorded events)
- **Flow:** Capture event -> read budget status -> read agent score -> compute utilization -> write report on-chain -> webhook alert
- **Output:** Budget report with daily/monthly utilization, alert level (GREEN/YELLOW/RED/CRITICAL)

### agent-verify/
- **Trigger:** HTTPCapability (POST requests)
- **Flow:** Parse agent address -> read on-chain data -> fetch contract info -> sanctions check -> run 8 verification checks -> write report on-chain
- **Output:** Verification attestation with status (VERIFIED/PARTIALLY_VERIFIED/UNVERIFIED/SUSPICIOUS) and credit grade (AAA-D)

## Shared Modules (shared/)
- `constants.ts` -- Chain selectors, contract addresses, scoring weights, monitoring thresholds, budget alert levels, verification parameters
- `contracts.ts` -- Minimal ABI fragments for ReputationRegistry, TransactionValidator, BudgetEnforcer, QovaCore, QovaReputationConsumer
- `scoring.ts` -- Deterministic reputation scoring algorithm
- `monitoring.ts` -- Anomaly detection computation (frequency, value, failure rate, flagged contracts)
- `budget.ts` -- Budget utilization computation and alert level classification
- `verification.ts` -- Agent verification checks (8 checks) and status classification
- `types.ts` -- Zod config schemas + report types (MonitoringReport, BudgetReport, VerificationReport)

## CRE SDK Patterns
- `Runner.newRunner<Config>({ configSchema })` -> `runner.run(initWorkflow)`
- `initWorkflow(config)` returns array of `cre.handler(trigger, handlerFn)`
- EVM reads: `evmClient.callContract(runtime, { call, blockNumber }).result()`
- HTTP consensus: `httpClient.sendRequest(runtime, fn, consensusIdenticalAggregation())(args).result()`
- On-chain writes: `runtime.report(prepareReportRequest(data)).result()` -> `evmClient.writeReport(runtime, { receiver, report })`
- Log triggers: `evmClient.logTrigger({ addresses, topics })`
- Chain selector resolved via `getNetwork({ chainFamily, chainSelectorName, isTestnet })`

## Commands
```bash
bun test                       # Run unit tests (90 tests across 6 files)
bun run mock-api               # Start mock scoring API on :3001
bun run simulate:reputation    # CRE local simulation
bun run simulate:monitor
bun run simulate:budget
bun run simulate:verify
bun run check                  # Biome lint
bun run check:fix              # Biome lint + auto-fix
```

## Testing
- 90 unit tests across 6 files (scoring, contracts, config, monitoring, budget, verification)
- Mock API server for local development and simulation
- All workflows validated against CRE SDK v1.1.2 types
