# Agent Verify Workflow

## Trigger
**HTTP** -- external services POST a verification request with an agent address.

## Purpose
Performs comprehensive on-demand agent verification. Reads on-chain registration,
reputation, transaction stats, and budget status. Fetches contract creation details
and runs sanctions screening off-chain. Executes 8 verification checks and returns
a verification attestation with status and credit grade.

## Data Flow
1. HTTP trigger receives `{ "agent": "0x..." }` as JSON input
2. Read on-chain: `isRegistered`, `getAgentDetails` from ReputationRegistry
3. Read on-chain: `getTransactionStats`, `getSuccessRate` from TransactionValidator
4. Read on-chain: `hasBudget` from BudgetEnforcer
5. HTTP consensus call: fetch contract metadata (creation tx, owner, bytecode)
6. HTTP consensus call: sanctions screening via Sanctions API
7. Run 8 verification checks:
   - **Registration**: Agent registered in ReputationRegistry
   - **Contract Exists**: Valid bytecode at agent address
   - **Contract Age**: Not freshly deployed (minimum 1 day)
   - **Owner Consistency**: Owner matches registration data
   - **Recent Activity**: Transactions in last 30 days
   - **Ownership Stability**: No suspicious transfers in 7-day window
   - **Sanctions Screening**: Not on sanctions lists
   - **Minimum Score**: Reputation >= 100
8. Compute verification status and credit grade
9. Write verification report on-chain via CRE report

## Verification Status
- **VERIFIED**: All 8 checks pass
- **PARTIALLY_VERIFIED**: 75%+ checks pass
- **UNVERIFIED**: <75% checks pass, or agent not registered
- **SUSPICIOUS**: Sanctions flagged, or recent ownership transfer with multiple failures

## Score Impact
- SUSPICIOUS: -100 reputation score penalty
- UNVERIFIED: -50 reputation score penalty
- VERIFIED/PARTIALLY_VERIFIED: score preserved

## Credit Grades
| Score Range | Grade |
|-------------|-------|
| 950-1000    | AAA   |
| 900-949     | AA    |
| 850-899     | A     |
| 750-849     | BBB   |
| 650-749     | BB    |
| 550-649     | B     |
| 450-549     | CCC   |
| 350-449     | CC    |
| 250-349     | C     |
| 0-249       | D     |

## Configuration
See `config.json` for Base Sepolia defaults. Key fields:
- `evm.chainSelectorName` -- Target chain
- `evm.reputationRegistry` / `transactionValidator` / `budgetEnforcer` -- Contract addresses
- `evm.qovaCore` -- Facade contract address
- `sanctionsApiUrl` -- Sanctions screening API endpoint
- `rpcUrl` -- Base Sepolia RPC endpoint for direct queries

## Testing
```bash
bun test              # Unit tests (verification.test.ts)
bun run simulate:verify  # CRE local simulation
```
