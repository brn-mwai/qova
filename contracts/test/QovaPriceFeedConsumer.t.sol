// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {QovaPriceFeedConsumer} from "../src/PriceFeedConsumer.sol";

/// @title MockAggregatorV3
/// @notice Minimal mock of Chainlink AggregatorV3Interface for unit testing.
contract MockAggregatorV3 {
    int256 private _price;
    uint8 private _decimals;
    uint256 private _updatedAt;

    constructor(int256 price_, uint8 decimals_) {
        _price = price_;
        _decimals = decimals_;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _price, block.timestamp, _updatedAt, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /// @dev Test helper: set the price.
    function setPrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
    }

    /// @dev Test helper: simulate stale data by setting updatedAt in the past.
    function setUpdatedAt(uint256 ts) external {
        _updatedAt = ts;
    }
}

contract QovaPriceFeedConsumerTest is Test {
    QovaPriceFeedConsumer public consumer;
    MockAggregatorV3 public mockFeed;

    address public admin = address(this);
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public unauthorized = makeAddr("unauthorized");

    // ETH/USD at $2000.00 with 8 decimals => 200_000_000_000
    int256 public constant ETH_PRICE = 200_000_000_000;
    uint8 public constant FEED_DECIMALS = 8;

    function setUp() public {
        mockFeed = new MockAggregatorV3(ETH_PRICE, FEED_DECIMALS);
        consumer = new QovaPriceFeedConsumer(address(mockFeed));
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    function test_Constructor_SetsEthUsdFeed() public view {
        assertEq(address(consumer.ethUsdFeed()), address(mockFeed));
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(QovaPriceFeedConsumer.ZeroAddress.selector);
        new QovaPriceFeedConsumer(address(0));
    }

    function test_Constructor_GrantsRoles() public view {
        assertTrue(consumer.hasRole(consumer.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(consumer.hasRole(consumer.RECORDER_ROLE(), admin));
    }

    // ──────────────────────────────────────────────
    //  getLatestEthUsdPrice
    // ──────────────────────────────────────────────

    function test_GetLatestEthUsdPrice() public view {
        (int256 price, uint8 decimals) = consumer.getLatestEthUsdPrice();
        assertEq(price, ETH_PRICE);
        assertEq(decimals, FEED_DECIMALS);
    }

    function test_GetLatestEthUsdPrice_RevertsOnNegativePrice() public {
        mockFeed.setPrice(-1);

        vm.expectRevert(QovaPriceFeedConsumer.InvalidPrice.selector);
        consumer.getLatestEthUsdPrice();
    }

    function test_GetLatestEthUsdPrice_RevertsOnZeroPrice() public {
        mockFeed.setPrice(0);

        vm.expectRevert(QovaPriceFeedConsumer.InvalidPrice.selector);
        consumer.getLatestEthUsdPrice();
    }

    function test_GetLatestEthUsdPrice_RevertsOnStalePrice() public {
        // Warp to a reasonable timestamp first (Foundry default is 1)
        vm.warp(10_000);

        // Set updatedAt to more than 1 hour ago
        mockFeed.setUpdatedAt(block.timestamp - 3601);

        vm.expectRevert(QovaPriceFeedConsumer.StalePrice.selector);
        consumer.getLatestEthUsdPrice();
    }

    function test_GetLatestEthUsdPrice_AcceptsFreshPrice() public view {
        // Default updatedAt is block.timestamp, which is within 3600s
        (int256 price, ) = consumer.getLatestEthUsdPrice();
        assertGt(price, 0);
    }

    // ──────────────────────────────────────────────
    //  ethToUsd
    // ──────────────────────────────────────────────

    function test_EthToUsd_OneEther() public view {
        // 1 ETH at $2000 = 200_000_000_000 (8-decimal USD)
        // Formula: (1e18 * 200_000_000_000) / 1e18 = 200_000_000_000
        uint256 usdValue = consumer.ethToUsd(1 ether);
        assertEq(usdValue, 200_000_000_000);
    }

    function test_EthToUsd_HalfEther() public view {
        // 0.5 ETH at $2000 = $1000 = 100_000_000_000 (8-decimal)
        uint256 usdValue = consumer.ethToUsd(0.5 ether);
        assertEq(usdValue, 100_000_000_000);
    }

    function test_EthToUsd_SmallAmount() public view {
        // 0.001 ETH at $2000 = $2 = 200_000_000 (8-decimal)
        uint256 usdValue = consumer.ethToUsd(0.001 ether);
        assertEq(usdValue, 200_000_000);
    }

    function test_EthToUsd_ZeroAmount() public view {
        uint256 usdValue = consumer.ethToUsd(0);
        assertEq(usdValue, 0);
    }

    // ──────────────────────────────────────────────
    //  recordTransactionValue
    // ──────────────────────────────────────────────

    function test_RecordTransactionValue() public {
        uint256 ethAmount = 1 ether;
        uint256 expectedUsd = 200_000_000_000; // $2000 in 8-decimal

        vm.expectEmit(true, false, false, true);
        emit QovaPriceFeedConsumer.TransactionValueRecorded(
            agent1,
            ethAmount,
            expectedUsd,
            uint48(block.timestamp)
        );

        consumer.recordTransactionValue(agent1, ethAmount);

        (uint256 totalUsd, uint64 recordCount) = consumer.getAgentUsdValue(agent1);
        assertEq(totalUsd, expectedUsd);
        assertEq(recordCount, 1);
    }

    function test_RecordTransactionValue_Accumulates() public {
        consumer.recordTransactionValue(agent1, 1 ether);
        consumer.recordTransactionValue(agent1, 2 ether);

        (uint256 totalUsd, uint64 recordCount) = consumer.getAgentUsdValue(agent1);
        // 1 ETH + 2 ETH = 3 ETH * $2000 = $6000 = 600_000_000_000 (8-dec)
        assertEq(totalUsd, 600_000_000_000);
        assertEq(recordCount, 2);
    }

    function test_RecordTransactionValue_MultipleAgents() public {
        consumer.recordTransactionValue(agent1, 1 ether);
        consumer.recordTransactionValue(agent2, 3 ether);

        (uint256 usd1, uint64 count1) = consumer.getAgentUsdValue(agent1);
        (uint256 usd2, uint64 count2) = consumer.getAgentUsdValue(agent2);

        assertEq(usd1, 200_000_000_000); // $2000
        assertEq(count1, 1);
        assertEq(usd2, 600_000_000_000); // $6000
        assertEq(count2, 1);
    }

    function test_RecordTransactionValue_RevertsOnZeroAddress() public {
        vm.expectRevert(QovaPriceFeedConsumer.ZeroAddress.selector);
        consumer.recordTransactionValue(address(0), 1 ether);
    }

    function test_RecordTransactionValue_RevertsOnZeroAmount() public {
        vm.expectRevert(QovaPriceFeedConsumer.ZeroAmount.selector);
        consumer.recordTransactionValue(agent1, 0);
    }

    function test_RecordTransactionValue_RevertsForUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        consumer.recordTransactionValue(agent1, 1 ether);
    }

    // ──────────────────────────────────────────────
    //  Price change scenarios
    // ──────────────────────────────────────────────

    function test_RecordTransactionValue_ReflectsPriceChange() public {
        // Record at $2000
        consumer.recordTransactionValue(agent1, 1 ether);

        // Price changes to $3000
        mockFeed.setPrice(300_000_000_000);

        // Record another 1 ETH at $3000
        consumer.recordTransactionValue(agent1, 1 ether);

        (uint256 totalUsd, uint64 recordCount) = consumer.getAgentUsdValue(agent1);
        // $2000 + $3000 = $5000 = 500_000_000_000 (8-dec)
        assertEq(totalUsd, 500_000_000_000);
        assertEq(recordCount, 2);
    }

    // ──────────────────────────────────────────────
    //  Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_EthToUsd(uint128 ethAmount) public view {
        // Any amount should not revert (the mock price is always valid and fresh)
        uint256 usdValue = consumer.ethToUsd(uint256(ethAmount));

        // Manual calculation: (ethAmount * ETH_PRICE) / 1e18
        uint256 expected = (uint256(ethAmount) * uint256(ETH_PRICE)) / (10 ** 18);
        assertEq(usdValue, expected);
    }

    function testFuzz_RecordTransactionValue(uint128 ethAmount) public {
        vm.assume(ethAmount > 0);

        consumer.recordTransactionValue(agent1, uint256(ethAmount));

        (uint256 totalUsd, uint64 recordCount) = consumer.getAgentUsdValue(agent1);
        uint256 expected = (uint256(ethAmount) * uint256(ETH_PRICE)) / (10 ** 18);
        assertEq(totalUsd, expected);
        assertEq(recordCount, 1);
    }
}
