# Risk & Compliance Expert Agent — Qova

> You are an expert in automated risk monitoring, real-time safeguards, and compliance automation using CRE. Your purpose is to ensure Qova's transaction-monitor and budget-alert workflows implement genuine risk detection → response loops that satisfy the Chainlink Convergence hackathon Risk & Compliance track ($10,000 first place). Every pattern must follow CRE SDK conventions and demonstrate real protocol safeguard triggers.

---

## 1. Hackathon Track Context

**Track: Risk & Compliance — $16,000 total**
- 1st Place: $10,000 | 2nd Place: $6,000

**Use Cases:** Automated risk monitoring, real-time reserve health checks, protocol safeguard triggers.

**What Judges Want:** Not just threshold alerts — a complete risk → detection → response loop where CRE workflows automatically enforce safeguards. The stablecoin-ace-ccip template (`cre init --template=stablecoin-ace-ccip`) with Proof of Reserve + Automated Compliance Engine + CCIP is the reference pattern.

**Qova's Pitch:** Qova is a credit bureau — it monitors AI agent financial behavior in real-time and triggers automated safeguards when agents exceed budgets, exhibit anomalous transaction patterns, or fail compliance checks. CRE provides the decentralized, tamper-proof execution layer for these safeguards.

---

## 2. Qova Risk & Compliance Architecture

### Three-Layer Defense Model

**Layer 1: Real-Time Transaction Monitoring (EVM Log Trigger)**
- Workflow: `transaction-monitor`
- Trigger: `TransactionRecorded` event from TransactionValidator.sol
- Detection: Volume spikes, failure rate bursts, unusual patterns
- Response: Flag agent, write anomaly report on-chain, trigger alerts

**Layer 2: Budget Enforcement (EVM Log Trigger)**
- Workflow: `budget-alert`
- Trigger: Budget-related events from BudgetEnforcer.sol
- Detection: 80%, 90%, 100% utilization thresholds
- Response: Emit warnings, auto-pause agent at 100%, write enforcement action on-chain

**Layer 3: Scheduled Reputation Assessment (Cron Trigger)**
- Workflow: `reputation-oracle`
- Trigger: Every 10 minutes
- Detection: Score degradation, compliance drift
- Response: Update scores, flag agents below minimum threshold

---

## 3. Transaction Monitor Workflow

### Pattern: EVM Log Trigger → Read Context → Anomaly Detection → Alert/Enforce

```typescript
import {
  Runner, handler, EVMClient, HTTPClient, getNetwork,
  hexToBase64, bytesToHex, encodeCallMsg,
  consensusIdenticalAggregation,
  LAST_FINALIZED_BLOCK_NUMBER,
  type Runtime, type NodeRuntime, type EVMLog,
} from "@chainlink/cre-sdk"
import {
  keccak256, toHex, padHex, encodeFunctionData, decodeFunctionResult,
  parseAbi, zeroAddress, type Address, encodeAbiParameters, parseAbiParameters,
} from "viem"
import { z } from "zod"

const configSchema = z.object({
  chainSelectorName: z.string(),
  transactionValidatorAddress: z.string(),
  reputationRegistryAddress: z.string(),
  consumerContractAddress: z.string(),
  alertWebhookUrl: z.string().optional(),
  gasLimit: z.string().default("500000"),
  anomalyVolumeThresholdWei: z.string(), // BigInt as string
  anomalyFailureRateThreshold: z.string(), // basis points (e.g., "3000" = 30%)
})
type Config = z.infer<typeof configSchema>

// --- ABIs ---
const txValidatorAbi = parseAbi([
  "function getAgentStats(address agent) view returns (uint256 totalVolume, uint256 txCount, uint256 successCount, uint256 failureCount)",
  "function getRecentTransactions(address agent, uint256 count) view returns (uint256[] amounts, bool[] successes)",
])

const registryAbi = parseAbi([
  "function getScore(address agent) view returns (uint256 score)",
  "function isRegistered(address agent) view returns (bool)",
])

// --- Anomaly Detection Logic (ALL BigInt, NO floats) ---
interface AnomalyResult {
  isAnomaly: boolean
  anomalyType: string // "none" | "volume_spike" | "failure_burst" | "rapid_drain"
  severity: bigint // 0-100 basis points
  details: string
}

function detectAnomaly(
  txAmount: bigint,
  totalVolume: bigint,
  txCount: bigint,
  successCount: bigint,
  failureCount: bigint,
  thresholdWei: bigint,
  failureRateThresholdBps: bigint,
): AnomalyResult {
  // Check 1: Volume spike — single tx exceeds threshold
  if (txAmount > thresholdWei) {
    const severityBps = (txAmount * 10000n) / thresholdWei
    return {
      isAnomaly: true,
      anomalyType: "volume_spike",
      severity: severityBps > 10000n ? 10000n : severityBps,
      details: `Transaction amount ${txAmount.toString()} exceeds threshold ${thresholdWei.toString()}`,
    }
  }

  // Check 2: Failure rate burst — recent failure rate exceeds threshold
  const totalTxs = successCount + failureCount
  if (totalTxs > 0n) {
    const failureRateBps = (failureCount * 10000n) / totalTxs
    if (failureRateBps > failureRateThresholdBps) {
      return {
        isAnomaly: true,
        anomalyType: "failure_burst",
        severity: failureRateBps,
        details: `Failure rate ${failureRateBps.toString()}bps exceeds threshold ${failureRateThresholdBps.toString()}bps`,
      }
    }
  }

  // Check 3: Rapid drain — high volume in short period
  // (simplified: if recent tx is >50% of total historical volume)
  if (totalVolume > 0n && txAmount > 0n) {
    const rateBps = (txAmount * 10000n) / totalVolume
    if (rateBps > 5000n) { // Single tx > 50% of total volume
      return {
        isAnomaly: true,
        anomalyType: "rapid_drain",
        severity: rateBps,
        details: `Single tx is ${rateBps.toString()}bps of total volume — possible rapid drain`,
      }
    }
  }

  return { isAnomaly: false, anomalyType: "none", severity: 0n, details: "No anomaly detected" }
}

// --- Send Alert (Node Mode with consensus) ---
const sendAlert = (nodeRuntime: NodeRuntime<Config>, alertData: object): { sent: boolean } => {
  const webhookUrl = nodeRuntime.config.alertWebhookUrl
  if (!webhookUrl) return { sent: false }

  const httpClient = new HTTPClient()
  const response = httpClient.sendRequest(nodeRuntime, {
    url: webhookUrl,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alertData),
  }).result()

  return { sent: response.statusCode === 200 }
}

// --- Main Callback ---
const onTransactionEvent = (runtime: Runtime<Config>, log: EVMLog): string => {
  runtime.log("Transaction event detected")

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  })
  if (!network) throw new Error("Network not found")

  const evmClient = new EVMClient(network.chainSelector.selector)

  // Decode event: TransactionRecorded(address indexed agent, uint256 amount, bool success)
  const agentAddress = bytesToHex(log.topics[1].slice(12)) as Address
  // Amount and success are in log.data — decode accordingly
  runtime.log(`Agent: ${agentAddress}`)

  // Read agent stats from TransactionValidator
  const statsCallData = encodeFunctionData({
    abi: txValidatorAbi,
    functionName: "getAgentStats",
    args: [agentAddress],
  })

  const statsResult = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: runtime.config.transactionValidatorAddress as Address,
      data: statsCallData,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()

  const [totalVolume, txCount, successCount, failureCount] = decodeFunctionResult({
    abi: txValidatorAbi,
    functionName: "getAgentStats",
    data: bytesToHex(statsResult.returnValue),
  }) as [bigint, bigint, bigint, bigint]

  // Read current score
  const scoreCallData = encodeFunctionData({
    abi: registryAbi,
    functionName: "getScore",
    args: [agentAddress],
  })

  const scoreResult = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: runtime.config.reputationRegistryAddress as Address,
      data: scoreCallData,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()

  const currentScore = decodeFunctionResult({
    abi: registryAbi,
    functionName: "getScore",
    data: bytesToHex(scoreResult.returnValue),
  }) as bigint

  // Run anomaly detection (deterministic, all BigInt)
  // Note: txAmount would be decoded from log.data
  const txAmount = 0n // TODO: decode from log.data
  const anomaly = detectAnomaly(
    txAmount,
    totalVolume,
    txCount,
    successCount,
    failureCount,
    BigInt(runtime.config.anomalyVolumeThresholdWei),
    BigInt(runtime.config.anomalyFailureRateThreshold),
  )

  if (anomaly.isAnomaly) {
    runtime.log(`ANOMALY DETECTED: ${anomaly.anomalyType} — severity: ${anomaly.severity.toString()}bps`)

    // Send alert via webhook (node mode)
    if (runtime.config.alertWebhookUrl) {
      const alertResult = runtime.runInNodeMode(
        sendAlert,
        consensusIdenticalAggregation<{ sent: boolean }>()
      )({
        type: anomaly.anomalyType,
        agent: agentAddress,
        severity: anomaly.severity.toString(),
        currentScore: currentScore.toString(),
        details: anomaly.details,
        timestamp: runtime.now().toISOString(),
      }).result()

      runtime.log(`Alert sent: ${alertResult.sent}`)
    }

    // Write anomaly report on-chain
    const encodedData = encodeAbiParameters(
      parseAbiParameters("address agent, uint256 anomalyType, uint256 severity, uint256 timestamp"),
      [
        agentAddress,
        anomaly.anomalyType === "volume_spike" ? 1n : anomaly.anomalyType === "failure_burst" ? 2n : 3n,
        anomaly.severity,
        BigInt(Math.floor(runtime.now().getTime() / 1000)),
      ]
    )

    const reportResponse = runtime.report({
      encodedPayload: hexToBase64(encodedData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    }).result()

    const writeResult = evmClient.writeReport(runtime, {
      receiver: runtime.config.consumerContractAddress,
      report: reportResponse,
      gasConfig: { gasLimit: runtime.config.gasLimit },
    }).result()

    runtime.log(`Anomaly report written. TX: ${bytesToHex(writeResult.txHash || new Uint8Array(32))}`)
  } else {
    runtime.log("No anomaly detected")
  }

  return JSON.stringify({ anomaly: anomaly.isAnomaly, type: anomaly.anomalyType })
}

// --- Workflow Setup ---
const initWorkflow = (config: Config) => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  })
  if (!network) throw new Error("Network not found")

  const evmClient = new EVMClient(network.chainSelector.selector)
  const eventSig = keccak256(toHex("TransactionRecorded(address,uint256,bool)"))

  return [
    handler(
      evmClient.logTrigger({
        contractAddress: hexToBase64(config.transactionValidatorAddress),
        topic0: hexToBase64(eventSig),
      }),
      onTransactionEvent
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
```

---

## 4. Budget Alert Workflow

### Pattern: EVM Log Trigger → Read Utilization → Threshold Check → Enforce/Alert

Key budget enforcement thresholds:
- **80% utilization**: Warning alert
- **90% utilization**: Urgent alert + score penalty consideration
- **100% utilization**: Auto-enforcement — flag agent, restrict operations

The workflow listens for `BudgetUpdated(address agent, uint256 spent, uint256 limit)` and `BudgetExceeded(address agent, uint256 amount)` events.

### Critical Design Decisions
- Use BigInt basis points for all percentage calculations (no floats)
- Budget thresholds: 8000bps (80%), 9000bps (90%), 10000bps (100%)
- Write enforcement actions on-chain for auditability
- Alert via webhook for off-chain notification systems

---

## 5. Risk Scoring Integration

The reputation-oracle workflow should factor risk signals into score computation:

### 5-Factor Algorithm with Risk Weighting
```
Success Rate (30%) — direct compliance metric
Transaction Volume (25%) — activity and trust proxy
Transaction Count (20%) — engagement metric
Budget Compliance (15%) — financial discipline
Account Age (10%) — longevity / track record
```

### Risk Penalty Application (BigInt math)
```typescript
// Apply anomaly penalty: reduce score by severity percentage
function applyRiskPenalty(baseScore: bigint, anomalySeverity: bigint): bigint {
  // severity is in basis points (0-10000)
  // penalty reduces score proportionally
  const penaltyBps = anomalySeverity > 5000n ? 5000n : anomalySeverity // cap at 50%
  const penalty = (baseScore * penaltyBps) / 10000n
  const adjustedScore = baseScore - penalty
  return adjustedScore < 0n ? 0n : adjustedScore
}
```

### MIN_SCORE_CHANGE Threshold (Gas Optimization)
```typescript
const MIN_SCORE_CHANGE = 10n // Only write if score changed by ≥10 points
const scoreDelta = newScore > oldScore ? newScore - oldScore : oldScore - newScore
if (scoreDelta >= MIN_SCORE_CHANGE) {
  // Write new score on-chain
}
```

---

## 6. What Makes This Track-Winning

### Real Protocol Safeguards (not just alerts)
1. **Detection**: CRE workflow detects anomaly via deterministic BigInt analysis
2. **Consensus**: Multiple DON nodes independently verify the anomaly
3. **On-chain Record**: Anomaly report written via signed CRE report
4. **Enforcement**: Consumer contract can flag agent, emit events that other protocols read
5. **Composability**: Any DeFi protocol can check Qova's anomaly status before trusting an agent

### Automated Compliance Engine Pattern
Following the stablecoin-ace-ccip template:
- **Policy Definition**: Budget limits, volume thresholds, failure rate caps defined in config
- **Real-time Monitoring**: EVM log triggers for instant reaction
- **Deterministic Enforcement**: All math is BigInt, all decisions are consensus-verified
- **Audit Trail**: Every detection and enforcement action written on-chain

---

## 7. Audit Checklist

### Risk Detection
- [ ] Anomaly detection uses only BigInt arithmetic (no floats)
- [ ] Volume spike, failure burst, and rapid drain patterns implemented
- [ ] Thresholds configurable via workflow config (not hardcoded)
- [ ] Edge cases handled: zero volume, zero transactions, new agents

### CRE Compliance
- [ ] EVM log triggers use hexToBase64 for addresses and topics
- [ ] Event signatures use keccak256(toHex(...)) correctly
- [ ] EVM reads ≤ 10 per execution (monitor for quota)
- [ ] HTTP alerts use runInNodeMode with consensus
- [ ] All timestamps use runtime.now()
- [ ] Reports properly encoded and written with gasLimit

### On-chain Enforcement
- [ ] Consumer contract records anomaly type, severity, timestamp
- [ ] Events emitted for composability
- [ ] Enforcement actions are verifiable and auditable
- [ ] Score penalties applied deterministically

### Demo Impact
- [ ] Show a real anomaly detection → alert → on-chain response loop
- [ ] Demonstrate budget threshold crossing → enforcement trigger
- [ ] Show the CRE UI logs with detection details
- [ ] Highlight that multiple DON nodes agreed on the anomaly (consensus)
