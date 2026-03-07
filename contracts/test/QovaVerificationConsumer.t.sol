// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {QovaVerificationConsumer} from "../src/QovaVerificationConsumer.sol";

contract QovaVerificationConsumerTest is Test {
    QovaVerificationConsumer public consumer;

    address public admin = address(this);
    address public forwarder = makeAddr("forwarder");
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public agent3 = makeAddr("agent3");
    address public unauthorized = makeAddr("unauthorized");

    uint256 public constant NULLIFIER_1 = 0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8;
    uint256 public constant NULLIFIER_2 = 0x1aa8b8f3b2d2de5ff452c0e1a83e29d6bf46fb83ef35dc5957121ff3d3698a01;
    uint256 public constant ORB_LEVEL = 2;
    uint256 public constant DEVICE_LEVEL = 1;

    function setUp() public {
        consumer = new QovaVerificationConsumer(forwarder);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_OrbVerification
    // ──────────────────────────────────────────────

    function test_OnReport_OrbVerification() public {
        uint256 timestamp = block.timestamp + 1;
        bytes memory report = abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, timestamp);

        vm.prank(forwarder);
        consumer.onReport("", report);

        // Verify state
        assertTrue(consumer.isVerified(agent1));
        assertTrue(consumer.isNullifierUsed(NULLIFIER_1));

        QovaVerificationConsumer.Verification memory v = consumer.getVerification(agent1);
        assertEq(v.agent, agent1);
        assertEq(v.nullifierHash, NULLIFIER_1);
        assertEq(v.verificationLevel, uint8(ORB_LEVEL));
        assertEq(v.timestamp, uint48(timestamp));
        assertTrue(v.verified);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_DeviceVerification
    // ──────────────────────────────────────────────

    function test_OnReport_DeviceVerification() public {
        uint256 timestamp = block.timestamp + 1;
        bytes memory report = abi.encode(agent1, NULLIFIER_1, DEVICE_LEVEL, timestamp);

        vm.prank(forwarder);
        consumer.onReport("", report);

        assertTrue(consumer.isVerified(agent1));
        QovaVerificationConsumer.Verification memory v = consumer.getVerification(agent1);
        assertEq(v.verificationLevel, uint8(DEVICE_LEVEL));
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_UnauthorizedForwarder
    // ──────────────────────────────────────────────

    function test_OnReport_UnauthorizedForwarder() public {
        bytes memory report = abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, block.timestamp + 1);

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedForwarder()"));
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_SybilResistance
    // ──────────────────────────────────────────────

    function test_OnReport_SybilResistance() public {
        uint256 ts = block.timestamp + 1;

        // First agent verifies with nullifier
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, ts));

        // Second agent tries to use the SAME nullifier (same human)
        vm.prank(forwarder);
        vm.expectRevert(QovaVerificationConsumer.NullifierAlreadyUsed.selector);
        consumer.onReport("", abi.encode(agent2, NULLIFIER_1, ORB_LEVEL, ts + 1));
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_DifferentNullifiers
    // ──────────────────────────────────────────────

    function test_OnReport_DifferentNullifiers() public {
        uint256 ts = block.timestamp + 1;

        // Two different humans verify two different agents
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, ts));

        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent2, NULLIFIER_2, ORB_LEVEL, ts + 1));

        assertTrue(consumer.isVerified(agent1));
        assertTrue(consumer.isVerified(agent2));
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_ReplayProtection
    // ──────────────────────────────────────────────

    function test_OnReport_ReplayProtection() public {
        bytes memory report = abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, block.timestamp + 1);

        vm.prank(forwarder);
        consumer.onReport("", report);

        vm.prank(forwarder);
        vm.expectRevert(QovaVerificationConsumer.ReportAlreadyProcessed.selector);
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_InvalidVerificationLevel
    // ──────────────────────────────────────────────

    function test_OnReport_InvalidVerificationLevel_Zero() public {
        bytes memory report = abi.encode(agent1, NULLIFIER_1, uint256(0), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaVerificationConsumer.InvalidVerificationLevel.selector);
        consumer.onReport("", report);
    }

    function test_OnReport_InvalidVerificationLevel_Three() public {
        bytes memory report = abi.encode(agent1, NULLIFIER_1, uint256(3), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaVerificationConsumer.InvalidVerificationLevel.selector);
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  test_OnReport_EmitsEvent
    // ──────────────────────────────────────────────

    function test_OnReport_EmitsEvent() public {
        uint256 ts = block.timestamp + 5;

        vm.expectEmit(true, true, false, true);
        emit QovaVerificationConsumer.AgentVerified(agent1, NULLIFIER_1, uint8(ORB_LEVEL), uint48(ts));

        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, ts));
    }

    // ──────────────────────────────────────────────
    //  test_RevokeVerification
    // ──────────────────────────────────────────────

    function test_RevokeVerification() public {
        // Verify agent first
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, block.timestamp + 1));
        assertTrue(consumer.isVerified(agent1));
        assertTrue(consumer.isNullifierUsed(NULLIFIER_1));

        // Revoke
        consumer.revokeVerification(agent1);
        assertFalse(consumer.isVerified(agent1));
        assertFalse(consumer.isNullifierUsed(NULLIFIER_1));
    }

    // ──────────────────────────────────────────────
    //  test_RevokeVerification_ThenReverify
    // ──────────────────────────────────────────────

    function test_RevokeVerification_ThenReverify() public {
        uint256 ts = block.timestamp + 1;

        // Verify agent1
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, ts));

        // Revoke agent1
        consumer.revokeVerification(agent1);

        // Same human can now verify a different agent
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent2, NULLIFIER_1, ORB_LEVEL, ts + 1));
        assertTrue(consumer.isVerified(agent2));
        assertFalse(consumer.isVerified(agent1));
    }

    // ──────────────────────────────────────────────
    //  test_RevokeVerification_Unauthorized
    // ──────────────────────────────────────────────

    function test_RevokeVerification_Unauthorized() public {
        vm.prank(forwarder);
        consumer.onReport("", abi.encode(agent1, NULLIFIER_1, ORB_LEVEL, block.timestamp + 1));

        vm.prank(unauthorized);
        vm.expectRevert();
        consumer.revokeVerification(agent1);
    }

    // ──────────────────────────────────────────────
    //  test_RevokeVerification_NotVerified
    // ──────────────────────────────────────────────

    function test_RevokeVerification_NotVerified() public {
        // Should not revert, just no-op
        consumer.revokeVerification(agent1);
        assertFalse(consumer.isVerified(agent1));
    }

    // ──────────────────────────────────────────────
    //  test_IsVerified_DefaultFalse
    // ──────────────────────────────────────────────

    function test_IsVerified_DefaultFalse() public view {
        assertFalse(consumer.isVerified(agent3));
    }

    // ──────────────────────────────────────────────
    //  test_ForwarderIsImmutable
    // ──────────────────────────────────────────────

    function test_ForwarderIsImmutable() public view {
        assertEq(consumer.i_forwarder(), forwarder);
    }
}
