/**
 * Global error handler — maps SDK errors to RFC 7807 Problem Details.
 * @author Qova Engineering <eng@qova.cc>
 */

import {
	AgentAlreadyRegisteredError,
	AgentNotRegisteredError,
	BudgetExceededError,
	InvalidScoreError,
	QovaError,
	UnauthorizedError,
} from "@qova/core";
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { problemResponse } from "./problem.js";

export const errorHandler: ErrorHandler = (err, c) => {
	if (err instanceof AgentNotRegisteredError) {
		return problemResponse(c, 404, "AGENT_NOT_REGISTERED", "Agent Not Registered", err.message);
	}
	if (err instanceof AgentAlreadyRegisteredError) {
		return problemResponse(c, 409, "AGENT_ALREADY_REGISTERED", "Agent Already Registered", err.message);
	}
	if (err instanceof BudgetExceededError) {
		return problemResponse(c, 422, "BUDGET_EXCEEDED", "Budget Exceeded", err.message);
	}
	if (err instanceof UnauthorizedError) {
		return problemResponse(c, 403, "UNAUTHORIZED", "Unauthorized", err.message);
	}
	if (err instanceof InvalidScoreError) {
		return problemResponse(c, 400, "INVALID_SCORE", "Invalid Score", err.message);
	}
	if (err instanceof QovaError) {
		return problemResponse(c, 500, err.code ?? "INTERNAL_ERROR", "Internal Error", err.message);
	}
	if (err instanceof ZodError) {
		return problemResponse(c, 400, "VALIDATION_ERROR", "Validation Failed", "Request body failed schema validation", {
			errors: err.issues.map((issue) => ({
				field: issue.path.join("."),
				message: issue.message,
			})),
		});
	}

	console.error("Unhandled error:", err);
	return problemResponse(c, 500, "INTERNAL_ERROR", "Internal Server Error", "An unexpected error occurred");
};
