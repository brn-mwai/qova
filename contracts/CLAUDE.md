# Smart Contracts -- Development Protocol

> Sources of truth: `.claude/agents/05-smart-contracts.md`, `.claude/agents/10-cybersecurity.md`

## Stack
Solidity 0.8.28, Foundry (forge/cast/anvil), OpenZeppelin v5, Chainlink CRE contracts

## CRE Consumer Contract Pattern

Every contract that receives CRE reports MUST:

```solidity
import {ReceiverTemplate} from "@chainlink/cre-contracts/ReceiverTemplate.sol";

contract QovaConsumer is ReceiverTemplate {
    // Replay protection
    mapping(bytes32 => bool) public processedReports;

    constructor(address forwarder) ReceiverTemplate(forwarder) {}

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        // 1. Validate forwarder + signatures (FIRST)
        _validateReport(metadata, report);

        // 2. Replay protection
        bytes32 reportHash = keccak256(report);
        if (processedReports[reportHash]) revert ReportAlreadyProcessed();
        processedReports[reportHash] = true;

        // 3. Decode report
        (address agent, uint256 score, uint256 timestamp) =
            abi.decode(report, (address, uint256, uint256));

        // 4. Validate inputs
        if (score > 1000) revert InvalidScore();
        if (timestamp <= lastUpdateTimestamp[agent]) revert StaleReport();

        // 5. Update state + emit events
    }
}
```

## Forwarder Addresses
- **Simulation**: MockKeystoneForwarder (per-chain, check Forwarder Directory)
- **Production**: KeystoneForwarder (per-chain, different addresses)
- **CRITICAL**: Update forwarder address when moving from sim to prod

## Event Design for CRE Log Triggers

Events consumed by CRE workflows MUST use proper indexing:

```solidity
// topic[0] = keccak256 of event signature (automatic)
// topic[1-3] = indexed params (padded to 32 bytes by CRE SDK)
event TransactionRecorded(address indexed agent, uint256 amount, bool success);
event BudgetUpdated(address indexed agent, uint256 spent, uint256 limit);
event BudgetExceeded(address indexed agent, uint256 amount);
event ScoreUpdated(address indexed agent, uint256 oldScore, uint256 newScore, uint256 timestamp);
```

## Security Checklist

### CRE Consumer
- [ ] Implements IReceiver / extends ReceiverTemplate
- [ ] Constructor accepts forwarder address
- [ ] onReport calls `_validateReport()` FIRST
- [ ] Replay protection via report hash mapping
- [ ] Score range validation (0-1000)
- [ ] Staleness check on timestamps
- [ ] Events emitted for all state changes
- [ ] View functions for external composability

### General Security
- [ ] Checks-effects-interactions pattern on all external calls
- [ ] ReentrancyGuard on state-changing functions that call external contracts
- [ ] Access control (Ownable / AccessControl) on admin functions
- [ ] No reentrancy in onReport (ReceiverTemplate handles forwarder check)
- [ ] Integer overflow protection (Solidity 0.8+ automatic)
- [ ] Gas usage within CRE's 5,000,000 limit per tx
- [ ] NatSpec documentation on all public functions

### Deployment
- [ ] `forge build` compiles without warnings
- [ ] `forge test` passes all tests
- [ ] Deployment script covers all contracts
- [ ] Base Sepolia addresses in deployments/base-sepolia.json
- [ ] ABIs exported for SDK and CRE workflows
