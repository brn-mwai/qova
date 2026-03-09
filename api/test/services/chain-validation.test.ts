/**
 * Chain service validation tests.
 * Covers Fix 1.4: Private key format validation.
 * @author Qova Engineering <eng@qova.cc>
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQovaClient, resetClient } from "../../src/services/chain.js";

describe("private key validation (Fix 1.4)", () => {
	let originalKey: string | undefined;

	beforeEach(() => {
		originalKey = process.env.DEPLOYER_PRIVATE_KEY;
		resetClient();
	});

	afterEach(() => {
		if (originalKey === undefined) {
			delete process.env.DEPLOYER_PRIVATE_KEY;
		} else {
			process.env.DEPLOYER_PRIVATE_KEY = originalKey;
		}
		resetClient();
	});

	it("creates client without wallet when no private key is set", () => {
		delete process.env.DEPLOYER_PRIVATE_KEY;
		const client = getQovaClient("base-sepolia");
		expect(client).toBeDefined();
	});

	it("rejects invalid private key format (no 0x prefix)", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		process.env.DEPLOYER_PRIVATE_KEY = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab";

		// Should create client without wallet (invalid key is treated as null)
		const client = getQovaClient("base-sepolia");
		expect(client).toBeDefined();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("rejects private key that is too short", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		process.env.DEPLOYER_PRIVATE_KEY = "0xabcd";

		const client = getQovaClient("base-sepolia");
		expect(client).toBeDefined();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("rejects private key with invalid hex characters", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		process.env.DEPLOYER_PRIVATE_KEY = "0xgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg";

		const client = getQovaClient("base-sepolia");
		expect(client).toBeDefined();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("throws for unsupported chain", () => {
		expect(() => getQovaClient("invalid-chain")).toThrow("Unsupported chain");
	});
});
