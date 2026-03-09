/**
 * Environment variable handling tests.
 * Verifies graceful handling of missing env vars.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("environment variable handling", () => {
	it("middleware checks for Clerk keys before using them", () => {
		const content = readFileSync(
			join(__dirname, "../../src/middleware.ts"),
			"utf-8",
		);

		// Must check for both keys
		expect(content).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
		expect(content).toContain("CLERK_SECRET_KEY");

		// Must return 503, not NextResponse.next()
		expect(content).toContain("status: 503");
	});

	it("middleware does NOT silently pass when auth is unconfigured", () => {
		const content = readFileSync(
			join(__dirname, "../../src/middleware.ts"),
			"utf-8",
		);

		// Extract the early return block for missing keys
		const missingKeysBlock = content.match(
			/if\s*\(\s*!process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY[\s\S]*?\n\t\}/,
		);
		expect(missingKeysBlock).toBeTruthy();

		const block = missingKeysBlock![0];
		// The block should NOT just return NextResponse.next() for all routes
		// It should have a 503 response
		expect(block).toContain("503");
	});

	it("webhook route checks for CLERK_WEBHOOK_SECRET", () => {
		const content = readFileSync(
			join(__dirname, "../../src/app/api/webhooks/clerk/route.ts"),
			"utf-8",
		);

		expect(content).toContain("CLERK_WEBHOOK_SECRET");
		// Should return error status when missing
		expect(content).toContain("status: 500");
	});

	it("CRE execute route checks for DEPLOYER_PRIVATE_KEY", () => {
		const content = readFileSync(
			join(__dirname, "../../src/app/api/cre/execute/route.ts"),
			"utf-8",
		);

		expect(content).toContain("DEPLOYER_PRIVATE_KEY");
		expect(content).toContain("status: 503");
	});

	it("middleware allows /api/health when auth is unconfigured", () => {
		const content = readFileSync(
			join(__dirname, "../../src/middleware.ts"),
			"utf-8",
		);

		expect(content).toContain("/api/health");
	});
});
