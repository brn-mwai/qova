/**
 * Agent verification endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import { getGrade } from "@brnmwai/qova-core";
import { Hono } from "hono";
import type { Address } from "viem";
import { validateBody } from "../middleware/validate.js";
import { SanctionsCheckRequest, VerifyAgentRequest } from "../schemas/request.js";
import { getQovaClient } from "../services/chain.js";
import type { AppEnv } from "../types/env.js";

export const verifyRoutes = new Hono<AppEnv>();

/** POST /api/verify -- Verify an agent */
verifyRoutes.post("/", validateBody(VerifyAgentRequest), async (c) => {
	const { agent } = c.get("body") as { agent: string };
	const client = getQovaClient();

	const isRegistered = await client.isAgentRegistered(agent as Address);
	if (!isRegistered) {
		return c.json({
			agent,
			verified: false,
			score: 0,
			grade: "D",
			sanctionsClean: true,
			isRegistered: false,
			timestamp: new Date().toISOString(),
		});
	}

	const score = await client.getScore(agent as Address);

	return c.json({
		agent,
		verified: score > 0,
		score,
		grade: getGrade(score),
		sanctionsClean: true,
		isRegistered: true,
		timestamp: new Date().toISOString(),
	});
});

/** POST /api/verify/sanctions -- Sanctions screening (CRE-compatible) */
verifyRoutes.post("/sanctions", validateBody(SanctionsCheckRequest), async (c) => {
	return c.json({
		clean: true,
		checked: true,
		source: "mock-ofac-sdn",
		timestamp: Date.now(),
	});
});
