/**
 * Zod request validation middleware.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import type { z } from "zod";
import { problemResponse } from "./problem.js";

/**
 * Validate request body against a Zod schema.
 * Stores parsed data as `c.get("body")` on success.
 * Returns RFC 7807 400 with field errors on failure.
 */
export function validateBody<T extends z.ZodSchema>(
	schema: T,
): (c: Context, next: Next) => Promise<Response | undefined> {
	return async (c: Context, next: Next) => {
		let raw: unknown;
		try {
			raw = await c.req.json();
		} catch {
			return problemResponse(c, 400, "INVALID_JSON", "Invalid JSON Body",
				"The request body could not be parsed as valid JSON");
		}
		const result = schema.safeParse(raw);
		if (!result.success) {
			return problemResponse(c, 400, "VALIDATION_ERROR", "Validation Failed",
				"Request body failed schema validation", {
					errors: result.error.issues.map((issue) => ({
						field: issue.path.join("."),
						message: issue.message,
					})),
				});
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
			return problemResponse(c, 400, "INVALID_ADDRESS", "Invalid Ethereum Address",
				`Parameter "${paramName}" must be a valid 0x-prefixed 40-character hex address`);
		}
		await next();
	};
}
