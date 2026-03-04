/**
 * Request logging middleware.
 *
 * Logs method, path, status, duration, and API key prefix on every request.
 * Output is structured JSON for easy parsing by log aggregators.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { randomUUID } from "node:crypto";

/**
 * Request logging middleware for Hono.
 *
 * Attaches X-Request-Id header and logs request/response details.
 *
 * @example
 * app.use("/*", requestLogger());
 */
export function requestLogger(): (c: Context, next: Next) => Promise<void> {
	return async (c: Context, next: Next) => {
		const requestId = c.req.header("x-request-id") || randomUUID();
		const start = Date.now();

		// Set request ID on response
		c.header("X-Request-Id", requestId);

		try {
			await next();
		} finally {
			const duration = Date.now() - start;
			const status = c.res.status;
			const method = c.req.method;
			const path = c.req.path;

			// Extract API key prefix if authenticated
			const apiKey = c.get("apiKey") as { keyPrefix: string } | undefined;
			const keyPrefix = apiKey?.keyPrefix ?? "-";

			const log = {
				level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
				requestId,
				method,
				path,
				status,
				duration,
				keyPrefix,
				timestamp: new Date().toISOString(),
			};

			// Use structured JSON logging
			if (status >= 500) {
				console.error(JSON.stringify(log));
			} else if (status >= 400) {
				console.warn(JSON.stringify(log));
			} else {
				console.log(JSON.stringify(log));
			}
		}
	};
}
