# CRE Workflows -- Development Protocol

> Source of truth: `.claude/agents/01-cre-workflow.md` (1189 lines)

## Mandatory Workflow Structure

Every CRE workflow MUST follow this pattern:

```typescript
import { Runner, handler, CronCapability, type Runtime } from "@chainlink/cre-sdk"
import { z } from "zod"

// 1. Zod config schema
const configSchema = z.object({ /* ... */ })
type Config = z.infer<typeof configSchema>

// 2. Callback (stateless, runs on every node)
const onTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("Executing")
  return "done"
}

// 3. initWorkflow returns handler array
const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onTrigger)]
}

// 4. main() entry point
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
```

## The .result() Pattern (MANDATORY)

Traditional async/await does NOT work in WASM. ALL SDK capabilities:

```typescript
// Chain .result() on every SDK call
const response = httpClient.sendRequest(runtime, { ... }).result()
const data = evmClient.callContract(runtime, { ... }).result()
const report = runtime.report({ ... }).result()
const secret = runtime.getSecret("KEY").result()

// runInNodeMode: note the double call ()()
const result = runtime.runInNodeMode(fn, consensus)().result()
```

## Runtime vs NodeRuntime

- **Runtime<C>** (DON mode): Passed to trigger callbacks. Automatic BFT consensus on all operations. Use for EVM reads/writes, secrets, reports.
- **NodeRuntime<C>** (Node mode): Inside `runInNodeMode()` blocks. Each node runs independently. YOU must specify consensus aggregation. Use for HTTP API calls.

## Trigger Types

### Cron
```typescript
const cron = new CronCapability()
handler(cron.trigger({ schedule: "0 */10 * * * *" }), callback)
// Callback: (runtime: Runtime<Config>, payload: CronPayload) => string
```

### EVM Log
```typescript
const evmClient = new EVMClient(network.chainSelector.selector)
const eventSig = keccak256(toHex("TransactionRecorded(address,uint256,bool)"))
handler(evmClient.logTrigger({
  contractAddress: hexToBase64(config.contractAddress),
  topic0: hexToBase64(eventSig),
  // Topics 1-3: MUST pad to 32 bytes: hexToBase64(padHex(value, { size: 32 }))
}), callback)
// Callback: (runtime: Runtime<Config>, log: EVMLog) => string
```

### HTTP
```typescript
const http = new HTTPCapability()
handler(http.trigger({ method: "POST", path: "/verify" }), callback)
// Callback: (runtime: Runtime<Config>, payload: HTTPTriggerPayload) => string
```

## Write Pattern (EVM)

```typescript
// 1. ABI-encode data
const encoded = encodeAbiParameters(parseAbiParameters("address,uint256,uint256"), [...])
// 2. Generate signed report
const report = runtime.report({
  encodedPayload: hexToBase64(encoded),
  encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256",
}).result()
// 3. Submit to consumer contract
evmClient.writeReport(runtime, {
  receiver: consumerAddress,
  report,
  gasConfig: { gasLimit: "500000" },  // ALWAYS set explicit gasLimit
}).result()
```

## HTTP in Node Mode

```typescript
const result = runtime.runInNodeMode(
  (nodeRuntime: NodeRuntime<Config>) => {
    const http = new HTTPClient()
    return http.sendRequest(nodeRuntime, { url, method: "GET", headers }).result()
  },
  consensusIdenticalAggregation()  // or consensusMedianAggregation, ConsensusAggregationByFields
)().result()
```

## Service Quotas

| Quota | Limit |
|---|---|
| EVM reads per execution | **10** |
| HTTP calls per execution | **5** |
| Execution timeout | **5 min** |
| Cron minimum interval | **30 sec** |
| Report payload | **5 KB** |
| Gas per tx | **5,000,000** |
| Concurrent executions per owner | **5** |
| Log line size | **1 KB** |
| Concurrent capability calls | **3** |

## Non-Determinism Rules (VIOLATIONS = CONSENSUS FAILURE)

| NEVER | USE INSTEAD |
|---|---|
| `Math.random()` | `runtime.random()` |
| `Date.now()` / `new Date()` | `runtime.now()` |
| Floating point math | `BigInt` exclusively |
| `console.log` | `runtime.log()` |
| `async/await` on SDK | `.result()` pattern |
| Node.js APIs (crypto, fs) | viem utilities |

## Simulation Commands

```bash
cre workflow simulate reputation-oracle --target staging-settings
cre workflow simulate transaction-monitor --target staging-settings
cre workflow simulate budget-alert --target staging-settings
cre workflow simulate agent-verify --target staging-settings --http-payload '{"agent_address":"0x..."}'

# With real on-chain writes
cre workflow simulate <dir> --target staging-settings --broadcast
```

## Qova Workflows

| Workflow | Trigger | Pattern |
|---|---|---|
| reputation-oracle | Cron (10min) | Read 3 contracts -> compute score -> write if delta >= 10 |
| transaction-monitor | EVM Log (TransactionRecorded) | Decode event -> anomaly detection -> alert |
| budget-alert | EVM Log (BudgetUpdated/Exceeded) | Read utilization -> threshold check -> enforce |
| agent-verify | HTTP POST | Parse proof -> World ID verify -> write verification on-chain |
