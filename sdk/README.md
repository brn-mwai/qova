# @qova/core

Financial trust infrastructure for AI agents. Check reputation scores, enforce budgets, and verify trust before your agents transact.

## Install

```bash
npm install @qova/core
# or
bun add @qova/core
```

## Quick Start

```ts
import Qova from "@qova/core";

const qova = new Qova("qova_your_api_key");

// Check an agent's reputation score
const { score, grade } = await qova.agents.score("0xAGENT_ADDRESS");
console.log(`Score: ${score}/1000 (${grade})`);

// Verify trust before a transaction
const { verified, sanctionsClean } = await qova.verify("0xAGENT_ADDRESS");

if (verified && sanctionsClean) {
  // Safe to transact
}
```

## API Reference

### `new Qova(apiKey, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `https://api.qova.cc` | API base URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `maxRetries` | `number` | `2` | Retry count on 5xx/network errors |
| `retryDelay` | `number` | `1000` | Base retry delay (ms, exponential backoff) |
| `headers` | `Record<string, string>` | `{}` | Custom headers on every request |

### Agents — `qova.agents`

```ts
// List all registered agents
const { agents, total } = await qova.agents.list();

// Get full details for an agent
const details = await qova.agents.get("0x...");

// Get score with grade
const { score, grade, gradeColor } = await qova.agents.score("0x...");

// Check registration status
const { isRegistered } = await qova.agents.isRegistered("0x...");

// Register a new agent (write)
const { txHash } = await qova.agents.register("0x...");

// Update an agent's score (write)
const { txHash } = await qova.agents.updateScore("0x...", 750, "0xREASON");

// Batch update scores
const { txHash, count } = await qova.agents.batchUpdateScores(
  ["0xA", "0xB"],
  [800, 650],
  ["0xR1", "0xR2"],
);
```

### Scores — `qova.scores`

```ts
// Full score breakdown with per-factor contributions
const breakdown = await qova.scores.breakdown("0x...");
// => { score, grade, factors: { transactionVolume, transactionCount, ... } }

// Compute a score from raw metrics (stateless, no chain read)
const { score, grade } = await qova.scores.compute({
  totalVolume: "5000000000000000000",
  transactionCount: 150,
  successRate: 9800,
  dailySpent: "100000000000000000",
  dailyLimit: "1000000000000000000",
  accountAgeSeconds: 2592000,
});

// Off-chain enrichment data
const enrichment = await qova.scores.enrich("0x...");

// Anomaly detection
const { anomalyDetected, riskScore } = await qova.scores.anomalyCheck(
  "0x...", "0xTXHASH", "1000000000000000000", 0,
);
```

### Budgets — `qova.budgets`

```ts
// Get current budget status
const status = await qova.budgets.get("0x...");

// Set spending limits (amounts in wei strings)
await qova.budgets.set("0x...", {
  dailyLimit: "1000000000000000000",
  monthlyLimit: "10000000000000000000",
  perTxLimit: "500000000000000000",
});

// Check if a spend is within budget
const { withinBudget } = await qova.budgets.check("0x...", "100000000000000000");

// Record a spend
await qova.budgets.recordSpend("0x...", "100000000000000000");
```

### Transactions — `qova.transactions`

```ts
// Get aggregate stats
const stats = await qova.transactions.stats("0x...");

// Record a transaction
await qova.transactions.record({
  agent: "0x...",
  txHash: "0x...",
  amount: "1000000000000000000",
  txType: 0,  // 0=Transfer, 1=Swap, 2=Stake, 3=Governance
});
```

### Verification — `qova.verify(agent)`

```ts
// One-call trust check (score + registration + sanctions)
const result = await qova.verify("0xAGENT");
// => { verified, score, grade, isRegistered, sanctionsClean, timestamp }

// Standalone sanctions screening
const { clean } = await qova.sanctionsCheck("0xAGENT");
```

### API Keys — `qova.keys`

```ts
// Create a new key (requires admin scope)
const { key } = await qova.keys.create({
  name: "Production",
  scopes: ["agents:read", "scores:read"],
});

// List all keys
const { keys } = await qova.keys.list();

// Revoke a key
await qova.keys.revoke("key_id");
```

### Health — `qova.health()`

```ts
const { status, chain, contracts } = await qova.health();
// status: "ok" | "degraded"
```

## CLI

The SDK includes a command-line tool for debugging during development.

```bash
# Set your key
export QOVA_API_KEY=qova_your_api_key

# Check a score
qova score 0xAGENT

# Verify trust
qova verify 0xAGENT

# Full score breakdown with visual bars
qova breakdown 0xAGENT

# Budget status
qova budget 0xAGENT

# API health
qova health

# Manage keys
qova keys list
qova keys create --name "My Key" --scopes agents:read,scores:read
qova keys revoke <id>
```

Or pass the key inline:

```bash
qova score 0xAGENT --key qova_your_api_key
```

## Error Handling

Every error is typed so you can handle specific failures:

```ts
import Qova, { QovaAuthError, QovaApiError, QovaRateLimitError, QovaNetworkError } from "@qova/core";

try {
  await qova.agents.score("0x...");
} catch (error) {
  if (error instanceof QovaAuthError) {
    // 401/403 — bad key or missing scope
  } else if (error instanceof QovaRateLimitError) {
    // 429 — retry after error.retryAfterMs
    await sleep(error.retryAfterMs);
  } else if (error instanceof QovaApiError) {
    // 4xx — error.status, error.code, error.body
  } else if (error instanceof QovaNetworkError) {
    // DNS failure, timeout, ECONNREFUSED
  }
}
```

| Error Class | When | Properties |
|-------------|------|-----------|
| `QovaAuthError` | Invalid/expired key, insufficient scope | `status`, `code` |
| `QovaRateLimitError` | Rate limit exceeded | `retryAfterMs` |
| `QovaApiError` | Any 4xx/5xx from API | `status`, `code`, `body` |
| `QovaNetworkError` | Timeout, DNS, connection failure | `cause` |
| `QovaConfigError` | Missing/invalid config at init | — |

## Advanced: On-Chain SDK

For direct smart contract interaction (requires a wallet):

```ts
import { createQovaClient } from "@qova/core/chain";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const wallet = createWalletClient({
  account: privateKeyToAccount("0xPRIVATE_KEY"),
  chain: baseSepolia,
  transport: http(),
});

const client = createQovaClient({
  chain: "base-sepolia",
  walletClient: wallet,
});

const score = await client.getScore("0xAGENT");
const txHash = await client.registerAgent("0xNEW_AGENT");
```

See the [chain SDK reference](./examples/quickstart.ts) for all available methods.

## Score Grades

| Grade | Range | Meaning |
|-------|-------|---------|
| AAA | 900-1000 | Exceptional trust |
| AA | 800-899 | Very high trust |
| A | 700-799 | High trust |
| BBB | 600-699 | Good trust |
| BB | 500-599 | Moderate trust |
| B | 400-499 | Below average |
| CCC | 300-399 | Low trust |
| CC | 200-299 | Very low trust |
| C | 100-199 | Poor trust |
| D | 0-99 | No trust / unrated |

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| ReputationRegistry | `0xe577C...` |
| TransactionValidator | `0x8f89B...` |
| BudgetEnforcer | `0x2543e...` |
| QovaCore | `0xd2BC2...` |

## License

MIT
