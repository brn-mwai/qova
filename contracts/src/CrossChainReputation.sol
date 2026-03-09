// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

/// @title QovaCrossChainReputation
/// @author Qova Engineering
/// @notice Propagates agent reputation scores across chains via Chainlink CCIP.
/// @dev Sends reputation data to destination chains and receives cross-chain score
///      updates. Maintains a history of cross-chain scores per agent for composite
///      scoring by the CRE reputation oracle.
contract QovaCrossChainReputation is CCIPReceiver, AccessControl {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    /// @notice Role authorised to send cross-chain reputation messages.
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    /// @notice Reputation data received from another chain via CCIP.
    /// @param agent       The agent whose score was reported.
    /// @param score       The reputation score (0-1000).
    /// @param sourceChain The CCIP chain selector of the originating chain.
    /// @param timestamp   The block timestamp when the score was recorded on the source chain.
    struct CrossChainScore {
        address agent;
        uint256 score;
        uint64 sourceChain;
        uint256 timestamp;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Address of the Qova ReputationRegistry on this chain.
    address public reputationRegistry;

    /// @notice Cross-chain scores received per agent.
    mapping(address => CrossChainScore[]) private _crossChainScores;

    /// @notice Count of cross-chain scores per agent (for gas-efficient length checks).
    mapping(address => uint256) public crossChainScoreCount;

    /// @notice Allowlisted destination contracts per chain selector.
    mapping(uint64 => address) public allowlistedDestinations;

    /// @notice Allowlisted source chains for incoming messages.
    mapping(uint64 => bool) public allowlistedSourceChains;

    /// @notice Total CCIP messages sent from this contract.
    uint256 public totalMessagesSent;

    /// @notice Total CCIP messages received by this contract.
    uint256 public totalMessagesReceived;

    /// @notice Maximum number of cross-chain scores stored per agent. // FIX: CONCERNS.md §2.1
    uint256 public constant MAX_SCORES_PER_AGENT = 1000;

    /// @notice Configurable CCIP gas limit for outgoing messages. // FIX: CONCERNS.md §2.4
    uint256 public ccipGasLimit = 200_000;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    /// @dev Thrown when an insufficient fee is provided for CCIP send.
    error InsufficientFee(uint256 required, uint256 provided);

    /// @dev Thrown when a zero address is provided.
    error ZeroAddress();

    /// @dev Thrown when the source chain is not allowlisted.
    error SourceChainNotAllowlisted(uint64 sourceChainSelector);

    /// @dev Thrown when the destination is not configured.
    error DestinationNotConfigured(uint64 destinationChainSelector);

    /// @dev Thrown when the score is out of valid range.
    error InvalidScore(uint256 score);

    /// @dev Thrown when an agent has too many cross-chain scores. // FIX: CONCERNS.md §2.1
    error TooManyScores(address agent);

    /// @dev Thrown when a CCIP gas limit value is invalid. // FIX: CONCERNS.md §2.4
    error InvalidGasLimit();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a reputation score is sent to another chain.
    /// @param agent               The agent whose score was sent.
    /// @param destinationChain    The CCIP chain selector of the destination.
    /// @param messageId           The CCIP message ID.
    /// @param score               The score that was sent.
    event ScoreSent(
        address indexed agent,
        uint64 indexed destinationChain,
        bytes32 messageId,
        uint256 score
    );

    /// @notice Emitted when a reputation score is received from another chain.
    /// @param agent       The agent whose score was received.
    /// @param sourceChain The CCIP chain selector of the source.
    /// @param score       The score that was received.
    event ScoreReceived(
        address indexed agent,
        uint64 indexed sourceChain,
        uint256 score
    );

    /// @notice Emitted when a refund of excess CCIP fee fails. // FIX: CONCERNS.md §1.3
    /// @param recipient The address that should have received the refund.
    /// @param amount    The refund amount that failed to send.
    event RefundFailed(address indexed recipient, uint256 amount);

    /// @notice Emitted when a destination contract is allowlisted.
    /// @param chainSelector  The CCIP chain selector.
    /// @param destination    The contract address on the destination chain.
    event DestinationAllowlisted(uint64 indexed chainSelector, address destination);

    /// @notice Emitted when a source chain is allowlisted or removed.
    /// @param chainSelector The CCIP chain selector.
    /// @param allowed       Whether the chain is now allowed.
    event SourceChainAllowlisted(uint64 indexed chainSelector, bool allowed);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the cross-chain reputation contract.
    /// @param _router             Address of the Chainlink CCIP Router on this chain.
    /// @param _reputationRegistry Address of the Qova ReputationRegistry on this chain.
    constructor(
        address _router,
        address _reputationRegistry
    ) CCIPReceiver(_router) {
        if (_reputationRegistry == address(0)) revert ZeroAddress();

        reputationRegistry = _reputationRegistry;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SENDER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Admin functions
    // ──────────────────────────────────────────────

    /// @notice Allowlist a destination contract for cross-chain sends.
    /// @param chainSelector The CCIP chain selector of the destination.
    /// @param destination   The contract address on the destination chain.
    function setAllowlistedDestination(
        uint64 chainSelector,
        address destination
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (destination == address(0)) revert ZeroAddress();
        allowlistedDestinations[chainSelector] = destination;
        emit DestinationAllowlisted(chainSelector, destination);
    }

    /// @notice Allowlist or remove a source chain for incoming messages.
    /// @param chainSelector The CCIP chain selector.
    /// @param allowed       Whether to allow messages from this chain.
    function setAllowlistedSourceChain(
        uint64 chainSelector,
        bool allowed
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowlistedSourceChains[chainSelector] = allowed;
        emit SourceChainAllowlisted(chainSelector, allowed);
    }

    /// @notice Update the ReputationRegistry reference.
    /// @param _reputationRegistry Address of the new ReputationRegistry.
    function setReputationRegistry(address _reputationRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        reputationRegistry = _reputationRegistry;
    }

    /// @notice Update the CCIP gas limit for outgoing messages. // FIX: CONCERNS.md §2.4
    /// @param newLimit The new gas limit (must be between 1 and 1,000,000).
    function setCcipGasLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newLimit == 0 || newLimit > 1_000_000) revert InvalidGasLimit();
        ccipGasLimit = newLimit;
    }

    // ──────────────────────────────────────────────
    //  Send functions
    // ──────────────────────────────────────────────

    /// @notice Send an agent's reputation score to another chain via CCIP.
    /// @dev Pays fees in native token. Caller must provide sufficient msg.value.
    ///      Follows checks-effects-interactions pattern.
    /// @param destinationChainSelector The CCIP chain selector of the destination.
    /// @param agent The agent whose score to propagate.
    /// @param score The reputation score (0-1000).
    /// @return messageId The CCIP message ID.
    function sendScore(
        uint64 destinationChainSelector,
        address agent,
        uint256 score
    ) external payable onlyRole(SENDER_ROLE) returns (bytes32 messageId) {
        // --- Checks ---
        if (agent == address(0)) revert ZeroAddress();
        if (score > 1000) revert InvalidScore(score);

        address destination = allowlistedDestinations[destinationChainSelector];
        if (destination == address(0)) revert DestinationNotConfigured(destinationChainSelector);

        // Encode the reputation payload
        bytes memory data = abi.encode(agent, score, block.timestamp);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destination),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: ccipGasLimit})),
            feeToken: address(0) // Pay in native
        });

        IRouterClient router = IRouterClient(getRouter());
        uint256 fee = router.getFee(destinationChainSelector, message);

        if (msg.value < fee) revert InsufficientFee(fee, msg.value);

        // --- Effects ---
        unchecked {
            totalMessagesSent += 1;
        }

        // --- Interactions ---
        messageId = router.ccipSend{value: fee}(destinationChainSelector, message);

        // Refund excess fee // FIX: CONCERNS.md §1.3
        if (msg.value > fee) {
            (bool sent,) = msg.sender.call{value: msg.value - fee}("");
            if (!sent) emit RefundFailed(msg.sender, msg.value - fee);
        }

        emit ScoreSent(agent, destinationChainSelector, messageId, score);
    }

    /// @notice Estimate the CCIP fee for sending a score to another chain.
    /// @param destinationChainSelector The CCIP chain selector of the destination.
    /// @param agent The agent address (used to estimate payload size).
    /// @param score The reputation score.
    /// @return fee The estimated fee in native token (wei).
    function estimateSendFee(
        uint64 destinationChainSelector,
        address agent,
        uint256 score
    ) external view returns (uint256 fee) {
        address destination = allowlistedDestinations[destinationChainSelector];
        if (destination == address(0)) revert DestinationNotConfigured(destinationChainSelector);

        bytes memory data = abi.encode(agent, score, block.timestamp);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destination),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: ccipGasLimit})),
            feeToken: address(0)
        });

        fee = IRouterClient(getRouter()).getFee(destinationChainSelector, message);
    }

    // ──────────────────────────────────────────────
    //  Receive functions (CCIP)
    // ──────────────────────────────────────────────

    /// @notice Handle incoming cross-chain reputation data via CCIP.
    /// @dev Decodes the payload as (address agent, uint256 score, uint256 timestamp).
    ///      Only accepts messages from allowlisted source chains.
    /// @param message The CCIP message received from the router.
    function _ccipReceive(
        Client.Any2EVMMessage memory message
    ) internal override {
        // --- Checks ---
        if (!allowlistedSourceChains[message.sourceChainSelector]) {
            revert SourceChainNotAllowlisted(message.sourceChainSelector);
        }

        (address agent, uint256 score, uint256 timestamp) = abi.decode(
            message.data,
            (address, uint256, uint256)
        );

        // --- Effects ---
        if (_crossChainScores[agent].length >= MAX_SCORES_PER_AGENT) revert TooManyScores(agent); // FIX: CONCERNS.md §2.1
        _crossChainScores[agent].push(CrossChainScore({
            agent: agent,
            score: score,
            sourceChain: message.sourceChainSelector,
            timestamp: timestamp
        }));

        unchecked {
            crossChainScoreCount[agent] += 1;
            totalMessagesReceived += 1;
        }

        emit ScoreReceived(agent, message.sourceChainSelector, score);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Get all cross-chain scores for an agent.
    /// @param agent The agent address.
    /// @return An array of CrossChainScore structs.
    function getCrossChainScores(address agent) external view returns (CrossChainScore[] memory) {
        return _crossChainScores[agent];
    }

    /// @notice Get the most recent cross-chain score for an agent from a specific chain.
    /// @param agent The agent address.
    /// @param sourceChain The CCIP chain selector to filter by.
    /// @return score The most recent score from that chain (0 if none).
    /// @return found Whether a score was found.
    function getLatestScoreFromChain(
        address agent,
        uint64 sourceChain
    ) external view returns (uint256 score, bool found) {
        CrossChainScore[] storage scores = _crossChainScores[agent];
        uint256 len = scores.length;

        // Walk backwards to find the most recent entry from the given chain
        for (uint256 i = len; i > 0;) {
            unchecked { --i; }
            if (scores[i].sourceChain == sourceChain) {
                return (scores[i].score, true);
            }
        }

        return (0, false);
    }

    /// @notice Check if an agent has any cross-chain reputation data.
    /// @param agent The agent address.
    /// @return True if at least one cross-chain score exists.
    function hasCrossChainData(address agent) external view returns (bool) {
        return _crossChainScores[agent].length > 0;
    }

    /// @notice Required override for IERC165 + AccessControl compatibility.
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(CCIPReceiver, AccessControl) returns (bool) {
        return CCIPReceiver.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    /// @notice Allow the contract to receive native tokens for CCIP fees.
    receive() external payable {}
}
