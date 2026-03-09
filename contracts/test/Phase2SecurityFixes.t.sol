// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {QovaReputationConsumer} from "../src/QovaReputationConsumer.sol";
import {QovaVerificationConsumer} from "../src/QovaVerificationConsumer.sol";
import {CREReceiver} from "../src/base/CREReceiver.sol";

/// @notice Minimal mock for CREReceiver testing.
contract TestCREReceiver is CREReceiver {
    constructor(address forwarder) CREReceiver(forwarder) {}

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        _validateReport(metadata, report);
    }
}

/// @title Phase2SecurityFixesTest
/// @notice Tests for Phase 2 medium fixes, Phase 3 gas opts, and Phase 4 missing tests.
contract Phase2SecurityFixesTest is Test {
    ReputationRegistry public registry;
    QovaReputationConsumer public consumer;
    QovaVerificationConsumer public verifier;

    address public forwarder = makeAddr("forwarder");
    address public agent1 = makeAddr("agent1");
    address public unauthorized = makeAddr("unauthorized");

    bytes32 public constant REASON = keccak256("TEST");

    function setUp() public {
        registry = new ReputationRegistry();
        consumer = new QovaReputationConsumer(forwarder, address(registry));
        verifier = new QovaVerificationConsumer(forwarder);

        // Grant consumer UPDATER_ROLE on registry
        registry.grantRole(keccak256("UPDATER_ROLE"), address(consumer));
        registry.registerAgent(agent1);
    }

    // ──────────────────────────────────────────────
    //  §4.1 — CREReceiver Tests
    // ──────────────────────────────────────────────

    function test_CREReceiver_ZeroForwarder_Reverts() public {
        vm.expectRevert(CREReceiver.ZeroForwarderAddress.selector);
        new TestCREReceiver(address(0));
    }

    function test_CREReceiver_UnauthorizedCaller_Reverts() public {
        TestCREReceiver receiver = new TestCREReceiver(forwarder);

        vm.prank(unauthorized);
        vm.expectRevert(CREReceiver.UnauthorizedForwarder.selector);
        receiver.onReport("", "");
    }

    function test_CREReceiver_AuthorizedCaller_Succeeds() public {
        TestCREReceiver receiver = new TestCREReceiver(forwarder);

        vm.prank(forwarder);
        receiver.onReport("", ""); // Should not revert
    }

    // ──────────────────────────────────────────────
    //  §4.2 — ReputationRegistry Batch Tests
    // ──────────────────────────────────────────────

    function test_BatchUpdate_DuplicateAgents() public {
        // Duplicate agents in batch should update the same agent twice
        registry.registerAgent(makeAddr("agentA"));

        address[] memory agents = new address[](2);
        agents[0] = makeAddr("agentA");
        agents[1] = makeAddr("agentA");

        uint16[] memory scores = new uint16[](2);
        scores[0] = 500;
        scores[1] = 700;

        bytes32[] memory reasons = new bytes32[](2);
        reasons[0] = REASON;
        reasons[1] = REASON;

        registry.batchUpdateScores(agents, scores, reasons);

        // Last update wins
        assertEq(registry.getScore(makeAddr("agentA")), 700);

        // Update count should be 2
        ReputationRegistry.AgentDetails memory details = registry.getAgentDetails(makeAddr("agentA"));
        assertEq(details.updateCount, 2);
    }

    function test_BatchUpdate_ExceedsMaxBatch_Reverts() public {
        uint256 batchSize = 101; // MAX_BATCH_SIZE is 100
        address[] memory agents = new address[](batchSize);
        uint16[] memory scores = new uint16[](batchSize);
        bytes32[] memory reasons = new bytes32[](batchSize);

        for (uint256 i; i < batchSize; i++) {
            agents[i] = address(uint160(i + 1));
            scores[i] = 500;
            reasons[i] = REASON;
        }

        vm.expectRevert(ReputationRegistry.BatchSizeTooLarge.selector);
        registry.batchUpdateScores(agents, scores, reasons);
    }

    function test_BatchUpdate_ArrayLengthMismatch_Reverts() public {
        address[] memory agents = new address[](2);
        uint16[] memory scores = new uint16[](1); // Mismatched
        bytes32[] memory reasons = new bytes32[](2);

        vm.expectRevert(ReputationRegistry.ArrayLengthMismatch.selector);
        registry.batchUpdateScores(agents, scores, reasons);
    }

    function testFuzz_UpdateScore_BoundedRange(uint16 score) public {
        score = uint16(bound(score, 0, 1000));

        registry.updateScore(agent1, score, REASON);
        assertEq(registry.getScore(agent1), score);
        assertTrue(score <= 1000);
    }

    // ──────────────────────────────────────────────
    //  §4.4 — QovaReputationConsumer Tests
    // ──────────────────────────────────────────────

    function test_OnReport_ScoreTruncation_Reverts() public {
        // 65536 would truncate to 0 in uint16, but >1000 should be caught first
        bytes memory report = abi.encode(agent1, uint256(65536), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaReputationConsumer.ScoreOutOfRange.selector);
        consumer.onReport("", report);
    }

    function test_OnReport_ZeroForwarder_Reverts() public {
        vm.expectRevert(CREReceiver.ZeroForwarderAddress.selector);
        new QovaReputationConsumer(address(0), address(registry));
    }

    // ──────────────────────────────────────────────
    //  §2.2 — Event Indexing (reportHash)
    // ──────────────────────────────────────────────

    function test_OnReport_EmitsIndexedReportHash() public {
        uint256 score = 800;
        uint256 timestamp = block.timestamp + 1;
        bytes memory report = abi.encode(agent1, score, timestamp);
        bytes32 expectedHash = keccak256(report);

        vm.expectEmit(true, true, false, true);
        emit QovaReputationConsumer.ReputationReportProcessed(agent1, expectedHash, uint16(score), timestamp);

        vm.prank(forwarder);
        consumer.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  §2.3 — Nullifier Validation
    // ──────────────────────────────────────────────

    function test_OnReport_ZeroNullifier_Reverts() public {
        bytes memory report = abi.encode(agent1, uint256(0), uint256(2), block.timestamp + 1);

        vm.prank(forwarder);
        vm.expectRevert(QovaVerificationConsumer.InvalidNullifier.selector);
        verifier.onReport("", report);
    }

    // ──────────────────────────────────────────────
    //  §2.5 — AccessControl Migration
    // ──────────────────────────────────────────────

    function test_ReputationConsumer_UsesAccessControl() public view {
        // Deployer (this contract) should have DEFAULT_ADMIN_ROLE
        assertTrue(consumer.hasRole(consumer.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    function test_VerificationConsumer_UsesAccessControl() public view {
        assertTrue(verifier.hasRole(verifier.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    function test_ReputationConsumer_SetRegistry_Unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        consumer.setReputationRegistry(makeAddr("newRegistry"));
    }

    function test_VerificationConsumer_Revoke_Unauthorized() public {
        // Verify agent first
        vm.prank(forwarder);
        verifier.onReport("", abi.encode(
            agent1,
            uint256(0x1234567890abcdef),
            uint256(2),
            block.timestamp + 1
        ));

        vm.prank(unauthorized);
        vm.expectRevert();
        verifier.revokeVerification(agent1);
    }

    // ──────────────────────────────────────────────
    //  §3.2 — Batch Size Limit
    // ──────────────────────────────────────────────

    function test_BatchUpdate_MaxBatchSize_Succeeds() public {
        uint256 batchSize = 100; // Exactly MAX_BATCH_SIZE
        address[] memory agents = new address[](batchSize);
        uint16[] memory scores = new uint16[](batchSize);
        bytes32[] memory reasons = new bytes32[](batchSize);

        for (uint256 i; i < batchSize; i++) {
            address agent = address(uint160(i + 100));
            agents[i] = agent;
            scores[i] = 500;
            reasons[i] = REASON;
            registry.registerAgent(agent);
        }

        // Should NOT revert
        registry.batchUpdateScores(agents, scores, reasons);
    }
}
