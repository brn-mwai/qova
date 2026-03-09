/**
 * Budget management endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Address } from "viem";
import { getCached, setCache } from "../middleware/cache.js";
import { validateAddress, validateBody } from "../middleware/validate.js";
import { CheckBudgetRequest, RecordSpendRequest, SetBudgetRequest } from "../schemas/request.js";
import { getQovaClient } from "../services/chain.js";
import { enrichBudgetStatus } from "../services/enrichment.js";
import type { AppEnv } from "../types/env.js";

/** uint128 max value for budget limits. */
const MAX_BUDGET = 2n ** 128n - 1n;

/**
 * Safely parse a string to BigInt with bounds checking.
 * @throws HTTPException with 400 status on invalid input.
 */
function safeBigInt(value: string, fieldName: string, max: bigint = MAX_BUDGET): bigint {
	try {
		const n = BigInt(value);
		if (n < 0n) throw new Error("negative");
		if (n > max) throw new Error("exceeds max");
		return n;
	} catch {
		throw new HTTPException(400, { message: `Invalid ${fieldName}: must be positive integer <= ${max}` });
	}
}

export const budgetRoutes = new Hono<AppEnv>();

/** GET /api/budgets/:address -- Budget status */
budgetRoutes.get("/:address", validateAddress(), async (c) => {
	const address = c.req.param("address");
	const cacheKey = `budget:${address}`;
	const cached = getCached<Record<string, unknown>>(cacheKey);
	if (cached) return c.json(cached);

	const client = getQovaClient();
	const status = await client.getBudgetStatus(address as Address);
	const enriched = enrichBudgetStatus(address, status);

	setCache(cacheKey, enriched, 30);
	return c.json(enriched);
});

/** POST /api/budgets/:address/set -- Set budget limits (write) */
budgetRoutes.post("/:address/set", validateAddress(), validateBody(SetBudgetRequest), async (c) => {
	const address = c.req.param("address");
	const { dailyLimit, monthlyLimit, perTxLimit } = c.get("body") as {
		dailyLimit: string;
		monthlyLimit: string;
		perTxLimit: string;
	};
	const client = getQovaClient();
	const txHash = await client.setBudget(
		address as Address,
		safeBigInt(dailyLimit, "dailyLimit"),
		safeBigInt(monthlyLimit, "monthlyLimit"),
		safeBigInt(perTxLimit, "perTxLimit"),
	);
	return c.json({ txHash, agent: address }, 201);
});

/** POST /api/budgets/:address/check -- Check if amount is within budget */
budgetRoutes.post(
	"/:address/check",
	validateAddress(),
	validateBody(CheckBudgetRequest),
	async (c) => {
		const address = c.req.param("address");
		const { amount } = c.get("body") as { amount: string };
		const client = getQovaClient();
		const withinBudget = await client.checkBudget(address as Address, safeBigInt(amount, "amount"));
		return c.json({ agent: address, withinBudget, amount });
	},
);

/** POST /api/budgets/:address/spend -- Record a spend (write) */
budgetRoutes.post(
	"/:address/spend",
	validateAddress(),
	validateBody(RecordSpendRequest),
	async (c) => {
		const address = c.req.param("address");
		const { amount } = c.get("body") as { amount: string };
		const client = getQovaClient();
		const txHash = await client.recordSpend(address as Address, safeBigInt(amount, "amount"));
		return c.json({ txHash, agent: address });
	},
);
