// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BudgetEnforcer
/// @author Qova Engineering
/// @notice Enforces on-chain spending budgets (daily, monthly, per-transaction) for AI agents.
/// @dev Period resets happen lazily: daily counters reset after 1 day, monthly after 30 days.
///      All limit/amount values are denominated in the same unit as the caller's accounting
///      (e.g., wei, stablecoin base units).
contract BudgetEnforcer is AccessControl {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to set budgets and record spend.
    bytes32 public constant BUDGET_MANAGER_ROLE = keccak256("BUDGET_MANAGER_ROLE");

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @dev Duration of a daily period in seconds (24 hours).
    uint48 private constant DAILY_PERIOD = 1 days;

    /// @dev Duration of a monthly period in seconds (30 days).
    uint48 private constant MONTHLY_PERIOD = 30 days;

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    /// @notice Configuration for an agent's spending limits.
    /// @param dailyLimit   Maximum spend allowed per 24-hour period.
    /// @param monthlyLimit Maximum spend allowed per 30-day period.
    /// @param perTxLimit   Maximum spend allowed in a single transaction.
    struct BudgetConfig {
        uint128 dailyLimit;   // 16 bytes
        uint128 monthlyLimit; // 16 bytes  -- slot 1
        uint128 perTxLimit;   // 16 bytes  -- slot 2
    }

    /// @notice Mutable state tracking an agent's spend within the current periods.
    /// @param dailySpent       Amount spent in the current daily period.
    /// @param monthlySpent     Amount spent in the current monthly period.
    /// @param lastDailyReset   Timestamp when the daily counter was last reset.
    /// @param lastMonthlyReset Timestamp when the monthly counter was last reset.
    struct BudgetState {
        uint128 dailySpent;       // 16 bytes
        uint128 monthlySpent;     // 16 bytes  -- slot 1
        uint48 lastDailyReset;    // 6 bytes
        uint48 lastMonthlyReset;  // 6 bytes   -- slot 2 (12 bytes used)
    }

    /// @notice Read-only snapshot of an agent's remaining budget allowances.
    /// @param dailyRemaining   How much can still be spent in the current daily period.
    /// @param monthlyRemaining How much can still be spent in the current monthly period.
    /// @param perTxLimit       The per-transaction ceiling.
    /// @param dailySpent       Amount already spent in the current daily period.
    /// @param monthlySpent     Amount already spent in the current monthly period.
    struct BudgetStatus {
        uint128 dailyRemaining;
        uint128 monthlyRemaining;
        uint128 perTxLimit;
        uint128 dailySpent;
        uint128 monthlySpent;
    }

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    /// @dev agent address => budget configuration.
    mapping(address => BudgetConfig) private _configs;

    /// @dev agent address => mutable budget state.
    mapping(address => BudgetState) private _states;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when a spend would exceed the combined budget.
    error BudgetExceeded(uint128 requested, uint128 available);

    /// @dev Thrown when a spend would exceed the daily limit.
    error DailyLimitReached(uint128 requested, uint128 remaining);

    /// @dev Thrown when a spend would exceed the monthly limit.
    error MonthlyLimitReached(uint128 requested, uint128 remaining);

    /// @dev Thrown when a single transaction exceeds the per-tx ceiling.
    error PerTxLimitReached(uint128 requested, uint128 limit);

    /// @dev Thrown when an operation targets an agent with no budget configured.
    error NoBudgetSet();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a budget is set or updated for an agent.
    /// @param agent        The agent address.
    /// @param dailyLimit   New daily spending limit.
    /// @param monthlyLimit New monthly spending limit.
    /// @param perTxLimit   New per-transaction spending limit.
    event BudgetSet(
        address indexed agent,
        uint128 dailyLimit,
        uint128 monthlyLimit,
        uint128 perTxLimit
    );

    /// @notice Emitted when spend is recorded against an agent's budget.
    /// @param agent            The agent address.
    /// @param amount           Amount spent.
    /// @param dailyRemaining   Remaining daily budget after spend.
    /// @param monthlyRemaining Remaining monthly budget after spend.
    event SpendRecorded(
        address indexed agent,
        uint128 amount,
        uint128 dailyRemaining,
        uint128 monthlyRemaining
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the enforcer and grants admin + manager roles to the deployer.
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BUDGET_MANAGER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    /// @dev Lazily resets daily and monthly spend counters when their periods have elapsed. // FIX: CONCERNS.md §3.4
    function _resetPeriods(BudgetState storage state, uint48 ts) internal {
        if (ts - state.lastDailyReset >= DAILY_PERIOD) {
            state.dailySpent = 0;
            state.lastDailyReset = ts;
        }
        if (ts - state.lastMonthlyReset >= MONTHLY_PERIOD) {
            state.monthlySpent = 0;
            state.lastMonthlyReset = ts;
        }
    }

    // ──────────────────────────────────────────────
    //  Mutative functions
    // ──────────────────────────────────────────────

    /// @notice Configure spending limits for an agent.
    /// @dev Setting all limits to 0 effectively disables the budget (NoBudgetSet will be thrown
    ///      on subsequent spend attempts). Calling this again overwrites the previous config;
    ///      existing spend counters are preserved.
    /// @param agent        The agent address.
    /// @param dailyLimit   Maximum daily spend.
    /// @param monthlyLimit Maximum monthly spend.
    /// @param perTxLimit   Maximum single-transaction spend.
    function setBudget(
        address agent,
        uint128 dailyLimit,
        uint128 monthlyLimit,
        uint128 perTxLimit
    ) external onlyRole(BUDGET_MANAGER_ROLE) {
        _configs[agent] = BudgetConfig({
            dailyLimit: dailyLimit,
            monthlyLimit: monthlyLimit,
            perTxLimit: perTxLimit
        });

        // Initialise reset timestamps if this is the first budget set.
        BudgetState storage state = _states[agent];
        if (state.lastDailyReset == 0) {
            uint48 ts = uint48(block.timestamp);
            state.lastDailyReset = ts;
            state.lastMonthlyReset = ts;
        }

        emit BudgetSet(agent, dailyLimit, monthlyLimit, perTxLimit);
    }

    /// @notice Record a spend against an agent's budget, enforcing all limits.
    /// @dev Automatically resets daily/monthly counters when their periods have elapsed.
    ///      Reverts with the specific limit that was breached.
    /// @param agent  The agent address.
    /// @param amount The spend amount.
    function recordSpend(
        address agent,
        uint128 amount
    ) external onlyRole(BUDGET_MANAGER_ROLE) {
        BudgetConfig storage config = _configs[agent];
        if (config.dailyLimit == 0 && config.monthlyLimit == 0 && config.perTxLimit == 0) {
            revert NoBudgetSet();
        }

        // --- Per-tx check ---
        if (config.perTxLimit > 0 && amount > config.perTxLimit) {
            revert PerTxLimitReached(amount, config.perTxLimit);
        }

        BudgetState storage state = _states[agent];
        uint48 ts = uint48(block.timestamp);

        // --- Lazy period resets --- // FIX: CONCERNS.md §3.4
        _resetPeriods(state, ts);

        // --- Daily limit check ---
        if (config.dailyLimit > 0) {
            uint128 dailyAfter = state.dailySpent + amount;
            if (dailyAfter > config.dailyLimit) {
                revert DailyLimitReached(amount, config.dailyLimit - state.dailySpent);
            }
        }

        // --- Monthly limit check ---
        if (config.monthlyLimit > 0) {
            uint128 monthlyAfter = state.monthlySpent + amount;
            if (monthlyAfter > config.monthlyLimit) {
                revert MonthlyLimitReached(amount, config.monthlyLimit - state.monthlySpent);
            }
        }

        // --- Effects ---
        unchecked {
            state.dailySpent += amount;
            state.monthlySpent += amount;
        }

        uint128 dailyRemaining = config.dailyLimit > state.dailySpent
            ? config.dailyLimit - state.dailySpent
            : 0;
        uint128 monthlyRemaining = config.monthlyLimit > state.monthlySpent
            ? config.monthlyLimit - state.monthlySpent
            : 0;

        emit SpendRecorded(agent, amount, dailyRemaining, monthlyRemaining);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Check whether a spend of `amount` would be allowed under the agent's budget.
    /// @dev Accounts for lazy period resets without modifying state.
    /// @param agent  The agent address.
    /// @param amount The prospective spend amount.
    /// @return allowed True if the spend would not breach any limit.
    function checkBudget(address agent, uint128 amount) external view returns (bool allowed) {
        BudgetConfig storage config = _configs[agent];

        // No budget configured means no restrictions -- or the caller can treat it as "no budget".
        if (config.dailyLimit == 0 && config.monthlyLimit == 0 && config.perTxLimit == 0) {
            return false;
        }

        // Per-tx check.
        if (config.perTxLimit > 0 && amount > config.perTxLimit) {
            return false;
        }

        BudgetState storage state = _states[agent];
        uint48 ts = uint48(block.timestamp);

        // Simulate daily reset.
        uint128 effectiveDailySpent = state.dailySpent;
        if (ts - state.lastDailyReset >= DAILY_PERIOD) {
            effectiveDailySpent = 0;
        }

        // Simulate monthly reset.
        uint128 effectiveMonthlySpent = state.monthlySpent;
        if (ts - state.lastMonthlyReset >= MONTHLY_PERIOD) {
            effectiveMonthlySpent = 0;
        }

        // Daily limit check.
        if (config.dailyLimit > 0 && effectiveDailySpent + amount > config.dailyLimit) {
            return false;
        }

        // Monthly limit check.
        if (config.monthlyLimit > 0 && effectiveMonthlySpent + amount > config.monthlyLimit) {
            return false;
        }

        return true;
    }

    /// @notice Returns a snapshot of the agent's current budget status.
    /// @dev Accounts for lazy period resets without modifying state.
    /// @param agent The agent address.
    /// @return status The BudgetStatus struct with remaining allowances.
    function getBudgetStatus(address agent) external view returns (BudgetStatus memory status) {
        BudgetConfig storage config = _configs[agent];
        BudgetState storage state = _states[agent];
        uint48 ts = uint48(block.timestamp);

        // Effective daily spent after potential reset.
        uint128 effectiveDailySpent = state.dailySpent;
        if (ts - state.lastDailyReset >= DAILY_PERIOD) {
            effectiveDailySpent = 0;
        }

        // Effective monthly spent after potential reset.
        uint128 effectiveMonthlySpent = state.monthlySpent;
        if (ts - state.lastMonthlyReset >= MONTHLY_PERIOD) {
            effectiveMonthlySpent = 0;
        }

        status = BudgetStatus({
            dailyRemaining: config.dailyLimit > effectiveDailySpent
                ? config.dailyLimit - effectiveDailySpent
                : 0,
            monthlyRemaining: config.monthlyLimit > effectiveMonthlySpent
                ? config.monthlyLimit - effectiveMonthlySpent
                : 0,
            perTxLimit: config.perTxLimit,
            dailySpent: effectiveDailySpent,
            monthlySpent: effectiveMonthlySpent
        });
    }

    /// @notice Check whether a budget has been configured for an agent.
    /// @param agent The agent address.
    /// @return True if at least one limit is non-zero.
    function hasBudget(address agent) external view returns (bool) {
        BudgetConfig storage config = _configs[agent];
        return config.dailyLimit > 0 || config.monthlyLimit > 0 || config.perTxLimit > 0;
    }
}
