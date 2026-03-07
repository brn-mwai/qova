Audit all smart contracts in contracts/src/ against .claude/agents/05-smart-contracts.md and .claude/agents/10-cybersecurity.md.

Check:
1. QovaReputationConsumer.sol extends ReceiverTemplate, has _validateReport, replay protection, score validation (0-1000), staleness check, events
2. QovaVerificationConsumer.sol exists and has: ReceiverTemplate, nullifier sybil resistance, AgentVerified event, isVerified view function
3. TransactionValidator.sol emits TransactionRecorded(address indexed, uint256, bool)
4. BudgetEnforcer.sol emits BudgetUpdated and BudgetExceeded with indexed agent
5. All contracts compile: run `cd contracts && forge build`
6. All tests pass: run `cd contracts && forge test`
7. No reentrancy vulnerabilities
8. Access control on admin functions
9. Forwarder address handling (sim vs prod)

Fix ALL issues found. Create QovaVerificationConsumer.sol if it doesn't exist.
