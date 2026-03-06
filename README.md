# Qova

**Financial Trust Infrastructure for AI Agents**

Qova is a credit bureau for autonomous AI agents. As agents transact on-chain via protocols like x402, Qova computes verifiable reputation scores (0--1000) from on-chain transaction data using Chainlink CRE, then writes those scores back on-chain for any protocol to consume. Think Equifax, but for AI.

**Live dashboard:** [app.qova.cc](https://app.qova.cc)

---

## How It Works

```
                         Chainlink CRE Network
                        ┌─────────────────────┐
                        │  4 Decentralized     │
                        │  Scoring Workflows   │
                        └──────────┬──────────┘
                                   │ reads + writes
                                   v
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  @qova/core  │───>│  Smart       │<───│  Dashboard   │
│  TypeScript  │    │  Contracts   │    │  Next.js 15  │
│  SDK         │    │  Base Sepolia│    │  + Convex DB │
└──────────────┘    └──────────────┘    └──────────────┘
```

1. **AI agents transact on-chain** -- payments, service calls, budget draws.
2. **Smart contracts record everything** -- transaction volume, success rates, budget compliance, account age.
3. **Chainlink CRE workflows compute scores** -- 4 decentralized workflows aggregate on-chain + off-chain data across multiple oracle nodes with BFT consensus, producing tamper-proof scores.
4. **Scores are written back on-chain** -- any DeFi protocol, insurance provider, or lending platform can read an agent's credit score directly from the ReputationRegistry contract.
5. **The dashboard visualizes it all** -- real-time analytics, leaderboards, score history, budget monitoring, and live CRE execution.

### Credit Rating Scale

| Grade | Score Range | Meaning |
|-------|------------|---------|
| AAA | 950--1000 | Exceptional |
| AA | 900--949 | Excellent |
| A | 850--899 | Very Good |
| BBB | 750--849 | Good |
| BB | 650--749 | Fair |
| B | 550--649 | Adequate |
| CCC | 450--549 | Below Average |
| CC | 350--449 | Poor |
| C | 250--349 | Very Poor |
| D | 0--249 | Default Risk |

---

## Monorepo Structure

| Package | Description | Tech |
|---------|-------------|------|
| [`contracts/`](./contracts) | On-chain reputation, transactions, budgets | Solidity 0.8.28, Foundry, OpenZeppelin v5 |
| [`sdk/`](./sdk) | TypeScript SDK for protocol interaction | viem, Zod, ESM |
| [`api/`](./api) | REST API with 21 endpoints | Hono, Bun |
| [`dashboard/`](./dashboard) | Real-time analytics dashboard | Next.js 15, React 19, Convex, Clerk |
| [`cre/`](./cre) | Chainlink CRE scoring workflows | @chainlink/cre-sdk v1.1.2 |
| [`integrations/`](./integrations) | Framework plugins | LangGraph, CrewAI, n8n |

---

## Smart Contracts (Base Sepolia)

Four contracts deployed and verified on Base Sepolia:

| Contract | Address | Role |
|----------|---------|------|
| **ReputationRegistry** | [`0x0b2466b01E...563fBB`](https://sepolia.basescan.org/address/0x0b2466b01E6d73A24D9C716A9072ED3923563fBB) | Stores agent scores (0--1000), registration, update history |
| **TransactionValidator** | [`0x5d7a7AEAb2...e900`](https://sepolia.basescan.org/address/0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900) | Records transaction count, volume, success rate, timestamps |
| **BudgetEnforcer** | [`0x27161878...C76E`](https://sepolia.basescan.org/address/0x271618781040dc358e4F6B66561b65A839b0C76E) | Per-agent spending limits (daily/monthly/per-tx) and tracking |
| **QovaCore** | [`0x9Ee4ae0bD9...f76a`](https://sepolia.basescan.org/address/0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a) | Facade coordinating cross-contract operations |

**Chain ID:** 84532 | **Deployer:** `0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158`

All contracts use OpenZeppelin v5 AccessControl with role-based permissions:
- `UPDATER_ROLE` on ReputationRegistry (granted to QovaCore)
- `RECORDER_ROLE` on TransactionValidator (granted to QovaCore)
- `BUDGET_MANAGER_ROLE` on BudgetEnforcer (granted to QovaCore)

---

## Chainlink CRE Workflows

Four decentralized workflows in [`cre/`](./cre) built with `@chainlink/cre-sdk` v1.1.2:

### 1. Reputation Oracle (`cre/reputation-oracle/`)
- **Trigger:** Cron (configurable schedule)
- **Flow:** Reads agent data from 3 contracts, fetches off-chain enrichment via HTTP consensus, computes 5-factor weighted score, writes result on-chain
- **Scoring factors:** Transaction volume (25%), transaction count (20%), success rate (30%), budget compliance (15%), account age (10%)

### 2. Transaction Monitor (`cre/transaction-monitor/`)
- **Trigger:** EVM Log (`TransactionRecorded` events)
- **Flow:** Detects anomalies using 4-factor risk model, adjusts reputation for high-risk agents
- **Risk factors:** Frequency anomaly (30%), large value (25%), failure rate (25%), flagged contracts (20%)

### 3. Budget Alert (`cre/budget-alert/`)
- **Trigger:** EVM Log (`SpendRecorded` events)
- **Flow:** Computes daily/monthly utilization, classifies alert level (GREEN/YELLOW/RED/CRITICAL), applies score penalties

### 4. Agent Verify (`cre/agent-verify/`)
- **Trigger:** HTTP POST
- **Flow:** Runs 8 verification checks (registration, contract existence, age, owner consistency, activity, ownership stability, sanctions, minimum score)
- **Output:** VERIFIED / PARTIALLY_VERIFIED / UNVERIFIED / SUSPICIOUS + credit grade

All computation functions are pure and deterministic for BFT consensus safety. 90 unit tests across 6 test files.

---

## SDK (`@qova/core`)

The TypeScript SDK provides typed wrappers for all contract interactions. It is not published to npm -- install it from the monorepo workspace or import the source directly.

### Usage

```typescript
import { createQovaClient } from "@qova/core";

// Create a read-only client (no wallet needed)
const client = createQovaClient({ chain: "base-sepolia" });

// Read an agent's score
const score = await client.getScore("0x1234...");

// Check if an agent is registered
const registered = await client.isAgentRegistered("0x1234...");

// Get full agent details
const details = await client.getAgentDetails("0x1234...");

// Get transaction statistics
const stats = await client.getTransactionStats("0x1234...");

// Get budget status
const budget = await client.getBudgetStatus("0x1234...");
```

For write operations, pass a viem `WalletClient`:

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { createQovaClient } from "@qova/core";

const wallet = createWalletClient({
  account: privateKeyToAccount("0x..."),
  chain: baseSepolia,
  transport: http(),
});

const client = createQovaClient({
  chain: "base-sepolia",
  walletClient: wallet,
});

// Register a new agent
const txHash = await client.registerAgent("0xAgentAddress...");

// Update a score
await client.updateScore("0xAgent...", 750, "0x00...reason");

// Set budget limits (daily, monthly, per-tx in wei)
await client.setBudget("0xAgent...", 1000000n, 10000000n, 100000n);

// Record a transaction
await client.recordTransaction("0xAgent...", "0xTxHash...", 5000n, 0);
```

### SDK Exports

```typescript
// Client
import { createQovaClient } from "@qova/core";

// ABIs (for direct viem usage)
import { reputationRegistryAbi, transactionValidatorAbi } from "@qova/core/abi";

// Types + Zod schemas
import type { AgentDetails, BudgetStatus, TransactionStats } from "@qova/core/types";

// Utilities
import { getGrade, formatScore, shortenAddress } from "@qova/core/utils";
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- [Foundry](https://getfoundry.sh) (for contracts)

### Install and Build

```bash
# Clone the repo
git clone https://github.com/brn-mwai/qova.git
cd qova

# Install all dependencies
bun install

# Build all packages
bun run build

# Run all tests
bun run test

# Lint and format
bun run check
```

### Individual Packages

```bash
# Smart contracts
cd contracts && forge build && forge test -vvv

# SDK
cd sdk && bun run build && bun run test

# API (port 3001)
cd api && bun run dev

# Dashboard (port 3000)
cd dashboard && bun run dev

# CRE workflows (90 tests)
cd cre && bun test

# CRE local simulation
cd cre && bun run simulate:reputation
```

### Seed Demo Data

```bash
cd dashboard
npx convex dev                                     # start local Convex
npx convex run mutations/seed:seedDemoData         # seed locally
npx convex run mutations/seed:seedDemoData --prod  # seed production
```

---

## Environment Variables

### Dashboard (`dashboard/.env.local`)

```env
CONVEX_DEPLOYMENT=             # Convex deployment ID
NEXT_PUBLIC_CONVEX_URL=        # Convex HTTP endpoint
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # Clerk publishable key
CLERK_SECRET_KEY=              # Clerk secret key
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.basescan.org
```

### API (`api/.env`)

```env
RPC_URL=                       # Base Sepolia RPC endpoint
DEPLOYER_PRIVATE_KEY=          # Contract deployer wallet private key
PORT=3001
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin v5 |
| SDK | TypeScript 5.7, viem, Zod |
| API | Hono 4.7 on Bun |
| Dashboard | Next.js 15, React 19, Tailwind v4, shadcn/ui |
| Database | Convex (real-time) |
| Auth | Clerk + SIWE |
| Wallet | wagmi + viem, Coinbase Smart Wallet, MetaMask |
| Identity | World ID (proof-of-personhood) |
| Oracle | Chainlink CRE SDK v1.1.2 |
| Icons | Phosphor Icons |
| Charts | Recharts |
| Monorepo | Turborepo + Bun workspaces |
| Linting | Biome |

---

## Deployment

- **Dashboard:** Vercel at [app.qova.cc](https://app.qova.cc) (auto-deploys from `main`)
- **Contracts:** Foundry `forge script` with `--broadcast` to Base Sepolia
- **CRE Workflows:** Chainlink CRE Network
- **Database:** Convex Cloud

---

## Team

- **Brian Mwai** -- Architecture, smart contracts, CRE workflows, SDK, dashboard
- **Joy C. Langat** -- Research, testing, documentation

---

## License

MIT
