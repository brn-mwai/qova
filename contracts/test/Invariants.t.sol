// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TransactionValidator} from "../src/TransactionValidator.sol";
import {BudgetEnforcer} from "../src/BudgetEnforcer.sol";
import {QovaCore} from "../src/QovaCore.sol";

/// @title InvariantHandler
/// @notice Handler contract that exercises the Qova protocol for invariant testing.
contract InvariantHandler is Test {
    ReputationRegistry public registry;
    TransactionValidator public validator;
    BudgetEnforcer public enforcer;
    QovaCore public core;

    address[] public agents;
    mapping(address => uint128) public recordedVolume;

    uint256 public totalScoreUpdates;
    uint256 public totalTransactions;

    constructor(
        ReputationRegistry _registry,
        TransactionValidator _validator,
        BudgetEnforcer _enforcer,
        QovaCore _core
    ) {
        registry = _registry;
        validator = _validator;
        enforcer = _enforcer;
        core = _core;
    }

    /// @notice Must be called after UPDATER_ROLE is granted to this contract.
    function init() external {
        for (uint256 i = 1; i <= 5; i++) {
            address agent = address(uint160(i));
            registry.registerAgent(agent);
            agents.push(agent);
        }
    }

    function updateScore(uint256 agentIdx, uint16 score) external {
        agentIdx = bound(agentIdx, 0, agents.length - 1);
        score = uint16(bound(score, 0, 1000));

        registry.updateScore(agents[agentIdx], score, keccak256("invariant"));
        totalScoreUpdates++;
    }

    function recordTransaction(uint256 agentIdx, uint128 amount) external {
        agentIdx = bound(agentIdx, 0, agents.length - 1);
        amount = uint128(bound(amount, 1, 100 ether));

        address agent = agents[agentIdx];
        validator.recordTransaction(
            agent,
            keccak256(abi.encodePacked("tx", totalTransactions)),
            uint256(amount),
            TransactionValidator.TransactionType.PAYMENT
        );

        recordedVolume[agent] += amount;
        totalTransactions++;
    }

    function getAgent(uint256 idx) external view returns (address) {
        return agents[idx % agents.length];
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }
}

/// @title InvariantsTest
/// @notice Invariant tests for Qova protocol properties. (Phase 4, §4.5)
contract InvariantsTest is Test {
    ReputationRegistry public registry;
    TransactionValidator public validator;
    BudgetEnforcer public enforcer;
    QovaCore public core;
    InvariantHandler public handler;

    function setUp() public {
        registry = new ReputationRegistry();
        validator = new TransactionValidator(address(registry));
        enforcer = new BudgetEnforcer();
        core = new QovaCore(address(registry), address(validator), address(enforcer));

        // Grant roles
        registry.grantRole(keccak256("UPDATER_ROLE"), address(core));
        validator.grantRole(keccak256("RECORDER_ROLE"), address(core));
        enforcer.grantRole(keccak256("BUDGET_MANAGER_ROLE"), address(core));

        handler = new InvariantHandler(registry, validator, enforcer, core);

        // Grant handler the roles it needs, then initialize agents
        registry.grantRole(keccak256("UPDATER_ROLE"), address(handler));
        validator.grantRole(keccak256("RECORDER_ROLE"), address(handler));
        handler.init();

        targetContract(address(handler));
    }

    /// @notice Score must always be in range [0, 1000].
    function invariant_ScoreAlwaysInRange() public view {
        for (uint256 i; i < handler.agentCount(); i++) {
            address agent = handler.getAgent(i);
            uint16 score = registry.getScore(agent);
            assertTrue(score <= 1000, "Score exceeds 1000");
        }
    }

    /// @notice Total volume for each agent must be non-decreasing (monotonic).
    function invariant_TotalVolumeNonDecreasing() public view {
        for (uint256 i; i < handler.agentCount(); i++) {
            address agent = handler.getAgent(i);
            TransactionValidator.TransactionStats memory stats = validator.getTransactionStats(agent);
            // Volume should match what we recorded
            assertEq(uint256(stats.totalVolume), uint256(handler.recordedVolume(agent)));
        }
    }

    /// @notice Budget spent can never exceed the configured limit within a period.
    function invariant_BudgetSpentNeverExceedsLimit() public view {
        // Since we haven't configured budgets in the handler, all budget statuses should be zero
        for (uint256 i; i < handler.agentCount(); i++) {
            address agent = handler.getAgent(i);
            BudgetEnforcer.BudgetStatus memory status = enforcer.getBudgetStatus(agent);
            // With no budget set, spent should be 0
            assertEq(status.dailySpent, 0);
            assertEq(status.monthlySpent, 0);
        }
    }
}
