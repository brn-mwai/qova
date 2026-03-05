# Budget Alert Workflow

## Trigger
**EVM Log** -- fires on `SpendRecorded` events from the BudgetEnforcer contract.

## Purpose
Monitors agent spending against configured budget limits. When a spend event is recorded,
reads the agent's full budget status from BudgetEnforcer, computes daily and monthly
utilization percentages, determines an alert level, and writes a budget report on-chain.
Sends webhook alerts for Yellow (70%+) utilization and above.

## Data Flow
1. EVM log trigger captures `SpendRecorded(address, uint128, uint128, uint128)` events
2. Read on-chain: `getBudgetStatus` from BudgetEnforcer (daily/monthly spent and remaining)
3. Read on-chain: current agent score from ReputationRegistry
4. Compute budget utilization:
   - Daily utilization: `dailySpent / (dailySpent + dailyRemaining)`
   - Monthly utilization: `monthlySpent / (monthlySpent + monthlyRemaining)`
   - Max utilization: higher of daily/monthly
5. Determine alert level from max utilization:
   - **GREEN**: <70% utilized
   - **YELLOW**: 70-90% utilized
   - **RED**: 90-100% utilized
   - **CRITICAL**: >100% (overspent)
6. Write budget report on-chain via CRE report (applies score penalty for CRITICAL)
7. If YELLOW or above: POST alert to configured webhook URL

## Score Impact
- CRITICAL overspend: -25 reputation score penalty
- All other levels: score preserved

## Configuration
See `config.json` for Base Sepolia defaults. Key fields:
- `evm.chainSelectorName` -- Target chain
- `evm.budgetEnforcer` -- Contract emitting events
- `evm.reputationRegistry` -- For score lookups and report writes
- `evm.qovaCore` -- Facade contract address
- `alertWebhookUrl` -- Webhook endpoint (required)
- `scoringApiUrl` -- Scoring API base URL

## Testing
```bash
bun test              # Unit tests (budget.test.ts)
bun run simulate:budget  # CRE local simulation
```
