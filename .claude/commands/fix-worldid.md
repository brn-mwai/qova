Read .claude/agents/02-world-id-cre.md completely, then implement the full World ID × CRE integration.

Files to create or fix:
1. cre/agent-verify/main.ts — HTTP-triggered CRE workflow that verifies World ID proofs via Cloud API
2. contracts/src/QovaVerificationConsumer.sol — Consumer contract with sybil resistance
3. dashboard/components/world-id/verify-button.tsx — IDKitWidget integration
4. dashboard/app/api/verify-world-id/route.ts — API route that triggers CRE workflow

The flow must be:
IDKitWidget → handleVerify → /api/verify-world-id → CRE HTTP trigger → runInNodeMode (each node calls World ID API) → consensusIdenticalAggregation → report → writeReport → QovaVerificationConsumer.onReport → store verification + emit event

Critical requirements:
- Use @worldcoin/idkit package
- app_id and action from Developer Portal (use env vars)
- signal = agent address (prevents tampering)
- verification_level = VerificationLevel.Orb (on-chain only supports Orb)
- Nullifier hash stored for sybil resistance
- Cloud verification API: POST https://developer.worldcoin.org/api/v2/verify/{app_id}

After implementation, verify:
1. Contract compiles: forge build
2. CRE simulates: cre workflow simulate agent-verify --target staging-settings --http-payload '...'
3. Dashboard component renders without errors
