// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol"; // FIX: CONCERNS.md §2.5
import {CREReceiver} from "./base/CREReceiver.sol";

/// @title QovaVerificationConsumer
/// @author Qova Engineering
/// @notice Receives World ID verification results from CRE workflows and stores
///         verified agent status on-chain with sybil resistance via nullifier tracking.
/// @dev The agent-verify CRE workflow verifies World ID proofs off-chain (via cloud API
///      with BFT consensus across DON nodes), then writes the result here via KeystoneForwarder.
///      Report format: abi.encode(address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp)
contract QovaVerificationConsumer is CREReceiver, AccessControl { // FIX: CONCERNS.md §2.5
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    /// @notice On-chain verification record for an agent.
    /// @param agent             The verified agent address.
    /// @param nullifierHash     World ID nullifier hash (anonymous sybil-resistance ID).
    /// @param verificationLevel 1 = Device, 2 = Orb.
    /// @param timestamp         CRE report timestamp.
    /// @param verified          Whether the agent is currently verified.
    struct Verification {
        address agent;
        uint256 nullifierHash;
        uint8 verificationLevel;
        uint48 timestamp;
        bool verified;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Agent address => verification record.
    mapping(address => Verification) public verifications;

    /// @notice Nullifier hash => used flag. Prevents the same human from verifying
    ///         multiple agents (one-person-one-agent sybil resistance).
    mapping(uint256 => bool) public usedNullifiers;

    /// @notice Replay protection: each unique report can only be processed once.
    mapping(bytes32 => bool) public processedReports;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when the nullifier hash has already been used by another agent.
    error NullifierAlreadyUsed();

    /// @dev Thrown when a report payload has already been processed.
    error ReportAlreadyProcessed();

    /// @dev Thrown when the verification level is invalid (must be 1 or 2).
    error InvalidVerificationLevel();

    /// @dev Thrown when the nullifier hash is zero. // FIX: CONCERNS.md §2.3
    error InvalidNullifier();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when an agent is verified via World ID through CRE.
    /// @param agent             The verified agent address.
    /// @param nullifierHash     World ID nullifier (anonymous human ID).
    /// @param verificationLevel 1 = Device, 2 = Orb.
    /// @param timestamp         Verification timestamp from CRE.
    event AgentVerified(
        address indexed agent,
        uint256 indexed nullifierHash,
        uint8 verificationLevel,
        uint48 timestamp
    );

    /// @notice Emitted when an agent's verification is revoked by the owner.
    /// @param agent         The revoked agent address.
    /// @param nullifierHash The freed nullifier hash.
    event VerificationRevoked(address indexed agent, uint256 indexed nullifierHash);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the verification consumer.
    /// @param _forwarder Address of the KeystoneForwarder (CRE report delivery).
    constructor(address _forwarder) CREReceiver(_forwarder) { // FIX: CONCERNS.md §2.5
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  CRE Report Entry Point
    // ──────────────────────────────────────────────

    /// @notice Called by the KeystoneForwarder to deliver a World ID verification result.
    /// @dev Report format: abi.encode(address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp)
    /// @param metadata CRE report metadata.
    /// @param report   ABI-encoded verification data from the agent-verify CRE workflow.
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        // Step 1: Validate forwarder
        _validateReport(metadata, report);

        // Step 2: Replay protection
        bytes32 reportHash = keccak256(report);
        if (processedReports[reportHash]) revert ReportAlreadyProcessed();
        processedReports[reportHash] = true;

        // Step 3: Decode report
        (address agent, uint256 nullifierHash, uint256 verificationLevel, uint256 timestamp) =
            abi.decode(report, (address, uint256, uint256, uint256));

        // Step 4: Validate
        if (nullifierHash == 0) revert InvalidNullifier(); // FIX: CONCERNS.md §2.3
        if (verificationLevel == 0 || verificationLevel > 2) revert InvalidVerificationLevel();

        // Step 5: Sybil resistance -- prevent same human from verifying multiple agents
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed();
        usedNullifiers[nullifierHash] = true;

        // Step 6: Store verification
        uint8 level = uint8(verificationLevel);
        uint48 ts = uint48(timestamp);

        verifications[agent] = Verification({
            agent: agent,
            nullifierHash: nullifierHash,
            verificationLevel: level,
            timestamp: ts,
            verified: true
        });

        emit AgentVerified(agent, nullifierHash, level, ts);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Revoke an agent's verification (e.g., for fraud). Frees the nullifier
    ///         so the human can re-verify with a different agent.
    /// @param agent The agent address to revoke.
    function revokeVerification(address agent) external onlyRole(DEFAULT_ADMIN_ROLE) { // FIX: CONCERNS.md §2.5
        Verification storage v = verifications[agent];
        if (!v.verified) return;

        uint256 nullifier = v.nullifierHash;
        usedNullifiers[nullifier] = false;
        v.verified = false;

        emit VerificationRevoked(agent, nullifier);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Check whether an agent has been verified via World ID.
    /// @param agent The agent address.
    /// @return True if the agent is currently verified.
    function isVerified(address agent) external view returns (bool) {
        return verifications[agent].verified;
    }

    /// @notice Get the full verification record for an agent.
    /// @param agent The agent address.
    /// @return The Verification struct.
    function getVerification(address agent) external view returns (Verification memory) {
        return verifications[agent];
    }

    /// @notice Check whether a nullifier hash has been consumed.
    /// @param nullifierHash The nullifier to check.
    /// @return True if already used.
    function isNullifierUsed(uint256 nullifierHash) external view returns (bool) {
        return usedNullifiers[nullifierHash];
    }
}
