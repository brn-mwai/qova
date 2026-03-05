// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title QovaPriceFeedConsumer
/// @author Qova Engineering
/// @notice Consumes Chainlink Data Feeds for USD valuation of agent transactions.
/// @dev Used by the scoring algorithm and CRE workflows to value transaction volumes
///      in USD, providing a chain-agnostic financial metric for reputation scoring.
contract QovaPriceFeedConsumer is AccessControl {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to record transaction values.
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Chainlink ETH/USD price feed aggregator.
    AggregatorV3Interface public immutable ethUsdFeed;

    /// @notice Cumulative USD value of recorded transactions per agent (8-decimal precision).
    mapping(address => uint256) public agentTransactionValueUsd;

    /// @notice Total number of USD-valued recordings per agent.
    mapping(address => uint64) public agentRecordingCount;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when the price feed returns a non-positive price.
    error InvalidPrice();

    /// @dev Thrown when the price feed returns stale data (older than 1 hour).
    error StalePrice();

    /// @dev Thrown when a zero address is provided.
    error ZeroAddress();

    /// @dev Thrown when a zero amount is provided.
    error ZeroAmount();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when an agent's transaction value is recorded in USD.
    /// @param agent    The agent address.
    /// @param ethAmount  The ETH amount of the transaction (in wei).
    /// @param usdValue   The USD equivalent (8-decimal precision from Chainlink).
    /// @param timestamp  Block timestamp of the recording.
    event TransactionValueRecorded(
        address indexed agent,
        uint256 ethAmount,
        uint256 usdValue,
        uint48 timestamp
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the consumer with a reference to the Chainlink ETH/USD feed.
    /// @param _ethUsdFeed Address of the Chainlink ETH/USD AggregatorV3Interface on this chain.
    constructor(address _ethUsdFeed) {
        if (_ethUsdFeed == address(0)) revert ZeroAddress();

        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Get the latest ETH/USD price from the Chainlink Data Feed.
    /// @return price The latest price (8-decimal precision).
    /// @return decimals The number of decimals in the price.
    function getLatestEthUsdPrice() public view returns (int256 price, uint8 decimals) {
        uint256 updatedAt;
        (
            ,
            price,
            ,
            updatedAt,

        ) = ethUsdFeed.latestRoundData();

        if (price <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > 3600) revert StalePrice();

        decimals = ethUsdFeed.decimals();
    }

    /// @notice Convert an ETH amount (in wei) to USD using the Chainlink price feed.
    /// @dev Returns a value with 8-decimal precision (matching Chainlink's feed decimals).
    /// @param ethAmount The ETH amount in wei.
    /// @return usdValue The USD equivalent (8-decimal precision).
    function ethToUsd(uint256 ethAmount) public view returns (uint256 usdValue) {
        (int256 price, ) = getLatestEthUsdPrice();
        // ethAmount is in wei (18 decimals), price has 8-decimal precision (Chainlink standard)
        // Result: (wei * price) / 10^18 gives USD with 8-decimal precision
        // casting to uint256 is safe because getLatestEthUsdPrice() reverts if price <= 0
        // forge-lint: disable-next-line(unsafe-typecast)
        usdValue = (ethAmount * uint256(price)) / (10 ** 18);
    }

    /// @notice Get the cumulative USD transaction value for an agent.
    /// @param agent The agent address.
    /// @return totalUsd Cumulative USD value (8-decimal precision).
    /// @return recordCount Number of recordings.
    function getAgentUsdValue(address agent) external view returns (uint256 totalUsd, uint64 recordCount) {
        totalUsd = agentTransactionValueUsd[agent];
        recordCount = agentRecordingCount[agent];
    }

    // ──────────────────────────────────────────────
    //  Mutative functions
    // ──────────────────────────────────────────────

    /// @notice Record an agent's transaction value in USD.
    /// @dev Converts the ETH amount to USD using the Chainlink feed and accumulates it.
    ///      Follows checks-effects-interactions pattern.
    /// @param agent The agent address.
    /// @param ethAmount The transaction value in wei.
    function recordTransactionValue(
        address agent,
        uint256 ethAmount
    ) external onlyRole(RECORDER_ROLE) {
        if (agent == address(0)) revert ZeroAddress();
        if (ethAmount == 0) revert ZeroAmount();

        // --- Checks ---
        uint256 usdValue = ethToUsd(ethAmount);

        // --- Effects ---
        agentTransactionValueUsd[agent] += usdValue;
        unchecked {
            agentRecordingCount[agent] += 1;
        }

        emit TransactionValueRecorded(agent, ethAmount, usdValue, uint48(block.timestamp));
    }
}
