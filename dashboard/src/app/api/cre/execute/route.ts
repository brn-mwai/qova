import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

// ─── Contract addresses (Base Sepolia) ────────────────────────
const REPUTATION_REGISTRY = "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as const;
const TRANSACTION_VALIDATOR = "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as const;
const BUDGET_ENFORCER = "0x271618781040dc358e4F6B66561b65A839b0C76E" as const;

// ─── ABIs (minimal read fragments) ────────────────────────────
const REGISTRY_ABI = [
	{ name: "getScore", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "uint16" }] },
	{ name: "isRegistered", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "bool" }] },
	{ name: "getAgentDetails", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "tuple", components: [{ name: "score", type: "uint16" }, { name: "lastUpdated", type: "uint48" }, { name: "updateCount", type: "uint32" }, { name: "registered", type: "bool" }] }] },
	{ name: "updateScore", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agent", type: "address" }, { name: "newScore", type: "uint16" }, { name: "reason", type: "bytes32" }], outputs: [] },
] as const;

const VALIDATOR_ABI = [
	{ name: "getTransactionStats", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "tuple", components: [{ name: "totalCount", type: "uint64" }, { name: "totalVolume", type: "uint128" }, { name: "successCount", type: "uint64" }, { name: "lastActivityTimestamp", type: "uint48" }] }] },
	{ name: "getSuccessRate", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const BUDGET_ABI = [
	{ name: "getBudgetStatus", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "status", type: "tuple", components: [{ name: "dailyRemaining", type: "uint128" }, { name: "monthlyRemaining", type: "uint128" }, { name: "perTxLimit", type: "uint128" }, { name: "dailySpent", type: "uint128" }, { name: "monthlySpent", type: "uint128" }] }] },
	{ name: "hasBudget", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

// ─── Scoring weights (mirrors cre/shared/constants.ts) ────────
const WEIGHTS = { transactionVolume: 0.25, transactionCount: 0.2, successRate: 0.3, budgetCompliance: 0.15, accountAge: 0.1 };
const MIN_SCORE_CHANGE = 10;

function computeScore(metrics: {
	totalVolume: bigint; transactionCount: number; successRate: number;
	dailySpent: bigint; dailyLimit: bigint; accountAgeSeconds: number;
}): number {
	const volumeScore = metrics.totalVolume <= BigInt(0) ? 0 : Math.min(1, Math.log10(Number(metrics.totalVolume) / 1e18 + 1) / 2);
	const countScore = Math.min(1, metrics.transactionCount / 1000);
	const successScore = metrics.successRate / 10000;
	const budgetRatio = metrics.dailyLimit === BigInt(0) ? 1 : Number(metrics.dailySpent) / Number(metrics.dailyLimit);
	const budgetScore = budgetRatio <= 0.8 ? 1 : budgetRatio <= 1 ? 0.7 : Math.max(0, 1 - (budgetRatio - 1));
	const ageScore = Math.min(1, (metrics.accountAgeSeconds / 86400) / 365);

	const weighted =
		volumeScore * WEIGHTS.transactionVolume +
		countScore * WEIGHTS.transactionCount +
		successScore * WEIGHTS.successRate +
		budgetScore * WEIGHTS.budgetCompliance +
		ageScore * WEIGHTS.accountAge;

	return Math.round(Math.max(0, Math.min(1000, weighted * 1000)));
}

/**
 * POST /api/cre/execute
 * Body: { agentAddress: string, workflowId: string }
 *
 * Reads live on-chain data from Base Sepolia contracts,
 * computes a reputation score, writes it on-chain if changed,
 * and logs the execution to Convex.
 */
export async function POST(request: Request): Promise<NextResponse> {
	const startedAt = Date.now();

	const body = (await request.json()) as {
		agentAddress?: string;
		workflowId?: string;
	};

	const agentAddress = body.agentAddress as `0x${string}`;
	const workflowId = body.workflowId ?? "payment-volume";

	if (!agentAddress) {
		return NextResponse.json({ error: "agentAddress required" }, { status: 400 });
	}

	const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
	if (!deployerKey) {
		return NextResponse.json({ error: "DEPLOYER_PRIVATE_KEY not configured" }, { status: 503 });
	}

	const publicClient = createPublicClient({
		chain: baseSepolia,
		transport: http("https://sepolia.base.org"),
	});

	try {
		// Step 1: Read on-chain -- is agent registered?
		const isRegistered = await publicClient.readContract({
			address: REPUTATION_REGISTRY,
			abi: REGISTRY_ABI,
			functionName: "isRegistered",
			args: [agentAddress],
		});

		if (!isRegistered) {
			return NextResponse.json({
				error: "Agent not registered on-chain",
				agentAddress,
				hint: "Register the agent first via ReputationRegistry.registerAgent()",
			}, { status: 404 });
		}

		// Step 2: Read current score
		const currentScore = await publicClient.readContract({
			address: REPUTATION_REGISTRY,
			abi: REGISTRY_ABI,
			functionName: "getScore",
			args: [agentAddress],
		});

		// Step 3: Read agent details (for account age)
		const details = await publicClient.readContract({
			address: REPUTATION_REGISTRY,
			abi: REGISTRY_ABI,
			functionName: "getAgentDetails",
			args: [agentAddress],
		});

		// Step 4: Read transaction stats
		let totalCount = BigInt(0);
		let totalVolume = BigInt(0);
		let lastActivityTimestamp = 0;
		let successRate = BigInt(0);
		try {
			const statsResult = await publicClient.readContract({
				address: TRANSACTION_VALIDATOR,
				abi: VALIDATOR_ABI,
				functionName: "getTransactionStats",
				args: [agentAddress],
			});
			totalCount = statsResult.totalCount;
			totalVolume = statsResult.totalVolume;
			lastActivityTimestamp = statsResult.lastActivityTimestamp;
			successRate = await publicClient.readContract({
				address: TRANSACTION_VALIDATOR,
				abi: VALIDATOR_ABI,
				functionName: "getSuccessRate",
				args: [agentAddress],
			});
		} catch {
			// Agent has no transactions yet -- use defaults
		}

		// Step 5: Read budget status
		let budgetStatus = { dailyRemaining: BigInt(0), monthlyRemaining: BigInt(0), perTxLimit: BigInt(0), dailySpent: BigInt(0), monthlySpent: BigInt(0) };
		try {
			const hasBudget = await publicClient.readContract({
				address: BUDGET_ENFORCER,
				abi: BUDGET_ABI,
				functionName: "hasBudget",
				args: [agentAddress],
			});
			if (hasBudget) {
				budgetStatus = await publicClient.readContract({
					address: BUDGET_ENFORCER,
					abi: BUDGET_ABI,
					functionName: "getBudgetStatus",
					args: [agentAddress],
				}) as typeof budgetStatus;
			}
		} catch {
			// No budget set -- use defaults
		}

		// Step 6: Compute new score
		const nowSeconds = Math.floor(Date.now() / 1000);
		const lastUpdated = Number(details.lastUpdated);
		const accountAgeSeconds = lastUpdated > 0 ? nowSeconds - lastUpdated : 0;
		const dailyLimit = budgetStatus.dailyRemaining + budgetStatus.dailySpent;

		const newScore = computeScore({
			totalVolume,
			transactionCount: Number(totalCount),
			successRate: Number(successRate),
			dailySpent: budgetStatus.dailySpent,
			dailyLimit,
			accountAgeSeconds,
		});

		const scoreDiff = Math.abs(newScore - Number(currentScore));
		let txHash: string | undefined;

		// Step 7: Write on-chain if score changed significantly
		if (scoreDiff >= MIN_SCORE_CHANGE) {
			const account = privateKeyToAccount(`0x${deployerKey.replace(/^0x/, "")}`);
			const walletClient = createWalletClient({
				account,
				chain: baseSepolia,
				transport: http("https://sepolia.base.org"),
			});

			const reason = keccak256(toHex(`cre-${workflowId}`));
			txHash = await walletClient.writeContract({
				address: REPUTATION_REGISTRY,
				abi: REGISTRY_ABI,
				functionName: "updateScore",
				args: [agentAddress, newScore, reason],
			});
		}

		const completedAt = Date.now();
		const durationMs = completedAt - startedAt;

		// Step 8: Sync score + stats to Convex and log execution
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (convexUrl) {
			const convex = new ConvexHttpClient(convexUrl);

			// Sync agent score and on-chain stats to dashboard
			const volumeEth = (Number(totalVolume) / 1e18).toFixed(4);
			const successPct = `${(Number(successRate) / 100).toFixed(1)}%`;
			const dailySpentEth = `${(Number(budgetStatus.dailySpent) / 1e18).toFixed(4)} ETH`;
			const monthlySpentEth = `${(Number(budgetStatus.monthlySpent) / 1e18).toFixed(4)} ETH`;
			try {
				await convex.mutation(api.mutations.agents.syncFromChain, {
					address: agentAddress,
					score: newScore,
					totalTxCount: Number(totalCount),
					totalVolume: `${volumeEth} ETH`,
					successRate: successPct,
					dailySpent: dailySpentEth,
					monthlySpent: monthlySpentEth,
				});
			} catch {
				// Non-fatal
			}

			// Log CRE execution
			try {
				await convex.mutation(api.mutations.cre.createServerExecution, {
					workflowId,
					agentAddress,
					status: "completed",
					inputScore: Number(currentScore),
					outputScore: newScore,
					durationMs,
					startedAt,
					completedAt,
				});
			} catch {
				// Non-fatal: Convex log failure shouldn't block the response
			}
		}

		return NextResponse.json({
			success: true,
			agentAddress,
			workflowId,
			currentScore: Number(currentScore),
			newScore,
			scoreDiff,
			scoreWritten: scoreDiff >= MIN_SCORE_CHANGE,
			txHash,
			durationMs,
			onChainData: {
				registered: details.registered,
				lastUpdated: Number(details.lastUpdated),
				updateCount: Number(details.updateCount),
				accountAgeSeconds,
				txCount: Number(totalCount),
				txVolume: totalVolume.toString(),
				successRate: Number(successRate),
				dailySpent: budgetStatus.dailySpent.toString(),
				dailyLimit: dailyLimit.toString(),
			},
			chain: "base-sepolia",
			contracts: {
				ReputationRegistry: REPUTATION_REGISTRY,
				TransactionValidator: TRANSACTION_VALIDATOR,
				BudgetEnforcer: BUDGET_ENFORCER,
			},
		});
	} catch (err) {
		const completedAt = Date.now();

		// Log failed execution to Convex
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (convexUrl) {
			const convex = new ConvexHttpClient(convexUrl);
			try {
				await convex.mutation(api.mutations.cre.createServerExecution, {
					workflowId,
					agentAddress,
					status: "failed",
					durationMs: completedAt - startedAt,
					error: err instanceof Error ? err.message : "Unknown error",
					startedAt,
				});
			} catch {
				// Non-fatal
			}
		}

		return NextResponse.json({
			error: err instanceof Error ? err.message : "CRE execution failed",
			agentAddress,
			workflowId,
		}, { status: 500 });
	}
}
