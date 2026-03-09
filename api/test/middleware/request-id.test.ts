/**
 * Request ID middleware tests.
 * Covers Fix 3.2: Request ID correlation.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

describe("request ID middleware (Fix 3.2)", () => {
	it("generates a request ID when none is provided", async () => {
		const res = await app.request("/");
		const requestId = res.headers.get("X-Request-ID");
		expect(requestId).toBeDefined();
		expect(requestId).not.toBeNull();
		// UUID v4 format
		expect(requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("echoes back a provided X-Request-ID", async () => {
		const customId = "my-custom-request-123";
		const res = await app.request("/", {
			headers: { "X-Request-ID": customId },
		});
		expect(res.headers.get("X-Request-ID")).toBe(customId);
	});

	it("request ID is present on error responses too", async () => {
		const res = await app.request("/nonexistent-route");
		expect(res.status).toBe(404);
		expect(res.headers.get("X-Request-ID")).toBeDefined();
	});
});
