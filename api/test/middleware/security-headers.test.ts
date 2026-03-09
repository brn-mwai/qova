/**
 * Security headers tests.
 * Covers Fix 1.3: All responses include security headers.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

describe("security headers (Fix 1.3)", () => {
	it("X-Frame-Options: DENY is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
	});

	it("X-Content-Type-Options: nosniff is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("Strict-Transport-Security is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
	});

	it("X-XSS-Protection is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
	});

	it("Referrer-Policy is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
	});

	it("Permissions-Policy is present", async () => {
		const res = await app.request("/");
		expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
	});

	it("headers present on 404 responses too", async () => {
		const res = await app.request("/nonexistent-route");
		expect(res.status).toBe(404);
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});
});
