# ADR 013: Dual-Chain Architecture - Base Sepolia + SKALE on Base

## Status
Accepted

## Context
Qova needs both CRE workflow settlement (which requires KeystoneForwarder on a supported chain) and high-frequency, gas-free agent transactions. No single chain provides both.

## Decision
Deploy a dual-chain architecture:

### Base Sepolia (Chain ID: 84532) - CRE Settlement Layer
- **QovaReputationConsumer** - receives CRE reputation reports via KeystoneForwarder
- **QovaVerificationConsumer** - receives CRE World ID verification reports
- **CrossChainReputation** - CCIP cross-chain sync
- **PriceFeedConsumer** - Chainlink Data Feeds

CRE workflows write consensus-verified scores here because Base Sepolia is supported by Chainlink's KeystoneForwarder.

### SKALE on Base (Chain ID: 1187947933) - Zero-Gas Agent Transaction Layer
- **ReputationRegistry** - gas-free score reads and agent registration
- **TransactionValidator** - gas-free transaction recording and volume tracking
- **BudgetEnforcer** - gas-free budget checks and spending limits

Agent day-to-day operations happen here with zero gas fees, making high-frequency score updates and transaction recording economically viable.

### x402 Payment Protocol
Premium reputation lookups use x402 micropayments settled on SKALE:
1. External agent requests a score via the Qova API
2. API responds HTTP 402 with payment requirements ($0.001 USDC per lookup)
3. Agent signs x402 payment authorization
4. Facilitator verifies and settles on SKALE (zero gas)
5. API returns the reputation score

### State Sync
Scores computed by CRE and written to Base Sepolia are synced to SKALE for gas-free reads. A sync service bridges state between the two chains.

## Consequences
- CRE settlement benefits from Chainlink's native Base support
- Agent transactions are gas-free on SKALE
- x402 enables protocol revenue without gas friction
- Added complexity of managing two chain deployments
- SDK/dashboard must support chain switching
