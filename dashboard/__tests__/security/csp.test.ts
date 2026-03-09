/**
 * Content Security Policy tests.
 * Verifies security headers are configured in next.config.ts.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Content Security Policy", () => {
	const configPath = join(__dirname, "../../next.config.ts");
	const configContent = readFileSync(configPath, "utf-8");

	it("has security headers configuration", () => {
		expect(configContent).toContain("securityHeaders");
		expect(configContent).toContain("async headers()");
	});

	it("includes X-Frame-Options DENY", () => {
		expect(configContent).toContain("X-Frame-Options");
		expect(configContent).toContain("DENY");
	});

	it("includes X-Content-Type-Options nosniff", () => {
		expect(configContent).toContain("X-Content-Type-Options");
		expect(configContent).toContain("nosniff");
	});

	it("includes Referrer-Policy", () => {
		expect(configContent).toContain("Referrer-Policy");
		expect(configContent).toContain("strict-origin-when-cross-origin");
	});

	it("includes Permissions-Policy", () => {
		expect(configContent).toContain("Permissions-Policy");
		expect(configContent).toContain("camera=()");
		expect(configContent).toContain("microphone=()");
	});

	it("includes Content-Security-Policy", () => {
		expect(configContent).toContain("Content-Security-Policy");
		expect(configContent).toContain("default-src 'self'");
		expect(configContent).toContain("script-src");
		expect(configContent).toContain("connect-src");
	});

	it("CSP allows Convex and Clerk connections", () => {
		expect(configContent).toContain("*.convex.cloud");
		expect(configContent).toContain("*.clerk.dev");
		expect(configContent).toContain("wss://*.convex.cloud");
	});

	it("CSP allows Cloudflare challenges for World ID", () => {
		expect(configContent).toContain("challenges.cloudflare.com");
	});

	it("applies headers to all routes", () => {
		expect(configContent).toContain("/:path*");
	});
});
