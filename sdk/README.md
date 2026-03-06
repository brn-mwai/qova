# @brnmwai/qova-core

TypeScript SDK for the **Qova protocol** -- financial trust infrastructure for AI agents.

Qova computes on-chain credit scores (0--1000) for autonomous AI agents by analyzing their transaction history, budget adherence, and behavioral patterns. Think of it as a credit bureau, but for AI agents operating in DeFi.

[![npm](https://img.shields.io/npm/v/@brnmwai/qova-core)](https://www.npmjs.com/package/@brnmwai/qova-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](https://github.com/brn-mwai/qova/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Full type safety** -- strict TypeScript with Zod runtime validation
- **Tree-shakeable** -- ESM-only, named exports, side-effect free
- **viem-native** -- built on [viem](https://viem.sh), not ethers.js
- **Multi-chain** -- Base Sepolia (testnet), Base Mainnet, SKALE Europa
- **4 contract modules** -- ReputationRegistry, TransactionValidator, BudgetEnforcer, QovaCore
- **Event watchers** -- real-time subscription to on-chain events
- **Zero config** -- deployed contract addresses baked in, just pick a chain

## Installation

```bash
npm install @brnmwai/qova-core viem
```

```bash
bun add @brnmwai/qova-core viem
```

```bash
pnpm add @brnmwai/qova-core viem
```

> `viem` is a peer dependency and must be installed alongside.

## Quick Start

### Read an agent's credit score

```ts
import { createQovaClient } from "@brnmwai/qova-core";

const qova = createQovaClient({ chain: "base-sepolia" });

const score = await qova.getScore("0x1234...abcd");
console.log(score); // 847
```

### Register an agent and record a transaction

```ts
import { createQovaClient, TransactionType } from "@brnmwai/qova-core";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const qova = createQovaClient({
  chain: "base-sepolia",
  walletClient,
});

// Register the agent on-chain
const regTx = await qova.registerAgent(account.address);

// Record a payment transaction
const recTx = await qova.recordTransaction(
  account.address,
  "0xabc...def", // transaction hash
  1000000n, // amount in wei
  TransactionType.PAYMENT,
);

// Check the score after CRE workflow runs
const score = await qova.getScore(account.address);
```

### Set budget limits

```ts
import { parseEther } from "viem";

// Set daily, monthly, and per-transaction limits
await qova.setBudget(
  agentAddress,
  parseEther("1"), // 1 ETH daily
  parseEther("10"), // 10 ETH monthly
  parseEther("0.5"), // 0.5 ETH per tx
);

// Check if a spend is within limits
const allowed = await qova.checkBudget(agentAddress, parseEther("0.3"));

// Get full budget status
const status = await qova.getBudgetStatus(agentAddress);
console.log(status);
// { dailyLimit, monthlyLimit, perTxLimit, dailySpent, monthlySpent, ... }
```

### Watch events in real-time

```ts
import { watchScoreUpdates, watchTransactions } from "@brnmwai/qova-core";

// Watch all score changes
const unwatch = watchScoreUpdates(
  { chain: "base-sepolia" },
  (event) => {
    console.log(`${event.agent}: ${event.oldScore} -> ${event.newScore}`);
  },
);

// Watch transactions for a specific agent
const unwatchTx = watchTransactions(
  { chain: "base-sepolia", agent: "0x1234...abcd" },
  (event) => {
    console.log(`Tx recorded: ${event.txHash} (${event.amount} wei)`);
  },
);

// Stop watching
unwatch();
unwatchTx();
```

## API Reference

### `createQovaClient(config)`

Creates a typed client with all protocol methods.

```ts
type QovaClientConfig = {
  chain: "base-sepolia" | "base" | "skale-europa";
  rpcUrl?: string; // Override default RPC
  walletClient?: WalletClient; // Required for write operations
  contracts?: Partial<ContractAddresses>; // Override deployed addresses
};
```

**Returns** a `QovaClient` with these methods:

#### Reputation

| Method | Type | Description |
|--------|------|-------------|
| `getScore(agent)` | read | Get score (0--1000) |
| `getAgentDetails(agent)` | read | Full agent struct (score, grade, tx count, timestamps) |
| `isAgentRegistered(agent)` | read | Check registration status |
| `registerAgent(agent)` | write | Register a new agent |
| `updateScore(agent, score, reason)` | write | Update an agent's score |
| `batchUpdateScores(agents[], scores[], reasons[])` | write | Batch score update |

#### Transactions

| Method | Type | Description |
|--------|------|-------------|
| `recordTransaction(agent, txHash, amount, txType)` | write | Record a transaction |
| `getTransactionStats(agent)` | read | Aggregate stats (count, volume, success rate) |

#### Budget

| Method | Type | Description |
|--------|------|-------------|
| `setBudget(agent, daily, monthly, perTx)` | write | Set spending limits |
| `checkBudget(agent, amount)` | read | Check if spend is within limits |
| `recordSpend(agent, amount)` | write | Record a spend against budget |
| `getBudgetStatus(agent)` | read | Get remaining allowances |

#### Core

| Method | Type | Description |
|--------|------|-------------|
| `executeAgentAction(agent, txHash, amount, txType)` | write | Execute action through QovaCore orchestrator |

### Score Grades

Scores map to letter grades following a credit rating system:

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

### Transaction Types

```ts
import { TransactionType } from "@brnmwai/qova-core";

TransactionType.PAYMENT; // 0
TransactionType.SWAP; // 1
TransactionType.TRANSFER; // 2
TransactionType.CONTRACT_CALL; // 3
TransactionType.BRIDGE; // 4
```

## Sub-path Exports

The SDK exposes granular imports for tree-shaking:

```ts
// Contract ABIs only
import { reputationRegistryAbi, budgetEnforcerAbi } from "@brnmwai/qova-core/abi";

// Type definitions and Zod schemas
import type { AgentDetails, BudgetStatus } from "@brnmwai/qova-core/types";
import { AgentDetailsSchema, TransactionType } from "@brnmwai/qova-core/types";

// Utility functions
import { getGrade, getScoreColor, formatScore } from "@brnmwai/qova-core/utils";
import { shortenAddress, isValidAddress } from "@brnmwai/qova-core/utils";
import { formatWei, formatBasisPoints } from "@brnmwai/qova-core/utils";
```

## Utilities

### Score Utilities

```ts
import { getGrade, getScoreColor, formatScore, scoreToPercentage } from "@brnmwai/qova-core";

getGrade(950); // "AAA"
getGrade(720); // "BB"
getScoreColor(800); // "#22C55E" (green)
getScoreColor(500); // "#FACC15" (yellow)
getScoreColor(200); // "#EF4444" (red)
formatScore(42); // "0042"
scoreToPercentage(750); // 75
```

### Address Utilities

```ts
import { shortenAddress, isValidAddress, checksumAddress } from "@brnmwai/qova-core";

shortenAddress("0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"); // "0x0a3A...1158"
isValidAddress("0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158"); // true
checksumAddress("0x0a3af9a104bd2b5d96c7e24fe95cc03432431158"); // "0x0a3A..."
```

### Format Utilities

```ts
import { formatWei, formatTimestamp, formatBasisPoints } from "@brnmwai/qova-core";

formatWei(1500000000000000000n); // "1.5"
formatWei(1000000n, 6); // "1.0" (USDC)
formatTimestamp(1709000000n); // Date object
formatBasisPoints(9750); // "97.50%"
```

## Error Handling

The SDK throws typed errors that map to Solidity custom errors:

```ts
import {
  QovaError,
  AgentNotRegisteredError,
  BudgetExceededError,
  InvalidScoreError,
} from "@brnmwai/qova-core";

try {
  await qova.getScore("0x...");
} catch (error) {
  if (error instanceof AgentNotRegisteredError) {
    console.log(error.code); // "AGENT_NOT_REGISTERED"
  }
  if (error instanceof BudgetExceededError) {
    console.log(error.requested); // bigint
    console.log(error.available); // bigint
  }
}
```

All error classes extend `QovaError` with a `.code` string:

| Error Class | Code | Trigger |
|------------|------|---------|
| `AgentNotRegisteredError` | `AGENT_NOT_REGISTERED` | Operating on unregistered agent |
| `AgentAlreadyRegisteredError` | `AGENT_ALREADY_REGISTERED` | Double registration |
| `BudgetExceededError` | `BUDGET_EXCEEDED` | Spend exceeds limits |
| `InvalidScoreError` | `INVALID_SCORE` | Score outside 0--1000 |
| `UnauthorizedError` | `UNAUTHORIZED` | Missing required role |

## Deployed Contracts

### Base Sepolia (Chain ID: 84532)

| Contract | Address |
|----------|---------|
| ReputationRegistry | `0x0b2466b01E6d73A24D9C716A9072ED3923563fBB` |
| TransactionValidator | `0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900` |
| BudgetEnforcer | `0x271618781040dc358e4F6B66561b65A839b0C76E` |
| QovaCore | `0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a` |

## Architecture

```
@brnmwai/qova-core
  |-- client.ts          # createQovaClient factory
  |-- constants.ts       # Chain IDs, contract addresses, score thresholds
  |-- events.ts          # Real-time event watchers
  |-- contracts/
  |   |-- reputation.ts  # ReputationRegistry interactions
  |   |-- transactions.ts# TransactionValidator interactions
  |   |-- budget.ts      # BudgetEnforcer interactions
  |   |-- core.ts        # QovaCore orchestrator
  |-- types/
  |   |-- agent.ts       # AgentDetails, ScoreGrade
  |   |-- budget.ts      # BudgetConfig, BudgetStatus
  |   |-- config.ts      # QovaClientConfig, ContractAddresses
  |   |-- errors.ts      # Typed error classes
  |   |-- events.ts      # Event types
  |   |-- transaction.ts # TransactionType, TransactionStats
  |-- abi/               # Contract ABIs (auto-generated from Foundry)
  |-- utils/
      |-- score.ts       # Grade, color, formatting
      |-- address.ts     # Shorten, validate, checksum
      |-- format.ts      # Wei, timestamps, basis points
```

## How Qova Works

1. **Register** -- AI agents are registered on-chain via `ReputationRegistry`
2. **Transact** -- Agent transactions are recorded via `TransactionValidator`
3. **Budget** -- Spending limits are enforced via `BudgetEnforcer`
4. **Score** -- Chainlink CRE workflows analyze on-chain + off-chain data and compute a weighted credit score (0--1000), written back on-chain
5. **Consume** -- Anyone can read an agent's score from the contract. DeFi protocols, lenders, and insurance providers use scores for underwriting decisions.

## Requirements

- Node.js 18+
- TypeScript 5.7+ (for strict mode)
- `viem` ^2.21.0

## Contributing

This SDK is part of the [Qova monorepo](https://github.com/brn-mwai/qova). To develop locally:

```bash
git clone https://github.com/brn-mwai/qova.git
cd qova/sdk
bun install
bun run build
bun run test
```

## License

MIT -- see [LICENSE](https://github.com/brn-mwai/qova/blob/main/LICENSE)
