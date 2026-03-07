// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {QovaReputationConsumer} from "../src/QovaReputationConsumer.sol";

contract QovaReputationConsumerTest is Test {
    ReputationRegistry public registry;
    QovaReputationConsumer public consumer;

    address public admin = address(this);
    address public forwarder = makeAddr("forwarder");
    address public agent1 = makeAddr("agent1");
    address public unauthorized = makeAddr("unauthorized");

    function setUp() public {
        registry = new ReputationRegistry();
        consumer = new QovaReputationConsumer(forwarder, address(registry));

        // Grant the consumer UPDATER_ROLE on the registry so it can write scores
        registry.grantRole(keccak256("UPDATER_ROLE"), address(consumer));

        // Register the agent
        registry.registerAgent(agent1);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_Success
    // ──────────────────────────────────────────────

    function test_OnReport_Success() public {
        uint256 score = 850;
        uint256 timestamp = block.timestamp + 1;

        bytes memory report = abi.encode(agent1, score, timestamp);
        bytes memory metadata = "";

        vm.prank(forwarder);
        consumer.onReport(metadata, report);

        // Verify score was written to registry
        assertEq(registry.getScore(agent1), 850);

        // Verify consumer state
        assertEq(consumer.lastReportTimestamp(agent1), timestamp);
        assertTrue(consumer.processedReports(keccak256(report)));
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_UnauthorizedForwarder
    // ──────────────────────────────────────────────

    function test_OnReport_UnauthorizedForwarder() public {
        bytes memory report = abi.encode(agent1, uint256(500), block.timestamp + 1);

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedForwarder()"));
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_ReplayProtection
    // ──────────────────────────────────────────────

    function test_OnReport_ReplayProtection() public {
        bytes memory report = abi.encode(agent1, uint256(700), block.timestamp + 1);

        vm.prank(forwarder);
        consumer.onReport("", report);

        // Same report again should revert
        vm.prank(forwarder);
        vm.expectRevert(QovaReputationConsumer.ReportAlreadyProcessed.selector);
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_ScoreOutOfRange
    // ──────────────────────────────────────────────

    function test_OnReport_ScoreOutOfRange() public {
        bytes memory report = abi.encode(agent1, uint256(1001), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaReputationConsumer.ScoreOutOfRange.selector);
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_StaleReport
    // ──────────────────────────────────────────────

    function test_OnReport_StaleReport() public {
        uint256 ts = block.timestamp + 10;

        // First report
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, uint256(600), ts));

        // Second report with older timestamp
        vm.prank(forwarder);
        vm.expectRevert(QovaReputationConsumer.StaleReport.selector);
        consumer.onReport("", abi.encode(agent1, uint256(700), ts - 1));
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_MultipleUpdates
    // ──────────────────────────────────────────────

    function test_OnReport_MultipleUpdates() public {
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, uint256(400), block.timestamp + 1));
        assertEq(registry.getScore(agent1), 400);

        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, uint256(750), block.timestamp + 2));
        assertEq(registry.getScore(agent1), 750);

        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, uint256(900), block.timestamp + 3));
        assertEq(registry.getScore(agent1), 900);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_EmitsEvent
    // ──────────────────────────────────────────────

    function test_OnReport_EmitsEvent() public {
        uint256 score = 650;
        uint256 timestamp = block.timestamp + 5;

        vm.expectEmit(true, false, false, true);
        emit QovaReputationConsumer.ReputationReportProcessed(agent1, uint16(score), timestamp);

        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, score, timestamp));
    }

    // ──────────────────────────────────────────────
    //  test_SetReputationRegistry
    // ──────────────────────────────────────────────

    function test_SetReputationRegistry() public {
        ReputationRegistry newRegistry = new ReputationRegistry();

        consumer.setReputationRegistry(address(newRegistry));
        assertEq(address(consumer.reputationRegistry()), address(newRegistry));
    }

    // ──────────────────────────────────────────────
    //  test_SetReputationRegistry_Unauthorized
    // ──────────────────────────────────────────────

    function test_SetReputationRegistry_Unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        consumer.setReputationRegistry(makeAddr("newRegistry"));
    }

    // ──────────────────────────────────────────────
    //  test_SetReputationRegistry_ZeroAddress
    // ──────────────────────────────────────────────

    function test_SetReputationRegistry_ZeroAddress() public {
        vm.expectRevert(QovaReputationConsumer.InvalidRegistry.selector);
        consumer.setReputationRegistry(address(0));
    }

    // ──────────────────────────────────────────────
    //  test_ForwarderIsImmutable
    // ──────────────────────────────────────────────

    function test_ForwarderIsImmutable() public view {
        assertEq(consumer.i_forwarder(), forwarder);
    }

    // ──────────────────────────────────────────────
    //  test_Constructor_InvalidRegistry
    // ──────────────────────────────────────────────

    function test_Constructor_InvalidRegistry() public {
        vm.expectRevert(QovaReputationConsumer.InvalidRegistry.selector);
        new QovaReputationConsumer(forwarder, address(0));
    }
}
