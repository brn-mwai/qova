/**
 * @qova/core — AI Agent Trust Middleware
 *
 * Shows how to add Qova trust checks to your AI agent before it
 * executes financial actions. Works with any agent framework.
 *
 * Run: bun run examples/agent-middleware.ts
 */

import {
	createQovaClient,
	type QovaClient,
	getGrade,
	formatWei,
	TransactionType,
	type ScoreGrade,
	BudgetExceededError,
	AgentNotRegisteredError,
} from "@qova/core";
import type { Address, Hex } from "viem";

// ── Trust Policy ───────────────────────────────────────────────────

/** Define your trust policy: minimum grade required per action value. */
const TRUST_POLICY = {
	/** Under 0.01 ETH — any registered agent is fine */
	LOW: { maxAmount: 10000000000000000n, minGrade: "D" as ScoreGrade },
	/** 0.01–1 ETH — need at least BB grade */
	MEDIUM: { maxAmount: 1000000000000000000n, minGrade: "BB" as ScoreGrade },
	/** Over 1 ETH — need A grade or higher */
	HIGH: { maxAmount: BigInt(Number.MAX_SAFE_INTEGER), minGrade: "A" as ScoreGrade },
} as const;

const GRADE_ORDER: ScoreGrade[] = [
	"D", "C", "CC", "CCC", "B", "BB", "BBB", "A", "AA", "AAA",
];

function meetsGrade(actual: ScoreGrade, required: ScoreGrade): boolean {
	return GRADE_ORDER.indexOf(actual) >= GRADE_ORDER.indexOf(required);
}

// ── Trust Check Function ───────────────────────────────────────────

interface TrustCheckResult {
	allowed: boolean;
	score: number;
	grade: ScoreGrade;
	reason?: string;
}

async function checkAgentTrust(
	qova: QovaClient,
	agent: Address,
	amount: bigint,
): Promise<TrustCheckResult> {
	// 1. Is the agent registered?
	const registered = await qova.isAgentRegistered(agent);
	if (!registered) {
		return { allowed: false, score: 0, grade: "D", reason: "Agent not registered in Qova" };
	}

	// 2. Get current score
	const score = await qova.getScore(agent);
	const grade = getGrade(score);

	// 3. Check budget
	const withinBudget = await qova.checkBudget(agent, amount);
	if (!withinBudget) {
		return { allowed: false, score, grade, reason: "Budget limit exceeded" };
	}

	// 4. Check trust policy
	let requiredGrade: ScoreGrade = "D";
	for (const tier of Object.values(TRUST_POLICY)) {
		if (amount <= tier.maxAmount) {
			requiredGrade = tier.minGrade;
			break;
		}
	}

	if (!meetsGrade(grade, requiredGrade)) {
		return {
			allowed: false,
			score,
			grade,
			reason: `Grade ${grade} below required ${requiredGrade} for ${formatWei(amount)} ETH`,
		};
	}

	return { allowed: true, score, grade };
}

// ── Example Usage ──────────────────────────────────────────────────

async function main(): Promise<void> {
	const qova = createQovaClient({ chain: "base-sepolia" });
	const agent = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158" as Address;

	console.log("🤖 AI Agent Trust Check\n");

	// Simulate different transaction sizes
	const testAmounts = [
		{ label: "Small payment", amount: 5000000000000000n }, // 0.005 ETH
		{ label: "Medium payment", amount: 500000000000000000n }, // 0.5 ETH
		{ label: "Large payment", amount: 5000000000000000000n }, // 5 ETH
	];

	for (const test of testAmounts) {
		const result = await checkAgentTrust(qova, agent, test.amount);
		const status = result.allowed ? "✅ ALLOWED" : "❌ BLOCKED";
		console.log(`${test.label} (${formatWei(test.amount)} ETH):`);
		console.log(`  ${status} — Score: ${result.score} (${result.grade})`);
		if (result.reason) console.log(`  Reason: ${result.reason}`);
		console.log();
	}
}

main().catch(console.error);
