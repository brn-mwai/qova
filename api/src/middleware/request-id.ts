/**
 * Request ID middleware -- assigns a unique ID to each request for correlation.
 * @author Qova Engineering <eng@qova.cc>
 */

import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";

export const requestId = createMiddleware(async (c, next) => {
	const id = c.req.header("x-request-id") ?? randomUUID();
	c.set("requestId", id);
	await next();
	c.header("X-Request-ID", id);
});
