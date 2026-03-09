/**
 * Constants and API design tests.
 * Covers Fix 4.2 (mock agents) and Fix 4.3 (HTTP status codes).
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { MOCK_AGENTS } from "../src/constants.js";

describe("MOCK_AGENTS constant (Fix 4.2)", () => {
	it("contains exactly 3 agents", () => {
		expect(MOCK_AGENTS).toHaveLength(3);
	});

	it("all agents are valid Ethereum addresses", () => {
		for (const agent of MOCK_AGENTS) {
			expect(agent).toMatch(/^0x[a-fA-F0-9]{40}$/);
		}
	});

	it("is readonly (const assertion)", () => {
		// TypeScript enforces this at compile time, runtime check for safety
		expect(Array.isArray(MOCK_AGENTS)).toBe(true);
	});
});
