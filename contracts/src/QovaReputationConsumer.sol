// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CREReceiver} from "./base/CREReceiver.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";

/// @title QovaReputationConsumer
/// @author Qova Engineering
/// @notice Receives CRE workflow reports via KeystoneForwarder and writes
///         reputation scores to the ReputationRegistry.
/// @dev Extends CREReceiver (ReceiverTemplate pattern) for forwarder validation.
///      CRE workflows encode reports as (address agent, uint256 score, uint256 timestamp).
contract QovaReputationConsumer is CREReceiver, Ownable {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The Qova ReputationRegistry that stores agent scores.
    ReputationRegistry public reputationRegistry;

    /// @notice Tracks the last report timestamp per agent for staleness checks.
    mapping(address => uint256) public lastReportTimestamp;

    /// @notice Replay protection: each unique report payload can only be processed once.
    mapping(bytes32 => bool) public processedReports;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when the registry address is zero.
    error InvalidRegistry();

    /// @dev Thrown when a report payload has already been processed.
    error ReportAlreadyProcessed();

    /// @dev Thrown when the decoded score exceeds the valid range (0-1000).
    error ScoreOutOfRange();

    /// @dev Thrown when a report's timestamp is not newer than the previous one.
    error StaleReport();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a CRE reputation report is processed.
    /// @param agent    The agent whose score was updated.
    /// @param newScore The new reputation score.
    /// @param timestamp Timestamp from the CRE report.
    event ReputationReportProcessed(
        address indexed agent,
        uint16 newScore,
        uint256 timestamp
    );

    /// @notice Emitted when the ReputationRegistry reference is updated.
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the consumer with a forwarder and registry reference.
    /// @param _forwarder Address of the KeystoneForwarder (CRE report delivery).
    /// @param _registry  Address of the deployed ReputationRegistry.
    constructor(
        address _forwarder,
        address _registry
    ) CREReceiver(_forwarder) Ownable(msg.sender) {
        if (_registry == address(0)) revert InvalidRegistry();
        reputationRegistry = ReputationRegistry(_registry);
    }

    // ──────────────────────────────────────────────
    //  CRE Report Entry Point
    // ──────────────────────────────────────────────

    /// @notice Called by the KeystoneForwarder to deliver a reputation report.
    /// @dev Validates forwarder, checks replay/staleness, decodes and forwards to registry.
    ///      Report format: abi.encode(address agent, uint256 score, uint256 timestamp)
    /// @param metadata CRE report metadata (workflow ID, DON config, signatures).
    /// @param report   ABI-encoded payload from the CRE workflow.
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        // Step 1: Validate forwarder
        _validateReport(metadata, report);

        // Step 2: Replay protection
        bytes32 reportHash = keccak256(report);
        if (processedReports[reportHash]) revert ReportAlreadyProcessed();
        processedReports[reportHash] = true;

        // Step 3: Decode report (matches CRE workflow encoding)
        (address agent, uint256 score, uint256 timestamp) =
            abi.decode(report, (address, uint256, uint256));

        // Step 4: Validate
        if (score > 1000) revert ScoreOutOfRange();
        if (timestamp <= lastReportTimestamp[agent]) revert StaleReport();

        // Step 5: Update state
        lastReportTimestamp[agent] = timestamp;

        // Step 6: Forward to ReputationRegistry (cast uint256 -> uint16, use reportHash as reason)
        reputationRegistry.updateScore(agent, uint16(score), reportHash);

        emit ReputationReportProcessed(agent, uint16(score), timestamp);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Update the ReputationRegistry reference.
    /// @param _registry Address of the new ReputationRegistry contract.
    function setReputationRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert InvalidRegistry();
        address old = address(reputationRegistry);
        reputationRegistry = ReputationRegistry(_registry);
        emit RegistryUpdated(old, _registry);
    }
}
