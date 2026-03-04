/**
 * @qova/core — Quick Start Example
 *
 * Demonstrates the most common SDK operations:
 * reading an agent's score, registering, and executing actions.
 *
 * Run: bun run examples/quickstart.ts
 */

import { createQovaClient, getGrade, TransactionType } from "@qova/core";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ── 1. Read-only client (no wallet needed) ─────────────────────────

const reader = createQovaClient({ chain: "base-sepolia" });

const agentAddress = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";

// Check if the agent exists
const isRegistered = await reader.isAgentRegistered(agentAddress);
console.log(`Agent registered: ${isRegistered}`);

if (isRegistered) {
	// Read score
	const score = await reader.getScore(agentAddress);
	console.log(`Score: ${score} (${getGrade(score)})`);

	// Read full details
	const details = await reader.getAgentDetails(agentAddress);
	console.log("Agent details:", details);

	// Read budget status
	const budget = await reader.getBudgetStatus(agentAddress);
	console.log("Daily remaining:", budget.dailyRemaining.toString());

	// Read transaction stats
	const stats = await reader.getTransactionStats(agentAddress);
	console.log(`Total transactions: ${stats.totalCount}`);
}

// ── 2. Write client (wallet required) ──────────────────────────────

// ⚠️ Never hardcode keys in production — use env vars
const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
if (!privateKey) {
	console.log("\nSkipping write examples (no PRIVATE_KEY in env)");
	process.exit(0);
}

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
	account,
	chain: baseSepolia,
	transport: http(),
});

const writer = createQovaClient({
	chain: "base-sepolia",
	walletClient,
});

// Register a new agent
const newAgent = "0x0000000000000000000000000000000000000042";
const registerTx = await writer.registerAgent(newAgent);
console.log(`\nRegistered agent: ${registerTx}`);

// Set budget limits: 1 ETH/day, 10 ETH/month, 0.5 ETH/tx
const budgetTx = await writer.setBudget(
	newAgent,
	parseEther("1"), // daily
	parseEther("10"), // monthly
	parseEther("0.5"), // per tx
);
console.log(`Budget set: ${budgetTx}`);

// Execute an agent action (validates budget → records tx → emits event)
const actionTx = await writer.executeAgentAction(
	newAgent,
	"0x0000000000000000000000000000000000000000000000000000000000000001",
	parseEther("0.1"),
	TransactionType.PAYMENT,
);
console.log(`Action executed: ${actionTx}`);
