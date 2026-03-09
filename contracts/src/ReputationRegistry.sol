// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ReputationRegistry
/// @author Qova Engineering
/// @notice Central registry mapping agent addresses to on-chain reputation scores (0-1000).
/// @dev Scores are maintained by authorized updaters. Supports batch operations for gas efficiency.
contract ReputationRegistry is AccessControl, Pausable {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to register agents and update scores.
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    /// @notice On-chain details for a registered agent.
    /// @param score      Reputation score in the range [0, 1000].
    /// @param lastUpdated Timestamp of the most recent score change.
    /// @param updateCount Number of times the score has been updated.
    /// @param registered  Whether the agent has been registered.
    struct AgentDetails {
        uint16 score;        // 2 bytes
        uint48 lastUpdated;  // 6 bytes
        uint32 updateCount;  // 4 bytes
        bool registered;     // 1 byte  -- total: 13 bytes, fits in 1 slot
    }

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    /// @dev agent address => AgentDetails (single storage slot per agent).
    mapping(address => AgentDetails) private _agents;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when an operation targets an agent that has not been registered.
    error AgentNotRegistered();

    /// @dev Thrown when attempting to register an agent that is already registered.
    error AgentAlreadyRegistered();

    /// @dev Thrown when a score value exceeds the maximum of 1000.
    error InvalidScore();

    /// @dev Thrown when batch arrays have mismatched lengths.
    error ArrayLengthMismatch();

    /// @dev Thrown when a batch exceeds the maximum allowed size. // FIX: CONCERNS.md §3.2
    error BatchSizeTooLarge();

    /// @notice Maximum number of agents per batch update. // FIX: CONCERNS.md §3.2
    uint256 public constant MAX_BATCH_SIZE = 100;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new agent is registered.
    /// @param agent     The agent address.
    /// @param timestamp Block timestamp of registration.
    event AgentRegistered(address indexed agent, uint48 timestamp);

    /// @notice Emitted when an agent's score is updated.
    /// @param agent     The agent address.
    /// @param oldScore  Previous score value.
    /// @param newScore  New score value.
    /// @param reason    Application-defined reason tag.
    /// @param timestamp Block timestamp of the update.
    event ScoreUpdated(
        address indexed agent,
        uint16 oldScore,
        uint16 newScore,
        bytes32 reason,
        uint48 timestamp
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the registry and grants admin + updater roles to the deployer.
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Admin helpers
    // ──────────────────────────────────────────────

    /// @notice Pause all mutable operations.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause mutable operations.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ──────────────────────────────────────────────
    //  Mutative functions
    // ──────────────────────────────────────────────

    /// @notice Register a new agent with an initial score of 0.
    /// @param agent The address to register.
    function registerAgent(address agent) external onlyRole(UPDATER_ROLE) whenNotPaused {
        if (_agents[agent].registered) revert AgentAlreadyRegistered();

        uint48 ts = uint48(block.timestamp);

        _agents[agent] = AgentDetails({
            score: 0,
            lastUpdated: ts,
            updateCount: 0,
            registered: true
        });

        emit AgentRegistered(agent, ts);
    }

    /// @notice Update a single agent's reputation score.
    /// @param agent    The registered agent address.
    /// @param newScore The new score (0-1000).
    /// @param reason   Application-defined reason tag (e.g., keccak of a reason string).
    function updateScore(
        address agent,
        uint16 newScore,
        bytes32 reason
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        if (newScore > 1000) revert InvalidScore();

        AgentDetails storage details = _agents[agent];
        if (!details.registered) revert AgentNotRegistered();

        uint16 oldScore = details.score;
        uint48 ts = uint48(block.timestamp);

        details.score = newScore;
        details.lastUpdated = ts;
        unchecked {
            details.updateCount += 1;
        }

        emit ScoreUpdated(agent, oldScore, newScore, reason, ts);
    }

    /// @notice Batch-update scores for multiple agents in a single transaction.
    /// @dev All three arrays must have the same length. Reverts atomically on any failure.
    /// @param agents  Array of registered agent addresses.
    /// @param scores  Corresponding new scores (0-1000 each).
    /// @param reasons Corresponding reason tags.
    function batchUpdateScores(
        address[] calldata agents,
        uint16[] calldata scores,
        bytes32[] calldata reasons
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        uint256 len = agents.length;
        if (len > MAX_BATCH_SIZE) revert BatchSizeTooLarge(); // FIX: CONCERNS.md §3.2
        if (len != scores.length || len != reasons.length) revert ArrayLengthMismatch();

        uint48 ts = uint48(block.timestamp);

        for (uint256 i; i < len;) {
            uint16 newScore = scores[i];
            if (newScore > 1000) revert InvalidScore();

            AgentDetails storage details = _agents[agents[i]];
            if (!details.registered) revert AgentNotRegistered();

            uint16 oldScore = details.score;

            details.score = newScore;
            details.lastUpdated = ts;
            unchecked {
                details.updateCount += 1;
            }

            emit ScoreUpdated(agents[i], oldScore, newScore, reasons[i], ts);

            unchecked {
                ++i;
            }
        }
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Returns the current reputation score for an agent.
    /// @param agent The agent address.
    /// @return The score (0-1000). Reverts if agent is not registered.
    function getScore(address agent) external view returns (uint16) {
        if (!_agents[agent].registered) revert AgentNotRegistered();
        return _agents[agent].score;
    }

    /// @notice Returns the full details struct for an agent.
    /// @param agent The agent address.
    /// @return The AgentDetails struct.
    function getAgentDetails(address agent) external view returns (AgentDetails memory) {
        return _agents[agent];
    }

    /// @notice Checks whether an agent has been registered.
    /// @param agent The agent address.
    /// @return True if registered, false otherwise.
    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].registered;
    }
}
