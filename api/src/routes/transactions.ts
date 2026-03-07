/**
 * Transaction endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { TransactionType } from "@brnmwai/qova-core";
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { getCached, setCache } from "../middleware/cache.js";
import { validateAddress, validateBody } from "../middleware/validate.js";
import { RecordTransactionRequest } from "../schemas/request.js";
import { getQovaClient } from "../services/chain.js";
import { enrichTransactionStats } from "../services/enrichment.js";
import type { AppEnv } from "../types/env.js";

export const transactionRoutes = new Hono<AppEnv>();

/** GET /api/transactions/:address/stats -- Transaction statistics */
transactionRoutes.get("/:address/stats", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const cacheKey = `txstats:${address}`;
	const cached = getCached<Record<string, unknown>>(cacheKey);
	if (cached) return c.json(cached);

	const client = getQovaClient();
	const stats = await client.getTransactionStats(address as Address);
	const enriched = enrichTransactionStats(address, stats);

	setCache(cacheKey, enriched, 30);
	return c.json(enriched);
});

/** POST /api/transactions/record -- Record a new transaction (write) */
transactionRoutes.post("/record", validateBody(RecordTransactionRequest), async (c) => {
	const { agent, txHash, amount, txType } = c.get("body") as {
		agent: string;
		txHash: string;
		amount: string;
		txType: number;
	};
	const client = getQovaClient();
	const hash = await client.recordTransaction(
		agent as Address,
		txHash as Hex,
		BigInt(amount),
		txType as TransactionType,
	);
	return c.json({ txHash: hash, agent }, 201);
});
