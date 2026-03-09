/**
 * Agent reputation endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import { formatScore, getGrade, getScoreColor, scoreToPercentage } from "@brnmwai/qova-core";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { getCached, setCache, deleteCache, deleteCacheByPrefix } from "../middleware/cache.js";
import { validateAddress, validateBody } from "../middleware/validate.js";
import {
	BatchUpdateScoresRequest,
	RegisterAgentRequest,
	UpdateScoreRequest,
} from "../schemas/request.js";
import { getQovaClient } from "../services/chain.js";
import { enrichAgentDetails } from "../services/enrichment.js";
import type { AppEnv } from "../types/env.js";
import { MOCK_AGENTS } from "../constants.js";

export const agentRoutes = new Hono<AppEnv>();

/** GET /api/agents -- List agents (mock data for hackathon) */
agentRoutes.get("/", (c) => {
	return c.json({
		agents: MOCK_AGENTS,
		total: MOCK_AGENTS.length,
	});
});

/** GET /api/agents/:address -- Agent details + enriched score */
agentRoutes.get("/:address", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const cacheKey = `agent:${address}`;
	const cached = getCached<Record<string, unknown>>(cacheKey);
	if (cached) return c.json(cached);

	const client = getQovaClient();
	const details = await client.getAgentDetails(address as Address);
	const enriched = enrichAgentDetails(address, details);

	setCache(cacheKey, enriched, 30);
	return c.json(enriched);
});

/** GET /api/agents/:address/score -- Current score + grade + color */
agentRoutes.get("/:address/score", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const cacheKey = `score:${address}`;
	const cached = getCached<Record<string, unknown>>(cacheKey);
	if (cached) return c.json(cached);

	const client = getQovaClient();
	const score = await client.getScore(address as Address);

	const result = {
		agent: address,
		score,
		grade: getGrade(score),
		gradeColor: getScoreColor(score),
		scoreFormatted: formatScore(score),
		scorePercentage: scoreToPercentage(score),
	};

	setCache(cacheKey, result, 30);
	return c.json(result);
});

/** GET /api/agents/:address/registered -- Is agent registered? */
agentRoutes.get("/:address/registered", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const client = getQovaClient();
	const isRegistered = await client.isAgentRegistered(address as Address);
	return c.json({ agent: address, isRegistered });
});

/** POST /api/agents/register -- Register a new agent (write) */
agentRoutes.post("/register", validateBody(RegisterAgentRequest), async (c) => {
	const { agent } = c.get("body") as { agent: string };
	const client = getQovaClient();
	const txHash = await client.registerAgent(agent as Address);

	// Invalidate cached data for this agent
	deleteCache(`agent:${agent}`);
	deleteCacheByPrefix("agents:");

	return c.json({ txHash, agent }, 201);
});

/** POST /api/agents/:address/score -- Update agent score (write) */
agentRoutes.post(
	"/:address/score",
	validateAddress(),
	validateBody(UpdateScoreRequest),
	async (c) => {
		const address = c.req.param("address");
		const { score, reason } = c.get("body") as {
			score: number;
			reason: string;
		};
		const client = getQovaClient();
		const txHash = await client.updateScore(address as Address, score, reason as Hex);

		// Invalidate cached score and agent data
		deleteCache(`score:${address}`);
		deleteCache(`agent:${address}`);
		deleteCache(`scoreBreakdown:${address}`);

		return c.json({ txHash, agent: address, newScore: score });
	},
);

/** POST /api/agents/batch-scores -- Batch update scores (write) */
agentRoutes.post("/batch-scores", validateBody(BatchUpdateScoresRequest), async (c) => {
	const { agents, scores, reasons } = c.get("body") as {
		agents: string[];
		scores: number[];
		reasons: string[];
	};
	const client = getQovaClient();
	const txHash = await client.batchUpdateScores(agents as Address[], scores, reasons as Hex[]);

	// Invalidate cached data for all affected agents
	for (const agent of agents) {
		deleteCache(`score:${agent}`);
		deleteCache(`agent:${agent}`);
		deleteCache(`scoreBreakdown:${agent}`);
	}

	return c.json({ txHash, count: agents.length });
});
