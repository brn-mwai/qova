// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TransactionValidator} from "../src/TransactionValidator.sol";
import {BudgetEnforcer} from "../src/BudgetEnforcer.sol";
import {QovaCore} from "../src/QovaCore.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        ReputationRegistry registry = new ReputationRegistry();
        TransactionValidator validator = new TransactionValidator(address(registry));
        BudgetEnforcer enforcer = new BudgetEnforcer();
        QovaCore core = new QovaCore(
            address(registry),
            address(validator),
            address(enforcer)
        );

        // Grant roles to QovaCore so it can orchestrate sub-contracts
        registry.grantRole(registry.UPDATER_ROLE(), address(core));
        validator.grantRole(validator.RECORDER_ROLE(), address(core));
        enforcer.grantRole(enforcer.BUDGET_MANAGER_ROLE(), address(core));

        // Post-deployment assertions // FIX: CONCERNS.md §5.2
        require(address(registry) != address(0), "Registry deployment failed");
        require(address(validator) != address(0), "Validator deployment failed");
        require(address(enforcer) != address(0), "Enforcer deployment failed");
        require(address(core) != address(0), "Core deployment failed");
        require(registry.hasRole(registry.UPDATER_ROLE(), address(core)), "Core missing UPDATER_ROLE");
        require(validator.hasRole(validator.RECORDER_ROLE(), address(core)), "Core missing RECORDER_ROLE");
        require(enforcer.hasRole(enforcer.BUDGET_MANAGER_ROLE(), address(core)), "Core missing BUDGET_MANAGER_ROLE");

        console.log("=== Qova Deployment Complete ===");
        console.log("ReputationRegistry:", address(registry));
        console.log("TransactionValidator:", address(validator));
        console.log("BudgetEnforcer:", address(enforcer));
        console.log("QovaCore:", address(core));
        console.log("Deployer:", msg.sender);
        console.log("Chain ID:", block.chainid);

        vm.stopBroadcast();
    }
}
