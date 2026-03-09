// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ReputationRegistry} from "./ReputationRegistry.sol";
import {TransactionValidator} from "./TransactionValidator.sol";
import {BudgetEnforcer} from "./BudgetEnforcer.sol";

/// @title QovaCore
/// @author Qova Engineering
/// @notice Facade contract that orchestrates agent actions across the Qova reputation protocol.
/// @dev Composes ReputationRegistry, TransactionValidator, and BudgetEnforcer into a single
///      entry point for operator-driven agent workflows. Follows checks-effects-interactions.
contract QovaCore is AccessControl, ReentrancyGuard, Pausable {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to execute agent actions through the facade.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The Qova ReputationRegistry instance.
    ReputationRegistry public reputationRegistry;

    /// @notice The Qova TransactionValidator instance.
    TransactionValidator public transactionValidator;

    /// @notice The Qova BudgetEnforcer instance.
    BudgetEnforcer public budgetEnforcer;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when a budget check fails for the requested agent action.
    error BudgetCheckFailed();

    /// @dev Thrown when a zero address is provided for a contract reference.
    error InvalidContract();

    /// @dev Thrown when amount exceeds uint128 max. // FIX: CONCERNS.md §1.6
    error AmountTooLarge();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when an agent action is executed through the facade.
    /// @param agent     The agent address.
    /// @param txHash    External transaction hash or identifier.
    /// @param amount    Value of the action.
    /// @param txType    Classification of the transaction.
    /// @param timestamp Block timestamp of execution.
    event AgentActionExecuted(
        address indexed agent,
        bytes32 indexed txHash,
        uint256 amount,
        TransactionValidator.TransactionType txType,
        uint48 timestamp
    );

    /// @notice Emitted when one of the underlying contract references is updated.
    /// @param contractName Human-readable name of the contract being updated.
    /// @param oldAddress   Previous contract address.
    /// @param newAddress   New contract address.
    event ContractUpdated(
        string contractName,
        address oldAddress,
        address newAddress
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys QovaCore with references to all sub-contracts.
    /// @param _registry  Address of the deployed ReputationRegistry.
    /// @param _validator Address of the deployed TransactionValidator.
    /// @param _enforcer  Address of the deployed BudgetEnforcer.
    constructor(
        address _registry,
        address _validator,
        address _enforcer
    ) {
        if (_registry == address(0) || _validator == address(0) || _enforcer == address(0)) {
            revert InvalidContract();
        }

        reputationRegistry = ReputationRegistry(_registry);
        transactionValidator = TransactionValidator(_validator);
        budgetEnforcer = BudgetEnforcer(_enforcer);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
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

    /// @notice Update the ReputationRegistry reference.
    /// @param registry Address of the new ReputationRegistry contract.
    function setReputationRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0)) revert InvalidContract();

        address old = address(reputationRegistry);
        reputationRegistry = ReputationRegistry(registry);

        emit ContractUpdated("ReputationRegistry", old, registry);
    }

    /// @notice Update the TransactionValidator reference.
    /// @param validator Address of the new TransactionValidator contract.
    function setTransactionValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (validator == address(0)) revert InvalidContract();

        address old = address(transactionValidator);
        transactionValidator = TransactionValidator(validator);

        emit ContractUpdated("TransactionValidator", old, validator);
    }

    /// @notice Update the BudgetEnforcer reference.
    /// @param enforcer Address of the new BudgetEnforcer contract.
    function setBudgetEnforcer(address enforcer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enforcer == address(0)) revert InvalidContract();

        address old = address(budgetEnforcer);
        budgetEnforcer = BudgetEnforcer(enforcer);

        emit ContractUpdated("BudgetEnforcer", old, enforcer);
    }

    // ──────────────────────────────────────────────
    //  Core operations
    // ──────────────────────────────────────────────

    /// @notice Execute an agent action: validate budget, record the transaction, emit event.
    /// @dev Follows checks-effects-interactions. Budget is only enforced when a budget has been
    ///      configured for the agent (allows agents to operate without budget constraints if
    ///      desired). The caller must hold OPERATOR_ROLE.
    /// @param agent  The agent address performing the action.
    /// @param txHash External transaction hash or identifier.
    /// @param amount Value of the action.
    /// @param txType Classification of the transaction.
    function executeAgentAction(
        address agent,
        bytes32 txHash,
        uint256 amount,
        TransactionValidator.TransactionType txType
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        if (amount > type(uint128).max) revert AmountTooLarge(); // FIX: CONCERNS.md §1.6
        uint48 ts = uint48(block.timestamp);

        // --- Checks ---
        // If the agent has a budget configured, enforce it.
        if (budgetEnforcer.hasBudget(agent)) {
            if (!budgetEnforcer.checkBudget(agent, uint128(amount))) {
                revert BudgetCheckFailed();
            }
        }

        // --- Effects (emitted here; interactions below are trusted internal contracts) ---
        emit AgentActionExecuted(agent, txHash, amount, txType, ts);

        // --- Interactions (trusted Qova contracts only) ---
        // Record spend if budget exists.
        if (budgetEnforcer.hasBudget(agent)) {
            budgetEnforcer.recordSpend(agent, uint128(amount));
        }

        // Record the transaction.
        transactionValidator.recordTransaction(agent, txHash, amount, txType);
    }

    // ──────────────────────────────────────────────
    //  View helpers
    // ──────────────────────────────────────────────

    /// @notice Returns the current reputation score for an agent.
    /// @param agent The agent address.
    /// @return The score (0-1000).
    function getAgentScore(address agent) external view returns (uint16) {
        return reputationRegistry.getScore(agent);
    }

    /// @notice Returns aggregate transaction statistics for an agent.
    /// @param agent The agent address.
    /// @return The TransactionStats struct.
    function getAgentStats(address agent) external view returns (TransactionValidator.TransactionStats memory) {
        return transactionValidator.getTransactionStats(agent);
    }

    /// @notice Returns the current budget status for an agent.
    /// @param agent The agent address.
    /// @return The BudgetStatus struct with remaining allowances.
    function getAgentBudgetStatus(address agent) external view returns (BudgetEnforcer.BudgetStatus memory) {
        return budgetEnforcer.getBudgetStatus(agent);
    }
}
