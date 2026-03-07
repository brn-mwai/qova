/**
 * Global error handler -- maps SDK errors to HTTP status codes.
 * @author Qova Engineering <eng@qova.cc>
 */

import {
	AgentAlreadyRegisteredError,
	AgentNotRegisteredError,
	BudgetExceededError,
	InvalidScoreError,
	QovaError,
	UnauthorizedError,
} from "@brnmwai/qova-core";
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

export const errorHandler: ErrorHandler = (err, c) => {
	if (err instanceof AgentNotRegisteredError) {
		return c.json({ error: err.message, code: "AGENT_NOT_REGISTERED" }, 404);
	}
	if (err instanceof AgentAlreadyRegisteredError) {
		return c.json({ error: err.message, code: "AGENT_ALREADY_REGISTERED" }, 409);
	}
	if (err instanceof BudgetExceededError) {
		return c.json({ error: err.message, code: "BUDGET_EXCEEDED" }, 422);
	}
	if (err instanceof UnauthorizedError) {
		return c.json({ error: err.message, code: "UNAUTHORIZED" }, 403);
	}
	if (err instanceof InvalidScoreError) {
		return c.json({ error: err.message, code: "INVALID_SCORE" }, 400);
	}
	if (err instanceof QovaError) {
		return c.json({ error: err.message, code: err.code }, 500);
	}
	if (err instanceof ZodError) {
		return c.json({ error: "Validation failed", details: err.issues }, 400);
	}
	console.error("Unhandled error:", err);
	return c.json({ error: "Internal server error" }, 500);
};
