# Transaction Monitor Workflow

## Trigger
**EVM Log** -- fires on `TransactionRecorded` events from the TransactionValidator contract.

## Purpose
Monitors all agent transactions in real time. When a transaction event is detected,
reads on-chain transaction history, computes a composite anomaly risk score using
frequency analysis, large value detection, failure rate tracking, and flagged contract
interaction checks. Writes a monitoring report on-chain and sends webhook alerts for
elevated risk findings.

## Data Flow
1. EVM log trigger captures `TransactionRecorded(address, bytes32, uint256, uint8, uint48)` events
2. Read on-chain: current agent score from ReputationRegistry
3. Read on-chain: transaction statistics from TransactionValidator
4. HTTP consensus call: fetch transaction enrichment details from Scoring API
5. Parse transaction amount from log data
6. Compute anomaly report using 4 risk factors:
   - **Frequency anomaly**: >2 std deviations from baseline tx rate
   - **Large value anomaly**: >50% of historical average in a single tx
   - **Failure rate anomaly**: >20% failure rate
   - **Flagged contract interaction**: tx involves unverified/flagged address
7. Write monitoring report on-chain via CRE report (applies score penalty for high risk)
8. If risk is MEDIUM or above: POST alert to configured webhook URL

## Risk Scoring
Composite risk score (0-100) computed from weighted factors:
- Frequency anomaly: 30%
- Large value anomaly: 25%
- Failure rate anomaly: 25%
- Flagged contract anomaly: 20%

Severity levels: LOW (<25), MEDIUM (25-49), HIGH (50-74), CRITICAL (75+)

## Configuration
See `config.json` for Base Sepolia defaults. Key fields:
- `evm.chainSelectorName` -- Target chain
- `evm.transactionValidator` -- Contract emitting events
- `evm.reputationRegistry` -- For score lookups and report writes
- `evm.qovaCore` -- Facade contract address
- `scoringApiUrl` -- Transaction enrichment API
- `alertWebhookUrl` -- (optional) Webhook for alert delivery
- `rpcUrl` -- Base Sepolia RPC endpoint for direct queries

## Testing
```bash
bun test              # Unit tests (monitoring.test.ts)
bun run simulate:monitor  # CRE local simulation
```
