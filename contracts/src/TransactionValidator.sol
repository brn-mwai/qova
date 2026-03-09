// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";

/// @title TransactionValidator
/// @author Qova Engineering
/// @notice Records and validates agent transactions, maintaining per-agent statistics
///         including volume, count, and success rate.
/// @dev Works alongside ReputationRegistry to provide a complete agent activity profile.
contract TransactionValidator is AccessControl, Pausable {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to record transactions.
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    /// @notice Classification of on-chain transaction types.
    enum TransactionType {
        PAYMENT,
        SWAP,
        TRANSFER,
        CONTRACT_CALL,
        BRIDGE
    }

    /// @notice Aggregate statistics for a single agent.
    /// @param totalCount            Total number of recorded transactions.
    /// @param totalVolume           Cumulative value (wei or token-unit) across all transactions.
    /// @param successCount          Number of transactions marked as successful.
    /// @param lastActivityTimestamp Timestamp of the most recent recorded transaction.
    struct TransactionStats {
        uint64 totalCount;            // 8 bytes
        uint128 totalVolume;          // 16 bytes
        uint64 successCount;          // 8 bytes  -- slot boundary (32 bytes)
        uint48 lastActivityTimestamp; // 6 bytes  -- next slot
    }

    // ──────────────────────────────────────────────
    //  Immutables
    // ──────────────────────────────────────────────

    /// @notice Reference to the Qova ReputationRegistry.
    // forge-lint: disable-next-line(screaming-snake-case-immutable)
    ReputationRegistry public immutable reputationRegistry;

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    /// @dev agent address => TransactionStats.
    mapping(address => TransactionStats) private _stats;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when a zero address is supplied where a valid address is required.
    error ZeroAddress();

    /// @dev Thrown when a zero amount is supplied for a transaction record.
    error ZeroAmount();

    /// @dev Thrown when the amount exceeds uint128 max. // FIX: CONCERNS.md §1.5
    error AmountTooLarge(uint256 amount, uint128 max);

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a transaction is recorded for an agent.
    /// @param agent     The agent address.
    /// @param txHash    External transaction hash or identifier.
    /// @param amount    Value of the transaction.
    /// @param txType    Classification of the transaction.
    /// @param timestamp Block timestamp of recording.
    event TransactionRecorded(
        address indexed agent,
        bytes32 indexed txHash,
        uint256 amount,
        TransactionType txType,
        uint48 timestamp
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the validator with a reference to the ReputationRegistry.
    /// @param _reputationRegistry Address of the deployed ReputationRegistry contract.
    constructor(address _reputationRegistry) {
        if (_reputationRegistry == address(0)) revert ZeroAddress();

        reputationRegistry = ReputationRegistry(_reputationRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
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

    /// @notice Record a new transaction for an agent.
    /// @dev Increments both totalCount and successCount. Volume is accumulated as uint128
    ///      so the caller must ensure `amount` fits within 128 bits.
    /// @param agent  The agent address.
    /// @param txHash External transaction hash or unique identifier.
    /// @param amount Value of the transaction (must be > 0).
    /// @param txType Classification of the transaction.
    function recordTransaction(
        address agent,
        bytes32 txHash,
        uint256 amount,
        TransactionType txType
    ) external onlyRole(RECORDER_ROLE) whenNotPaused {
        if (agent == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge(amount, type(uint128).max); // FIX: CONCERNS.md §1.5

        uint48 ts = uint48(block.timestamp);

        // --- Effects ---
        TransactionStats storage stats = _stats[agent];

        unchecked {
            stats.totalCount += 1;
            stats.successCount += 1;
            stats.totalVolume += uint128(amount);
        }
        stats.lastActivityTimestamp = ts;

        emit TransactionRecorded(agent, txHash, amount, txType, ts);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Returns aggregate transaction statistics for an agent.
    /// @param agent The agent address.
    /// @return The TransactionStats struct.
    function getTransactionStats(address agent) external view returns (TransactionStats memory) {
        return _stats[agent];
    }

    /// @notice Returns the success rate for an agent as a basis-point percentage.
    /// @dev Formula: (successCount * 10_000) / totalCount.
    ///      A return value of 10000 means 100.00%, 9500 means 95.00%.
    ///      Returns 0 if no transactions have been recorded.
    /// @param agent The agent address.
    /// @return Success rate scaled by 100 (e.g., 9500 = 95.00%).
    function getSuccessRate(address agent) external view returns (uint256) {
        TransactionStats storage stats = _stats[agent];
        if (stats.totalCount == 0) return 0;
        return (uint256(stats.successCount) * 10_000) / uint256(stats.totalCount);
    }
}
