/**
 * @qova/core — Real-Time Event Watcher
 *
 * Subscribe to on-chain Qova events to build reactive AI agent monitoring.
 * Useful for dashboards, alerting systems, and orchestration pipelines.
 *
 * Run: bun run examples/watch-events.ts
 */

import {
	watchScoreUpdates,
	watchTransactions,
	watchAgentActions,
	getGrade,
	getScoreColor,
	TRANSACTION_TYPE_LABELS,
	formatWei,
	shortenAddress,
	type TransactionType,
} from "@qova/core";

console.log("🔍 Watching Qova events on Base Sepolia...\n");

// ── Watch all score changes ────────────────────────────────────────

const unwatchScores = watchScoreUpdates(
	{ chain: "base-sepolia" },
	(event) => {
		const agent = shortenAddress(event.agent);
		const oldGrade = getGrade(event.oldScore);
		const newGrade = getGrade(event.newScore);
		const direction = event.newScore > event.oldScore ? "📈" : "📉";

		console.log(
			`${direction} [SCORE] ${agent}: ${event.oldScore} (${oldGrade}) → ${event.newScore} (${newGrade})`,
		);
	},
);

// ── Watch transactions for a specific agent ────────────────────────

const MY_AGENT = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";

const unwatchTx = watchTransactions(
	{ chain: "base-sepolia", agent: MY_AGENT },
	(event) => {
		const label = TRANSACTION_TYPE_LABELS[event.txType as TransactionType] ?? "Unknown";
		const amount = formatWei(event.amount);

		console.log(
			`💸 [TX] ${shortenAddress(event.agent)}: ${label} for ${amount} ETH`,
		);
	},
);

// ── Watch all QovaCore actions ─────────────────────────────────────

const unwatchActions = watchAgentActions(
	{ chain: "base-sepolia" },
	(event) => {
		const label = TRANSACTION_TYPE_LABELS[event.txType as TransactionType] ?? "Unknown";
		console.log(
			`⚡ [ACTION] ${shortenAddress(event.agent)}: ${label} — ${formatWei(event.amount)} ETH`,
		);
	},
);

// ── Graceful shutdown ──────────────────────────────────────────────

process.on("SIGINT", () => {
	console.log("\n🛑 Stopping watchers...");
	unwatchScores();
	unwatchTx();
	unwatchActions();
	process.exit(0);
});

console.log("Press Ctrl+C to stop.\n");
