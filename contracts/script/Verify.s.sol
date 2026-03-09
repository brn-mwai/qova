// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TransactionValidator} from "../src/TransactionValidator.sol";
import {BudgetEnforcer} from "../src/BudgetEnforcer.sol";
import {QovaCore} from "../src/QovaCore.sol";

/// @title Verify
/// @notice Post-deployment verification script. Checks role assignments,
///         contract references, and protocol invariants. (Phase 5, §5.1)
contract Verify is Script {
    function run(
        address registryAddr,
        address validatorAddr,
        address enforcerAddr,
        address coreAddr
    ) external view {
        ReputationRegistry registry = ReputationRegistry(registryAddr);
        TransactionValidator validator = TransactionValidator(validatorAddr);
        BudgetEnforcer enforcer = BudgetEnforcer(enforcerAddr);
        QovaCore core = QovaCore(coreAddr);

        console.log("=== Qova Post-Deployment Verification ===");
        console.log("");

        // 1. Verify contract addresses are non-zero
        require(registryAddr != address(0), "Registry address is zero");
        require(validatorAddr != address(0), "Validator address is zero");
        require(enforcerAddr != address(0), "Enforcer address is zero");
        require(coreAddr != address(0), "Core address is zero");
        console.log("[PASS] All contract addresses are non-zero");

        // 2. Verify role assignments - QovaCore has required roles
        require(
            registry.hasRole(registry.UPDATER_ROLE(), coreAddr),
            "Core missing UPDATER_ROLE on Registry"
        );
        require(
            validator.hasRole(validator.RECORDER_ROLE(), coreAddr),
            "Core missing RECORDER_ROLE on Validator"
        );
        require(
            enforcer.hasRole(enforcer.BUDGET_MANAGER_ROLE(), coreAddr),
            "Core missing BUDGET_MANAGER_ROLE on Enforcer"
        );
        console.log("[PASS] QovaCore has all required roles");

        // 3. Verify QovaCore references point to correct addresses
        require(
            address(core.reputationRegistry()) == registryAddr,
            "Core registry mismatch"
        );
        require(
            address(core.transactionValidator()) == validatorAddr,
            "Core validator mismatch"
        );
        require(
            address(core.budgetEnforcer()) == enforcerAddr,
            "Core enforcer mismatch"
        );
        console.log("[PASS] QovaCore contract references are correct");

        // 4. Verify validator references registry
        require(
            address(validator.reputationRegistry()) == registryAddr,
            "Validator registry mismatch"
        );
        console.log("[PASS] TransactionValidator references correct registry");

        // 5. Verify batch size limit is set
        require(registry.MAX_BATCH_SIZE() == 100, "MAX_BATCH_SIZE not 100");
        console.log("[PASS] MAX_BATCH_SIZE is 100");

        console.log("");
        console.log("=== All Verifications Passed ===");
    }
}
