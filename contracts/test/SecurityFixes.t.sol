// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TransactionValidator} from "../src/TransactionValidator.sol";
import {BudgetEnforcer} from "../src/BudgetEnforcer.sol";
import {QovaCore} from "../src/QovaCore.sol";
import {QovaReputationConsumer} from "../src/QovaReputationConsumer.sol";
import {CREReceiver} from "../src/base/CREReceiver.sol";

/// @notice Minimal concrete implementation of CREReceiver for testing.
contract MockCREReceiver is CREReceiver {
    constructor(address forwarder) CREReceiver(forwarder) {}

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        _validateReport(metadata, report);
    }
}

/// @title SecurityFixesTest
/// @notice Tests for Phase 1 security fixes (CONCERNS.md §1.1-§1.6).
contract SecurityFixesTest is Test {
    ReputationRegistry public registry;
    TransactionValidator public validator;
    BudgetEnforcer public enforcer;
    QovaCore public core;
    QovaReputationConsumer public consumer;

    address public forwarder = makeAddr("forwarder");
    address public agent1 = makeAddr("agent1");

    function setUp() public {
        registry = new ReputationRegistry();
        validator = new TransactionValidator(address(registry));
        enforcer = new BudgetEnforcer();
        core = new QovaCore(address(registry), address(validator), address(enforcer));

        consumer = new QovaReputationConsumer(forwarder, address(registry));

        // Grant roles
        validator.grantRole(keccak256("RECORDER_ROLE"), address(core));
        enforcer.grantRole(keccak256("BUDGET_MANAGER_ROLE"), address(core));
        registry.grantRole(keccak256("UPDATER_ROLE"), address(consumer));
        registry.registerAgent(agent1);
    }

    // ──────────────────────────────────────────────
    //  §1.1 — CREReceiver Zero Forwarder Address
    // ──────────────────────────────────────────────

    function test_Constructor_ZeroForwarder_Reverts() public {
        vm.expectRevert(CREReceiver.ZeroForwarderAddress.selector);
        new MockCREReceiver(address(0));
    }

    function test_Constructor_ValidForwarder_Succeeds() public {
        MockCREReceiver receiver = new MockCREReceiver(forwarder);
        assertEq(receiver.i_forwarder(), forwarder);
    }

    // ──────────────────────────────────────────────
    //  §1.2 — QovaVerificationConsumer inherits §1.1
    // ──────────────────────────────────────────────

    function test_VerificationConsumer_ZeroForwarder_Reverts() public {
        vm.expectRevert(CREReceiver.ZeroForwarderAddress.selector);
        new QovaReputationConsumer(address(0), address(registry));
    }

    // ──────────────────────────────────────────────
    //  §1.4 — Unsafe uint256 → uint16 Cast
    // ──────────────────────────────────────────────

    function test_OnReport_ScoreTruncation_Reverts() public {
        // Score 65536 (0x10000) would truncate to 0 in uint16
        // But it's > 1000, so ScoreOutOfRange should catch it
        bytes memory report = abi.encode(agent1, uint256(65536), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaReputationConsumer.ScoreOutOfRange.selector);
        consumer.onReport("", report);
    }

    function test_OnReport_MaxValidScore_Succeeds() public {
        bytes memory report = abi.encode(agent1, uint256(1000), block.timestamp + 1);

        vm.prank(forwarder);
        consumer.onReport("", report);

        assertEq(registry.getScore(agent1), 1000);
    }

    // ──────────────────────────────────────────────
    //  §1.5 — TransactionValidator Amount Overflow
    // ──────────────────────────────────────────────

    function test_RecordTransaction_AmountTooLarge_Reverts() public {
        uint256 tooLarge = uint256(type(uint128).max) + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                TransactionValidator.AmountTooLarge.selector,
                tooLarge,
                type(uint128).max
            )
        );
        validator.recordTransaction(
            agent1,
            keccak256("tx-overflow"),
            tooLarge,
            TransactionValidator.TransactionType.PAYMENT
        );
    }

    function test_RecordTransaction_MaxUint128_Succeeds() public {
        uint256 maxAmount = uint256(type(uint128).max);

        validator.recordTransaction(
            agent1,
            keccak256("tx-max"),
            maxAmount,
            TransactionValidator.TransactionType.PAYMENT
        );

        TransactionValidator.TransactionStats memory stats = validator.getTransactionStats(agent1);
        assertEq(stats.totalVolume, type(uint128).max);
    }

    // ──────────────────────────────────────────────
    //  §1.6 — QovaCore Amount Overflow
    // ──────────────────────────────────────────────

    function test_ExecuteAgentAction_AmountTooLarge_Reverts() public {
        uint256 tooLarge = uint256(type(uint128).max) + 1;

        vm.expectRevert(QovaCore.AmountTooLarge.selector);
        core.executeAgentAction(
            agent1,
            keccak256("tx-overflow"),
            tooLarge,
            TransactionValidator.TransactionType.PAYMENT
        );
    }

    function test_ExecuteAgentAction_MaxUint128_Succeeds() public {
        uint256 maxAmount = uint256(type(uint128).max);

        core.executeAgentAction(
            agent1,
            keccak256("tx-max"),
            maxAmount,
            TransactionValidator.TransactionType.PAYMENT
        );

        TransactionValidator.TransactionStats memory stats = validator.getTransactionStats(agent1);
        assertEq(stats.totalVolume, type(uint128).max);
    }

    // ──────────────────────────────────────────────
    //  Fuzz: Valid amounts always succeed
    // ──────────────────────────────────────────────

    function testFuzz_RecordTransaction_ValidAmounts(uint128 amount) public {
        vm.assume(amount > 0);

        validator.recordTransaction(
            agent1,
            keccak256(abi.encodePacked("fuzz-", amount)),
            uint256(amount),
            TransactionValidator.TransactionType.PAYMENT
        );

        TransactionValidator.TransactionStats memory stats = validator.getTransactionStats(agent1);
        assertEq(stats.totalVolume, amount);
    }
}
