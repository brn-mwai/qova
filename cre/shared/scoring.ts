/**
 * @file shared/scoring.ts
 * Reputation scoring algorithm -- ALL BIGINT, NO FLOATS.
 * BFT-safe: deterministic across all DON nodes.
 */

/** Scoring weights in basis points (must sum to 10000) */
export const SCORE_WEIGHTS = {
	SUCCESS_RATE: 3000n, // 30%
	TX_VOLUME: 2500n, // 25%
	TX_COUNT: 2000n, // 20%
	BUDGET_COMPLIANCE: 1500n, // 15%
	ACCOUNT_AGE: 1000n, // 10%
} as const;

export const MAX_SCORE = 1000n;
export const MIN_SCORE_CHANGE = 10;

/** Agent metrics used for reputation scoring. */
export interface AgentMetrics {
	totalVolume: bigint;
	transactionCount: number;
	/** Success rate in basis points (0-10000). */
	successRate: number;
	dailySpent: bigint;
	dailyLimit: bigint;
	/** Account age in seconds. */
	accountAgeSeconds: number;
	sanctionsClean: boolean;
	/** Optional off-chain API reputation score (0-100). */
	apiReputationScore?: number;
}

/**
 * Compute a reputation score from agent metrics.
 * ALL internal computation is BigInt -- no floats anywhere.
 * @returns Score in range [0, 1000] as number.
 */
export function computeReputationScore(metrics: AgentMetrics): number {
	if (!metrics.sanctionsClean) return 0;

	const txCount = BigInt(metrics.transactionCount);
	const successRateBps = BigInt(metrics.successRate);
	const accountAgeSec = BigInt(metrics.accountAgeSeconds);

	// Factor 1: Success Rate (0-1000) from basis points
	const successScore =
		successRateBps > 0n ? (successRateBps * MAX_SCORE) / 10000n : 0n;

	// Factor 2: Transaction Volume (step function approximating log scale)
	const volumeScore = volumeToScore(metrics.totalVolume);

	// Factor 3: Transaction Count (cap at 1000 txs for max score)
	const countCap = 1000n;
	const countScore =
		txCount >= countCap ? MAX_SCORE : (txCount * MAX_SCORE) / countCap;

	// Factor 4: Budget Compliance (0-1000)
	const budgetScore = computeBudgetCompliance(
		metrics.dailySpent,
		metrics.dailyLimit,
	);

	// Factor 5: Account Age (caps at 365 days)
	const ageCap = 365n * 24n * 60n * 60n; // 365 days in seconds
	const ageScore =
		accountAgeSec >= ageCap
			? MAX_SCORE
			: (accountAgeSec * MAX_SCORE) / ageCap;

	// Weighted sum (basis points -> final 0-1000)
	const weightedSum =
		(successScore * SCORE_WEIGHTS.SUCCESS_RATE +
			volumeScore * SCORE_WEIGHTS.TX_VOLUME +
			countScore * SCORE_WEIGHTS.TX_COUNT +
			budgetScore * SCORE_WEIGHTS.BUDGET_COMPLIANCE +
			ageScore * SCORE_WEIGHTS.ACCOUNT_AGE) /
		10000n;

	const finalScore = weightedSum > MAX_SCORE ? MAX_SCORE : weightedSum;
	return Number(finalScore);
}

/** Step function for volume scoring (all BigInt, no Math.log) */
function volumeToScore(volume: bigint): bigint {
	const eth1 = 1000000000000000000n; // 1 ETH in wei
	if (volume >= eth1 * 1000n) return 1000n;
	if (volume >= eth1 * 100n) return 900n;
	if (volume >= eth1 * 10n) return 750n;
	if (volume >= eth1) return 600n;
	if (volume >= eth1 / 10n) return 400n;
	if (volume >= eth1 / 100n) return 200n;
	if (volume > 0n) return 100n;
	return 0n;
}

/** Budget compliance scoring (all BigInt) */
function computeBudgetCompliance(
	dailySpent: bigint,
	dailyLimit: bigint,
): bigint {
	if (dailyLimit === 0n) return MAX_SCORE;

	const dailyUtilBps = (dailySpent * 10000n) / dailyLimit;
	if (dailyUtilBps <= 8000n) return MAX_SCORE;
	if (dailyUtilBps <= 10000n)
		return ((10000n - dailyUtilBps) * MAX_SCORE) / 2000n;
	return 0n;
}
