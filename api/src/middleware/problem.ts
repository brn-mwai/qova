/**
 * RFC 7807 Problem Details error responses.
 *
 * All API errors use this format for consistency:
 * {
 *   type: "https://api.qova.cc/errors/AGENT_NOT_REGISTERED",
 *   title: "Agent Not Registered",
 *   status: 404,
 *   detail: "Agent 0x... is not registered in the Qova protocol",
 *   instance: "/api/agents/0x.../score",
 *   code: "AGENT_NOT_REGISTERED",   // machine-readable (backwards compat)
 *   requestId: "uuid"               // trace ID
 * }
 *
 * @see https://www.rfc-editor.org/rfc/rfc7807
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context } from "hono";

const ERROR_BASE_URL = "https://api.qova.cc/errors";

export interface ProblemDetail {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance?: string;
	code: string;
	requestId?: string;
	/** Validation field errors (for 400s). */
	errors?: Array<{ field: string; message: string }>;
	/** Rate limit info (for 429s). */
	retryAfter?: number;
}

/**
 * Build and send an RFC 7807 Problem Details response.
 */
export function problemResponse(
	c: Context,
	status: number,
	code: string,
	title: string,
	detail: string,
	extra?: Partial<ProblemDetail>,
): Response {
	const body: ProblemDetail = {
		type: `${ERROR_BASE_URL}/${code}`,
		title,
		status,
		detail,
		instance: c.req.path,
		code,
		requestId: c.res.headers.get("X-Request-Id") ?? undefined,
		...extra,
	};

	return c.json(body, status as 400, {
		"Content-Type": "application/problem+json",
	});
}
