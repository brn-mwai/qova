// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {QovaCrossChainReputation} from "../src/CrossChainReputation.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

/// @title MockCCIPRouter
/// @notice Minimal mock of the Chainlink CCIP Router for unit testing.
contract MockCCIPRouter {
    uint256 private _fee;
    bytes32 private _messageId;
    uint256 public messagesSent;

    constructor(uint256 fee_) {
        _fee = fee_;
        _messageId = keccak256("mock-message-id");
    }

    function getFee(
        uint64, /* destinationChainSelector */
        Client.EVM2AnyMessage memory /* message */
    ) external view returns (uint256) {
        return _fee;
    }

    function ccipSend(
        uint64, /* destinationChainSelector */
        Client.EVM2AnyMessage calldata /* message */
    ) external payable returns (bytes32) {
        messagesSent += 1;
        return _messageId;
    }

    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    /// @dev Test helper: set the fee.
    function setFee(uint256 newFee) external {
        _fee = newFee;
    }

    /// @dev Test helper: set the message ID returned by ccipSend.
    function setMessageId(bytes32 newId) external {
        _messageId = newId;
    }

    /// @dev Allow receiving ETH (fees).
    receive() external payable {}
}

contract QovaCrossChainReputationTest is Test {
    QovaCrossChainReputation public ccr;
    MockCCIPRouter public mockRouter;

    address public admin = address(this);
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public unauthorized = makeAddr("unauthorized");
    address public reputationRegistry = makeAddr("reputationRegistry");

    // CCIP chain selectors (arbitrary values for testing)
    uint64 public constant ETHEREUM_SELECTOR = 16015286601757825753;
    uint64 public constant ARBITRUM_SELECTOR = 3478487238524512106;

    // Mock destination contract on the remote chain
    address public constant REMOTE_RECEIVER = address(0xBEEF);

    // CCIP fee in wei
    uint256 public constant CCIP_FEE = 0.01 ether;

    function setUp() public {
        mockRouter = new MockCCIPRouter(CCIP_FEE);
        ccr = new QovaCrossChainReputation(address(mockRouter), reputationRegistry);

        // Allowlist Ethereum Sepolia as a destination with a remote receiver
        ccr.setAllowlistedDestination(ETHEREUM_SELECTOR, REMOTE_RECEIVER);

        // Allowlist Ethereum Sepolia as a source chain
        ccr.setAllowlistedSourceChain(ETHEREUM_SELECTOR, true);
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    function test_Constructor_SetsRouter() public view {
        assertEq(ccr.getRouter(), address(mockRouter));
    }

    function test_Constructor_SetsReputationRegistry() public view {
        assertEq(ccr.reputationRegistry(), reputationRegistry);
    }

    function test_Constructor_GrantsRoles() public view {
        assertTrue(ccr.hasRole(ccr.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(ccr.hasRole(ccr.SENDER_ROLE(), admin));
    }

    function test_Constructor_RevertsOnZeroRegistry() public {
        vm.expectRevert(QovaCrossChainReputation.ZeroAddress.selector);
        new QovaCrossChainReputation(address(mockRouter), address(0));
    }

    // ──────────────────────────────────────────────
    //  Admin: setAllowlistedDestination
    // ──────────────────────────────────────────────

    function test_SetAllowlistedDestination() public {
        address newDest = makeAddr("newDest");

        vm.expectEmit(true, false, false, true);
        emit QovaCrossChainReputation.DestinationAllowlisted(ARBITRUM_SELECTOR, newDest);

        ccr.setAllowlistedDestination(ARBITRUM_SELECTOR, newDest);
        assertEq(ccr.allowlistedDestinations(ARBITRUM_SELECTOR), newDest);
    }

    function test_SetAllowlistedDestination_RevertsOnZeroAddress() public {
        vm.expectRevert(QovaCrossChainReputation.ZeroAddress.selector);
        ccr.setAllowlistedDestination(ARBITRUM_SELECTOR, address(0));
    }

    function test_SetAllowlistedDestination_RevertsForUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        ccr.setAllowlistedDestination(ARBITRUM_SELECTOR, REMOTE_RECEIVER);
    }

    // ──────────────────────────────────────────────
    //  Admin: setAllowlistedSourceChain
    // ──────────────────────────────────────────────

    function test_SetAllowlistedSourceChain() public {
        vm.expectEmit(true, false, false, true);
        emit QovaCrossChainReputation.SourceChainAllowlisted(ARBITRUM_SELECTOR, true);

        ccr.setAllowlistedSourceChain(ARBITRUM_SELECTOR, true);
        assertTrue(ccr.allowlistedSourceChains(ARBITRUM_SELECTOR));

        ccr.setAllowlistedSourceChain(ARBITRUM_SELECTOR, false);
        assertFalse(ccr.allowlistedSourceChains(ARBITRUM_SELECTOR));
    }

    // ──────────────────────────────────────────────
    //  Admin: setReputationRegistry
    // ──────────────────────────────────────────────

    function test_SetReputationRegistry() public {
        address newReg = makeAddr("newRegistry");
        ccr.setReputationRegistry(newReg);
        assertEq(ccr.reputationRegistry(), newReg);
    }

    function test_SetReputationRegistry_RevertsOnZeroAddress() public {
        vm.expectRevert(QovaCrossChainReputation.ZeroAddress.selector);
        ccr.setReputationRegistry(address(0));
    }

    // ──────────────────────────────────────────────
    //  sendScore
    // ──────────────────────────────────────────────

    function test_SendScore() public {
        uint256 score = 850;

        vm.expectEmit(true, true, false, true);
        emit QovaCrossChainReputation.ScoreSent(
            agent1,
            ETHEREUM_SELECTOR,
            keccak256("mock-message-id"),
            score
        );

        bytes32 messageId = ccr.sendScore{value: CCIP_FEE}(
            ETHEREUM_SELECTOR,
            agent1,
            score
        );

        assertEq(messageId, keccak256("mock-message-id"));
        assertEq(ccr.totalMessagesSent(), 1);
        assertEq(mockRouter.messagesSent(), 1);
    }

    function test_SendScore_RefundsExcess() public {
        uint256 excess = 0.05 ether;
        uint256 totalSent = CCIP_FEE + excess;

        ccr.sendScore{value: totalSent}(ETHEREUM_SELECTOR, agent1, 500);

        // Verify the send completed successfully despite excess value
        assertEq(ccr.totalMessagesSent(), 1);
    }

    function test_SendScore_RevertsOnZeroAddress() public {
        vm.expectRevert(QovaCrossChainReputation.ZeroAddress.selector);
        ccr.sendScore{value: CCIP_FEE}(ETHEREUM_SELECTOR, address(0), 500);
    }

    function test_SendScore_RevertsOnInvalidScore() public {
        vm.expectRevert(abi.encodeWithSelector(QovaCrossChainReputation.InvalidScore.selector, 1001));
        ccr.sendScore{value: CCIP_FEE}(ETHEREUM_SELECTOR, agent1, 1001);
    }

    function test_SendScore_RevertsOnUnconfiguredDestination() public {
        vm.expectRevert(
            abi.encodeWithSelector(QovaCrossChainReputation.DestinationNotConfigured.selector, ARBITRUM_SELECTOR)
        );
        ccr.sendScore{value: CCIP_FEE}(ARBITRUM_SELECTOR, agent1, 500);
    }

    function test_SendScore_RevertsOnInsufficientFee() public {
        uint256 tooLow = CCIP_FEE - 1;

        vm.expectRevert(
            abi.encodeWithSelector(QovaCrossChainReputation.InsufficientFee.selector, CCIP_FEE, tooLow)
        );
        ccr.sendScore{value: tooLow}(ETHEREUM_SELECTOR, agent1, 500);
    }

    function test_SendScore_RevertsForUnauthorized() public {
        vm.deal(unauthorized, 1 ether);
        vm.prank(unauthorized);
        vm.expectRevert();
        ccr.sendScore{value: CCIP_FEE}(ETHEREUM_SELECTOR, agent1, 500);
    }

    // ──────────────────────────────────────────────
    //  estimateSendFee
    // ──────────────────────────────────────────────

    function test_EstimateSendFee() public view {
        uint256 fee = ccr.estimateSendFee(ETHEREUM_SELECTOR, agent1, 800);
        assertEq(fee, CCIP_FEE);
    }

    function test_EstimateSendFee_RevertsOnUnconfiguredDestination() public {
        vm.expectRevert(
            abi.encodeWithSelector(QovaCrossChainReputation.DestinationNotConfigured.selector, ARBITRUM_SELECTOR)
        );
        ccr.estimateSendFee(ARBITRUM_SELECTOR, agent1, 500);
    }

    // ──────────────────────────────────────────────
    //  _ccipReceive (via simulated router call)
    // ──────────────────────────────────────────────

    function test_CcipReceive_StoresScore() public {
        // Build the CCIP message as the router would deliver it
        uint256 score = 750;
        uint256 timestamp = block.timestamp;
        bytes memory data = abi.encode(agent1, score, timestamp);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("incoming-msg"),
            sourceChainSelector: ETHEREUM_SELECTOR,
            sender: abi.encode(REMOTE_RECEIVER),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        // Call ccipReceive as if we are the router
        vm.prank(address(mockRouter));

        vm.expectEmit(true, true, false, true);
        emit QovaCrossChainReputation.ScoreReceived(agent1, ETHEREUM_SELECTOR, score);

        ccr.ccipReceive(message);

        // Verify storage
        assertEq(ccr.crossChainScoreCount(agent1), 1);
        assertEq(ccr.totalMessagesReceived(), 1);
        assertTrue(ccr.hasCrossChainData(agent1));

        // Verify the score data
        QovaCrossChainReputation.CrossChainScore[] memory scores = ccr.getCrossChainScores(agent1);
        assertEq(scores.length, 1);
        assertEq(scores[0].agent, agent1);
        assertEq(scores[0].score, score);
        assertEq(scores[0].sourceChain, ETHEREUM_SELECTOR);
        assertEq(scores[0].timestamp, timestamp);
    }

    function test_CcipReceive_MultipleScores() public {
        // Receive two scores from different chains
        _simulateIncomingMessage(agent1, 700, ETHEREUM_SELECTOR);

        // Allowlist Arbitrum as source
        ccr.setAllowlistedSourceChain(ARBITRUM_SELECTOR, true);
        _simulateIncomingMessage(agent1, 850, ARBITRUM_SELECTOR);

        assertEq(ccr.crossChainScoreCount(agent1), 2);
        assertEq(ccr.totalMessagesReceived(), 2);

        QovaCrossChainReputation.CrossChainScore[] memory scores = ccr.getCrossChainScores(agent1);
        assertEq(scores.length, 2);
        assertEq(scores[0].score, 700);
        assertEq(scores[0].sourceChain, ETHEREUM_SELECTOR);
        assertEq(scores[1].score, 850);
        assertEq(scores[1].sourceChain, ARBITRUM_SELECTOR);
    }

    function test_CcipReceive_RevertsOnUnallowlistedSource() public {
        bytes memory data = abi.encode(agent1, uint256(500), block.timestamp);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-source"),
            sourceChainSelector: ARBITRUM_SELECTOR, // Not allowlisted
            sender: abi.encode(REMOTE_RECEIVER),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(address(mockRouter));
        vm.expectRevert(
            abi.encodeWithSelector(QovaCrossChainReputation.SourceChainNotAllowlisted.selector, ARBITRUM_SELECTOR)
        );
        ccr.ccipReceive(message);
    }

    function test_CcipReceive_RevertsIfNotRouter() public {
        bytes memory data = abi.encode(agent1, uint256(500), block.timestamp);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("not-router"),
            sourceChainSelector: ETHEREUM_SELECTOR,
            sender: abi.encode(REMOTE_RECEIVER),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        // Call from a non-router address
        vm.prank(unauthorized);
        vm.expectRevert();
        ccr.ccipReceive(message);
    }

    // ──────────────────────────────────────────────
    //  getLatestScoreFromChain
    // ──────────────────────────────────────────────

    function test_GetLatestScoreFromChain() public {
        // Send multiple scores from Ethereum
        _simulateIncomingMessage(agent1, 600, ETHEREUM_SELECTOR);
        _simulateIncomingMessage(agent1, 750, ETHEREUM_SELECTOR);
        _simulateIncomingMessage(agent1, 900, ETHEREUM_SELECTOR);

        (uint256 score, bool found) = ccr.getLatestScoreFromChain(agent1, ETHEREUM_SELECTOR);
        assertTrue(found);
        assertEq(score, 900); // Most recent
    }

    function test_GetLatestScoreFromChain_NotFound() public view {
        (uint256 score, bool found) = ccr.getLatestScoreFromChain(agent1, ETHEREUM_SELECTOR);
        assertFalse(found);
        assertEq(score, 0);
    }

    function test_GetLatestScoreFromChain_FiltersByChain() public {
        _simulateIncomingMessage(agent1, 700, ETHEREUM_SELECTOR);

        ccr.setAllowlistedSourceChain(ARBITRUM_SELECTOR, true);
        _simulateIncomingMessage(agent1, 850, ARBITRUM_SELECTOR);

        (uint256 ethScore, bool ethFound) = ccr.getLatestScoreFromChain(agent1, ETHEREUM_SELECTOR);
        assertTrue(ethFound);
        assertEq(ethScore, 700);

        (uint256 arbScore, bool arbFound) = ccr.getLatestScoreFromChain(agent1, ARBITRUM_SELECTOR);
        assertTrue(arbFound);
        assertEq(arbScore, 850);
    }

    // ──────────────────────────────────────────────
    //  hasCrossChainData
    // ──────────────────────────────────────────────

    function test_HasCrossChainData_FalseWhenEmpty() public view {
        assertFalse(ccr.hasCrossChainData(agent1));
    }

    function test_HasCrossChainData_TrueAfterReceive() public {
        _simulateIncomingMessage(agent1, 500, ETHEREUM_SELECTOR);
        assertTrue(ccr.hasCrossChainData(agent1));
    }

    // ──────────────────────────────────────────────
    //  supportsInterface
    // ──────────────────────────────────────────────

    function test_SupportsInterface() public view {
        // Should support both AccessControl and CCIPReceiver interfaces
        // IERC165 interface ID
        assertTrue(ccr.supportsInterface(0x01ffc9a7));
    }

    // ──────────────────────────────────────────────
    //  receive() -- contract can accept ETH
    // ──────────────────────────────────────────────

    function test_ReceiveEth() public {
        vm.deal(admin, 1 ether);
        (bool sent, ) = address(ccr).call{value: 0.1 ether}("");
        assertTrue(sent);
        assertEq(address(ccr).balance, 0.1 ether);
    }

    // ──────────────────────────────────────────────
    //  Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_SendScore(uint16 score) public {
        score = uint16(bound(score, 0, 1000));

        vm.deal(admin, 1 ether);
        ccr.sendScore{value: CCIP_FEE}(ETHEREUM_SELECTOR, agent1, uint256(score));

        assertEq(ccr.totalMessagesSent(), 1);
    }

    function testFuzz_CcipReceive(uint16 score) public {
        _simulateIncomingMessage(agent1, uint256(score), ETHEREUM_SELECTOR);

        QovaCrossChainReputation.CrossChainScore[] memory scores = ccr.getCrossChainScores(agent1);
        assertEq(scores.length, 1);
        assertEq(scores[0].score, uint256(score));
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    /// @dev Simulate an incoming CCIP message from the router.
    function _simulateIncomingMessage(
        address agent,
        uint256 score,
        uint64 sourceChain
    ) internal {
        bytes memory data = abi.encode(agent, score, block.timestamp);

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256(abi.encodePacked("msg", block.timestamp, score)),
            sourceChainSelector: sourceChain,
            sender: abi.encode(REMOTE_RECEIVER),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(address(mockRouter));
        ccr.ccipReceive(message);
    }
}
