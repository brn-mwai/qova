// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TransactionValidator} from "../src/TransactionValidator.sol";
import {BudgetEnforcer} from "../src/BudgetEnforcer.sol";
import {QovaCore} from "../src/QovaCore.sol";

/// @title DeployTenderly
/// @notice Full deployment to a Tenderly Virtual TestNet with demo data.
/// @dev Deploys all 4 core contracts, grants roles, seeds demo agents with scores
///      and transactions. Run with:
///      forge script script/DeployTenderly.s.sol --rpc-url tenderly --broadcast
contract DeployTenderly is Script {
    /// @dev Demo agent addresses matching dashboard seed data.
    address constant AGENT_1 = 0x0000000000000000000000000000000000000001;
    address constant AGENT_2 = 0x0000000000000000000000000000000000000002;
    address constant AGENT_3 = 0x0000000000000000000000000000000000000003;

    function run() external {
        vm.startBroadcast();

        // ── 1. Deploy Core Contracts ───────────────────
        ReputationRegistry registry = new ReputationRegistry();
        TransactionValidator validator = new TransactionValidator(address(registry));
        BudgetEnforcer enforcer = new BudgetEnforcer();
        QovaCore core = new QovaCore(
            address(registry),
            address(validator),
            address(enforcer)
        );

        // ── 2. Grant Roles to QovaCore ─────────────────
        // QovaCore needs UPDATER, RECORDER, BUDGET_MANAGER to orchestrate
        registry.grantRole(registry.UPDATER_ROLE(), address(core));
        validator.grantRole(validator.RECORDER_ROLE(), address(core));
        enforcer.grantRole(enforcer.BUDGET_MANAGER_ROLE(), address(core));

        // Also grant deployer direct access for seeding demo data
        registry.grantRole(registry.UPDATER_ROLE(), msg.sender);
        validator.grantRole(validator.RECORDER_ROLE(), msg.sender);
        enforcer.grantRole(enforcer.BUDGET_MANAGER_ROLE(), msg.sender);

        // ── 3. Register Demo Agents ────────────────────
        // registerAgent(address) on ReputationRegistry
        registry.registerAgent(AGENT_1);
        registry.registerAgent(AGENT_2);
        registry.registerAgent(AGENT_3);

        // ── 4. Set Initial Scores ──────────────────────
        // updateScore(address, uint16, bytes32) on ReputationRegistry
        registry.updateScore(AGENT_1, 750, bytes32("seed-bbb"));
        registry.updateScore(AGENT_2, 900, bytes32("seed-aa"));
        registry.updateScore(AGENT_3, 450, bytes32("seed-ccc"));

        // ── 5. Record Sample Transactions ──────────────
        // recordTransaction(address, bytes32, uint256, TransactionType) on TransactionValidator
        validator.recordTransaction(AGENT_1, bytes32(uint256(1)), 1 ether, TransactionValidator.TransactionType.PAYMENT);
        validator.recordTransaction(AGENT_2, bytes32(uint256(2)), 5 ether, TransactionValidator.TransactionType.SWAP);
        validator.recordTransaction(AGENT_3, bytes32(uint256(3)), 0.5 ether, TransactionValidator.TransactionType.TRANSFER);

        // ── 6. Set Budgets ─────────────────────────────
        // setBudget(address, uint128 daily, uint128 monthly, uint128 perTx) on BudgetEnforcer
        enforcer.setBudget(AGENT_1, 10 ether, 100 ether, 5 ether);
        enforcer.setBudget(AGENT_2, 50 ether, 500 ether, 25 ether);

        // ── 7. Log Deployment ──────────────────────────
        console.log("=== Qova Tenderly Virtual TestNet Deployment ===");
        console.log("");
        console.log("ReputationRegistry:", address(registry));
        console.log("TransactionValidator:", address(validator));
        console.log("BudgetEnforcer:", address(enforcer));
        console.log("QovaCore:", address(core));
        console.log("");
        console.log("Demo Agents Registered: 3");
        console.log("  Agent 1 (BBB, score=750):", AGENT_1);
        console.log("  Agent 2 (AA,  score=900):", AGENT_2);
        console.log("  Agent 3 (CCC, score=450):", AGENT_3);
        console.log("");
        console.log("Deployer:", msg.sender);
        console.log("Chain ID:", block.chainid);

        vm.stopBroadcast();
    }
}
