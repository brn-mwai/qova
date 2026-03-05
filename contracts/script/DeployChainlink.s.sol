// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {QovaPriceFeedConsumer} from "../src/PriceFeedConsumer.sol";
import {QovaCrossChainReputation} from "../src/CrossChainReputation.sol";

/// @title DeployChainlink
/// @notice Deployment script for Qova Chainlink integrations (Price Feed + CCIP).
/// @dev Deploys QovaPriceFeedConsumer and QovaCrossChainReputation, then wires
///      roles to the existing QovaCore facade. Run with:
///      forge script script/DeployChainlink.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
contract DeployChainlink is Script {
    // ──────────────────────────────────────────────
    //  Base Sepolia addresses (verified from Chainlink docs)
    // ──────────────────────────────────────────────

    /// @dev Chainlink ETH/USD Data Feed on Base Sepolia.
    address constant ETH_USD_FEED = 0x4ADc67fae2A8116c8D24ed0A1ca6feB26787A0b9;

    /// @dev Chainlink CCIP Router on Base Sepolia.
    address constant CCIP_ROUTER = 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93;

    // ──────────────────────────────────────────────
    //  Existing deployment addresses (from deployments/base-sepolia.json)
    // ──────────────────────────────────────────────

    /// @dev Already-deployed ReputationRegistry on Base Sepolia.
    address constant REPUTATION_REGISTRY = 0x0b2466b01E6d73A24D9C716A9072ED3923563fBB;

    /// @dev Already-deployed QovaCore on Base Sepolia.
    address constant QOVA_CORE = 0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a;

    function run() external {
        vm.startBroadcast();

        // ── Deploy QovaPriceFeedConsumer ──────────────
        QovaPriceFeedConsumer priceFeed = new QovaPriceFeedConsumer(ETH_USD_FEED);

        // Grant RECORDER_ROLE to QovaCore so it can record USD-valued transactions
        priceFeed.grantRole(priceFeed.RECORDER_ROLE(), QOVA_CORE);

        // ── Deploy QovaCrossChainReputation ───────────
        QovaCrossChainReputation crossChain = new QovaCrossChainReputation(
            CCIP_ROUTER,
            REPUTATION_REGISTRY
        );

        // Grant SENDER_ROLE to QovaCore so it can initiate cross-chain score sends
        crossChain.grantRole(crossChain.SENDER_ROLE(), QOVA_CORE);

        // ── Log deployment ───────────────────────────
        console.log("=== Qova Chainlink Deployment Complete ===");
        console.log("");
        console.log("QovaPriceFeedConsumer:", address(priceFeed));
        console.log("  ETH/USD Feed:", ETH_USD_FEED);
        console.log("");
        console.log("QovaCrossChainReputation:", address(crossChain));
        console.log("  CCIP Router:", CCIP_ROUTER);
        console.log("  ReputationRegistry:", REPUTATION_REGISTRY);
        console.log("");
        console.log("Roles Granted:");
        console.log("  RECORDER_ROLE -> QovaCore on PriceFeedConsumer");
        console.log("  SENDER_ROLE   -> QovaCore on CrossChainReputation");
        console.log("");
        console.log("Deployer:", msg.sender);
        console.log("Chain ID:", block.chainid);

        vm.stopBroadcast();
    }
}
