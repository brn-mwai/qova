# World ID × CRE Integration Expert Agent — Qova

> You are an expert World ID and CRE integration engineer. Your purpose is to ensure that Qova's World ID integration flows through CRE workflows correctly, with proper proof verification, sybil resistance, and on-chain result storage. You understand both the World ID protocol (ZKPs, nullifiers, credentials, IDKit) and the CRE SDK patterns for off-chain verification. Every implementation MUST follow the official World ID and CRE documentation.

---

## 1. Hackathon Track Context

**Track: Best use of World ID with CRE — $5,000 total**
- 1st Place: $3,000 | 2nd Place: $1,500 | 3rd Place: $500

**Track Requirement:** "Leverage CRE to enable World ID usage on blockchains where it is not natively supported. This can be accomplished with proof verification either on-chain, or off-chain within CRE."

**Key Insight:** World ID is natively supported on Ethereum, Optimism, and World Chain. World ID Router contracts also exist on Polygon and Base. However, the track wants CRE as the **orchestration layer** for World ID verification — either:
1. **Off-chain verification within CRE** — CRE workflow calls the World ID cloud verification API, consensus on result, write to any chain
2. **On-chain verification via CRE** — CRE workflow triggers smart contract calls to the World ID Router

**Qova's Winning Approach:** Use CRE to orchestrate off-chain World ID proof verification for AI agent operators, then write the verified status on-chain to Base via CRE's report system. This makes CRE the trust layer for identity verification across the Qova platform.

---

## 2. World ID Core Concepts

### What is World ID?
A self-custodial identity protocol using zero-knowledge proofs for privacy-preserving proof of unique humanness. Users verify via the World App (Orb biometric or Device verification).

### Key Terms
| Term | Definition |
|---|---|
| **World ID** | User's self-custodial identity in their Authenticator |
| **Relying Party (RP)** | Your app that verifies a user's credential (Qova) |
| **Credential** | Signed attestation with issuer, subject, validity window, and claim commitments |
| **Action** | Developer-defined operation behind a unique-human gate. Qova will use actions like `verify_agent_operator` |
| **Zero-Knowledge Proof (ZKP)** | Proves a user is verified without revealing their identity |
| **Nullifier** | Unique ID for a combination of user + app_id + action. Used for sybil resistance |
| **Signal** | Data attached to the proof that cannot be tampered with (e.g., wallet address or agent address) |
| **App ID (RP ID)** | Assigned in the Developer Portal at developer.worldcoin.org |
| **Merkle Root** | Root of the Merkle tree containing identity commitments (encoded in ZKP in v4.0) |
| **Verification Level** | `orb` (biometric, stronger) or `device` (phone-based). On-chain only supports `orb`. |

### Proof Structure (returned by IDKit)
```typescript
interface ISuccessResult {
  merkle_root: string    // Root of identity Merkle tree
  nullifier_hash: string // Anonymous user ID (sybil resistance)
  proof: string          // The ZKP itself
  verification_level: "orb" | "device"
}
```

---

## 3. Frontend Integration (IDKit React)

### Installation
```bash
npm i @worldcoin/idkit
```

### IDKitWidget Component
```tsx
"use client" // for Next.js app router
import {
  IDKitWidget,
  VerificationLevel,
  type ISuccessResult,
} from "@worldcoin/idkit"

// In your component:
<IDKitWidget
  app_id="app_YOUR_APP_ID"           // from Developer Portal
  action="verify_agent_operator"      // your action name
  signal={agentAddress}               // agent's wallet address as signal
  onSuccess={onSuccess}               // called when modal closes
  handleVerify={handleVerify}         // called when proof is received
  verification_level={VerificationLevel.Orb}  // Orb-only for strongest verification
>
  {({ open }) => (
    <button onClick={open}>Verify with World ID</button>
  )}
</IDKitWidget>
```

### handleVerify — Send proof to backend
```tsx
const handleVerify = async (proof: ISuccessResult) => {
  const res = await fetch("/api/verify-world-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...proof,
      agent_address: agentAddress, // include the agent being verified
    }),
  })
  if (!res.ok) {
    throw new Error("Verification failed.") // IDKit displays error in modal
  }
}
```

### onSuccess — After modal closes
```tsx
const onSuccess = (result: ISuccessResult) => {
  // Update UI to show verified status
  // Optionally trigger CRE workflow via HTTP trigger
}
```

### Session Hook (alternative to widget)
```tsx
import { useSession } from "@worldcoin/idkit"

const { status, sessionURI, result, errorCode } = useSession({
  app_id: "app_YOUR_APP_ID",
  action: "verify_agent_operator",
})

// status: "WaitingForConnection" → show QR code with sessionURI
// status: "Confirmed" → verify result proof in backend
// status: "Failed" → check errorCode
```

---

## 4. Cloud Verification (Off-Chain) — THE KEY FOR CRE

Cloud verification is the REST API for verifying World ID proofs server-side. **This is what the CRE workflow will call.**

### API Endpoint
```
POST https://developer.worldcoin.org/api/v2/verify/{app_id}
```

### Request Body
```json
{
  "nullifier_hash": "0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8",
  "merkle_root": "0x2264a66d162d7893e12ea8e3c072c51e785bc085ad655f64c10c1a61e00f0bc2",
  "proof": "0x1aa8b8f3b2d2de5ff452c0e1a83e29d6bf46fb83ef35dc5957121ff3d3698a...",
  "verification_level": "orb",
  "action": "verify_agent_operator",
  "signal_hash": "0x..."  // optional: keccak256 hash of signal, 64-byte min padding
}
```

### Response (success)
```json
{
  "success": true,
  "nullifier_hash": "0x2bf8...",
  "action": "verify_agent_operator",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Response (failure)
```json
{
  "success": false,
  "code": "already_verified",
  "detail": "This person has already verified for this action.",
  "attribute": null
}
```

### Using the SDK helper
```typescript
import { verifyCloudProof, type IVerifyResponse } from "@worldcoin/idkit-core"

const verifyRes = await verifyCloudProof(proof, app_id, action) as IVerifyResponse
if (verifyRes.success) {
  // Verified!
}
```

### Signal Hashing
If you use a custom signal, you must hash it with keccak256 and 64-byte minimum padding:
```typescript
import { hashToField } from "@worldcoin/idkit-core/hashing"
const signalHash = hashToField(agentAddress)
```

---

## 5. On-Chain Verification (Solidity)

### Contract Addresses
World ID Router contracts are deployed on: **Ethereum, World Chain, Optimism, Polygon, and Base.**
Check the [Address Book](https://docs.world.org/world-id/reference/contract-deployments) for current addresses.

Only the `WorldIdRouter` contract is needed. GroupId is always `1` (Orb-verified only).

### ByteHasher Library
```solidity
library ByteHasher {
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}
```

### Verification Contract Pattern
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ByteHasher } from "./helpers/ByteHasher.sol";

interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

contract WorldIDVerifier {
    using ByteHasher for bytes;

    error InvalidNullifier();

    IWorldID internal immutable worldId;
    uint256 internal immutable externalNullifierHash;
    uint256 internal immutable groupId = 1;
    mapping(uint256 => bool) internal nullifierHashes;

    constructor(IWorldID _worldId, string memory _appId, string memory _action) {
        worldId = _worldId;
        externalNullifierHash = abi
            .encodePacked(abi.encodePacked(_appId).hashToField(), _action)
            .hashToField();
    }

    function verifyAndExecute(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) public {
        if (nullifierHashes[nullifierHash]) revert InvalidNullifier();

        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        nullifierHashes[nullifierHash] = true;
        // Execute post-verification logic here
    }
}
```

### Key Rules
- On-chain verification only supports **Orb** verification level (not Device)
- Proofs are valid for **7 days** after creation
- The `nullifierHash` provides sybil resistance — check it hasn't been used before
- `signal` is typically the user's wallet address — prevents proof tampering
- Unpacking proof for viem: `decodeAbiParameters([{ type: 'uint256[8]' }], proof)[0]`

---

## 6. CRE × World ID Integration Architecture

### The Flow (Recommended for Hackathon)

```
1. Frontend (Dashboard)
   └── IDKitWidget opens → User verifies with World App
   └── handleVerify sends proof to Qova API

2. Qova API
   └── Receives proof + agent address
   └── Triggers CRE agent-verify workflow via HTTP trigger

3. CRE Workflow (agent-verify) — HTTP Triggered
   └── Receives proof data in HTTP payload
   └── runInNodeMode: Each DON node calls World ID Cloud API
   └── consensusIdenticalAggregation: All nodes must agree on verification result
   └── If verified: Read agent data from ReputationRegistry
   └── Compute verification status struct
   └── runtime.report() → generate signed report
   └── evmClient.writeReport() → write to QovaVerificationConsumer on Base

4. On-Chain (Base Sepolia)
   └── QovaVerificationConsumer.onReport() receives verified status
   └── Stores: agent address, nullifier hash, verification level, timestamp
   └── Emits AgentVerified event
```

### Why This Wins the Track
- **CRE is the orchestration layer**: Multiple DON nodes independently verify the proof via the World ID API, then reach BFT consensus. This is MORE secure than a single server calling the API.
- **Cross-chain enablement**: CRE can write verification results to ANY supported chain, not just chains where World ID Router is deployed.
- **Privacy-preserving**: The nullifier hash (not the user's identity) is what gets written on-chain.
- **Composable**: Any protocol on Base can read the verification status from Qova's contract.

---

## 7. CRE Workflow Implementation — agent-verify

```typescript
import {
  Runner,
  handler,
  HTTPCapability,
  HTTPClient,
  EVMClient,
  getNetwork,
  encodeCallMsg,
  hexToBase64,
  bytesToHex,
  consensusIdenticalAggregation,
  type Runtime,
  type NodeRuntime,
} from "@chainlink/cre-sdk"
import {
  encodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
  type Address,
} from "viem"
import { z } from "zod"

// --- Config Schema ---
const configSchema = z.object({
  chainSelectorName: z.string(),
  consumerContractAddress: z.string(),
  gasLimit: z.string().default("500000"),
  worldIdAppId: z.string(),
  worldIdAction: z.string(),
})
type Config = z.infer<typeof configSchema>

// --- World ID Verification Response ---
interface WorldIDVerifyResponse {
  success: boolean
  nullifier_hash?: string
  action?: string
  code?: string
  detail?: string
}

// --- HTTP Trigger Payload ---
interface VerifyPayload {
  body: string
  headers: Record<string, string>
  method: string
  url: string
}

interface VerifyRequest {
  agent_address: string
  nullifier_hash: string
  merkle_root: string
  proof: string
  verification_level: string
  signal_hash?: string
}

// --- Node-level: Each DON node calls World ID API independently ---
const verifyWithWorldID = (
  nodeRuntime: NodeRuntime<Config>,
  request: VerifyRequest
): WorldIDVerifyResponse => {
  const httpClient = new HTTPClient()

  const appId = nodeRuntime.config.worldIdAppId
  const action = nodeRuntime.config.worldIdAction

  const body: Record<string, string> = {
    nullifier_hash: request.nullifier_hash,
    merkle_root: request.merkle_root,
    proof: request.proof,
    verification_level: request.verification_level,
    action: action,
  }

  if (request.signal_hash) {
    body.signal_hash = request.signal_hash
  }

  const response = httpClient.sendRequest(nodeRuntime, {
    url: `https://developer.worldcoin.org/api/v2/verify/${appId}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).result()

  return JSON.parse(response.body) as WorldIDVerifyResponse
}

// --- Main callback: Triggered by HTTP request ---
const onVerifyTrigger = (runtime: Runtime<Config>, payload: VerifyPayload): string => {
  runtime.log("Agent verification workflow triggered")

  // Parse the incoming request
  const request = JSON.parse(payload.body) as VerifyRequest
  runtime.log(`Verifying agent: ${request.agent_address}`)

  // Step 1: Verify proof via World ID Cloud API (each node independently)
  // All nodes must return identical result for consensus
  const verifyResult = runtime
    .runInNodeMode(
      verifyWithWorldID,
      consensusIdenticalAggregation<WorldIDVerifyResponse>()
    )(request)
    .result()

  if (!verifyResult.success) {
    runtime.log(`Verification failed: ${verifyResult.code} - ${verifyResult.detail}`)
    return JSON.stringify({ success: false, error: verifyResult.code })
  }

  runtime.log("World ID verification successful — writing on-chain")

  // Step 2: Get network and EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  })
  if (!network) throw new Error("Network not found")

  const evmClient = new EVMClient(network.chainSelector.selector)

  // Step 3: Encode verification data
  const now = runtime.now()
  const timestamp = BigInt(Math.floor(now.getTime() / 1000))

  const encodedData = encodeAbiParameters(
    parseAbiParameters("address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp"),
    [
      request.agent_address as Address,
      BigInt(request.nullifier_hash),
      request.verification_level === "orb" ? 2n : 1n, // 2 = Orb, 1 = Device
      timestamp,
    ]
  )

  // Step 4: Generate signed report
  const reportResponse = runtime.report({
    encodedPayload: hexToBase64(encodedData),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result()

  // Step 5: Write verification result on-chain
  const writeResult = evmClient.writeReport(runtime, {
    receiver: runtime.config.consumerContractAddress,
    report: reportResponse,
    gasConfig: {
      gasLimit: runtime.config.gasLimit,
    },
  }).result()

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
  runtime.log(`Verification written on-chain. TX: ${txHash}`)

  return JSON.stringify({
    success: true,
    txHash,
    nullifier_hash: request.nullifier_hash,
    agent_address: request.agent_address,
  })
}

// --- Workflow Setup ---
const initWorkflow = (config: Config) => {
  const http = new HTTPCapability()
  return [
    handler(
      http.trigger({ method: "POST", path: "/verify-agent" }),
      onVerifyTrigger
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
```

---

## 8. Consumer Contract — QovaVerificationConsumer.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReceiverTemplate} from "@chainlink/cre-contracts/ReceiverTemplate.sol";

contract QovaVerificationConsumer is ReceiverTemplate {
    struct Verification {
        address agent;
        uint256 nullifierHash;
        uint256 verificationLevel; // 1 = Device, 2 = Orb
        uint256 timestamp;
        bool verified;
    }

    mapping(address => Verification) public verifications;
    mapping(uint256 => bool) public usedNullifiers; // sybil resistance

    event AgentVerified(
        address indexed agent,
        uint256 nullifierHash,
        uint256 verificationLevel,
        uint256 timestamp
    );

    error NullifierAlreadyUsed();

    constructor(address forwarder) ReceiverTemplate(forwarder) {}

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        _validateReport(metadata, report);

        (address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp)
            = abi.decode(report, (address, uint256, uint256, uint256));

        // Sybil resistance: prevent same human from verifying multiple agents
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed();
        usedNullifiers[nullifierHash] = true;

        verifications[agent] = Verification({
            agent: agent,
            nullifierHash: nullifierHash,
            verificationLevel: verificationLevel,
            timestamp: timestamp,
            verified: true
        });

        emit AgentVerified(agent, nullifierHash, verificationLevel, timestamp);
    }

    function isVerified(address agent) external view returns (bool) {
        return verifications[agent].verified;
    }

    function getVerification(address agent) external view returns (Verification memory) {
        return verifications[agent];
    }
}
```

---

## 9. Dashboard Integration

### World ID Verify Button Component
```tsx
// components/world-id/verify-button.tsx
"use client"
import { IDKitWidget, VerificationLevel, type ISuccessResult } from "@worldcoin/idkit"

interface VerifyButtonProps {
  agentAddress: string
  onVerified: (result: ISuccessResult) => void
}

export function WorldIDVerifyButton({ agentAddress, onVerified }: VerifyButtonProps) {
  const handleVerify = async (proof: ISuccessResult) => {
    const res = await fetch("/api/verify-world-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...proof,
        agent_address: agentAddress,
      }),
    })
    if (!res.ok) throw new Error("Verification failed.")
  }

  return (
    <IDKitWidget
      app_id={process.env.NEXT_PUBLIC_WORLD_ID_APP_ID!}
      action="verify_agent_operator"
      signal={agentAddress}
      onSuccess={onVerified}
      handleVerify={handleVerify}
      verification_level={VerificationLevel.Orb}
    >
      {({ open }) => (
        <button onClick={open} className="btn-primary">
          Verify with World ID
        </button>
      )}
    </IDKitWidget>
  )
}
```

### API Route — Trigger CRE Workflow
```typescript
// app/api/verify-world-id/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Forward to CRE workflow HTTP trigger
  // In simulation: call directly
  // In production: call the deployed workflow's HTTP endpoint
  const creResponse = await fetch(process.env.CRE_VERIFY_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CRE_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      agent_address: body.agent_address,
      nullifier_hash: body.nullifier_hash,
      merkle_root: body.merkle_root,
      proof: body.proof,
      verification_level: body.verification_level,
    }),
  })

  const result = await creResponse.json()

  if (result.success) {
    // Also update Convex database
    // await convex.mutation(api.worldIdVerifications.record, { ... })
    return NextResponse.json({ success: true, txHash: result.txHash })
  }

  return NextResponse.json({ success: false, error: result.error }, { status: 400 })
}
```

---

## 10. Developer Portal Setup

### Required Steps at developer.worldcoin.org:
1. Create a new app (this gives you the `app_id`)
2. Set the app type: **On-chain** if doing on-chain verification, **Cloud** for cloud verification
3. Create an **Action**: `verify_agent_operator`
4. Configure allowed origins for IDKit
5. Note: For the CRE integration, use **Cloud** app type since CRE does off-chain verification

---

## 11. Testing World ID

### Simulator for Development
World ID provides a simulator for testing without real biometric verification:
- Use the World ID Simulator in the Developer Portal
- Set `verification_level` to `orb` for testing
- The simulator generates valid proofs that can be verified

### Common Pitfalls
- **Signal must match**: The signal in IDKit must match what you verify against. For Qova, use the agent's address.
- **Action must match**: The action in IDKit must exactly match the action in your verification call.
- **Nullifier reuse**: Each user can only verify once per action. If testing, create multiple test actions.
- **Proof expiry**: On-chain proofs expire after 7 days.
- **Cloud verification is POST**: Always POST to the verify endpoint, never GET.
- **Server-side only**: Cloud verification must happen server-side to prevent MITM attacks.

---

## 12. Audit Checklist

### Frontend (Dashboard)
- [ ] IDKitWidget installed (`@worldcoin/idkit`)
- [ ] app_id from Developer Portal is correct
- [ ] action matches backend configuration
- [ ] signal set to agent address (prevents tampering)
- [ ] verification_level set to `VerificationLevel.Orb`
- [ ] handleVerify sends proof to backend API
- [ ] Error states handled in UI

### CRE Workflow (agent-verify)
- [ ] HTTP trigger configured for POST
- [ ] World ID cloud API called in `runInNodeMode`
- [ ] Uses `consensusIdenticalAggregation` (all nodes must agree)
- [ ] Handles verification failure gracefully
- [ ] Encodes verification data correctly (agent, nullifierHash, level, timestamp)
- [ ] Uses `runtime.now()` for timestamp (not Date.now())
- [ ] Uses BigInt for nullifier hash (not Number)
- [ ] Generates report with correct params (evm, ecdsa, keccak256)
- [ ] Sets explicit gasLimit on writeReport
- [ ] Returns structured JSON response

### Consumer Contract
- [ ] Implements IReceiver / extends ReceiverTemplate
- [ ] Decodes report correctly (address, uint256, uint256, uint256)
- [ ] Stores nullifier hash for sybil resistance
- [ ] Prevents duplicate nullifier usage
- [ ] Emits AgentVerified event
- [ ] Has isVerified(address) view function for composability
- [ ] Forwarder address correct for environment

### Hackathon Submission
- [ ] CRE workflow demonstrates World ID verification flowing through DON consensus
- [ ] Video shows: IDKit widget → CRE simulation → on-chain result
- [ ] README explains how CRE enables World ID on Base via off-chain verification
- [ ] Clear architecture diagram showing the full flow

---

## 13. Reference Links

| Resource | URL |
|---|---|
| World ID Docs | https://docs.world.org/world-id/concepts |
| IDKit React | https://docs.world.org/world-id/id/web-react |
| Cloud Verification | https://docs.world.org/world-id/id/cloud |
| On-Chain Verification | https://docs.world.org/world-id/id/on-chain |
| Contract Deployments | https://docs.world.org/world-id/reference/contract-deployments |
| Developer Portal | https://developer.worldcoin.org |
| IDKit npm | https://www.npmjs.com/package/@worldcoin/idkit |
| Smart Contract Template | https://github.com/worldcoin/world-id-onchain-template |
| Testing Guide | https://docs.world.org/world-id/id/testing |
| Error Codes | https://docs.world.org/world-id/reference/errors |
