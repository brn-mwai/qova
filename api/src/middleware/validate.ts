/**
 * Zod request validation middleware.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import type { z } from "zod";

/**
 * Validate request body against a Zod schema.
 * Stores parsed data as `c.get("body")` on success.
 * Returns 400 with Zod issues on failure.
 */
export function validateBody<T extends z.ZodSchema>(
	schema: T,
): (c: Context, next: Next) => Promise<Response | undefined> {
	return async (c: Context, next: Next) => {
		let raw: unknown;
		try {
			raw = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON body" }, 400);
		}
		const result = schema.safeParse(raw);
		if (!result.success) {
			// In production, redact schema structure details
			const details = process.env.NODE_ENV === "production"
				? result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
				: result.error.issues;
			return c.json({ error: "Validation failed", details }, 400);
		}
		c.set("body", result.data);
		await next();
	};
}

/**
 * Validate that a route param is a valid Ethereum address.
 */
export function validateAddress(
	paramName = "address",
): (c: Context, next: Next) => Promise<Response | undefined> {
	return async (c: Context, next: Next) => {
		const address = c.req.param(paramName);
		if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
			return c.json({ error: `Invalid Ethereum address: ${paramName}` }, 400);
		}
		await next();
	};
}
