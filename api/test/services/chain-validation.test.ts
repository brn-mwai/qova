/**
 * Chain service validation tests.
 * Covers Fix 1.4: Private key format validation.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, vi } from "vitest";
import { validatePrivateKey } from "../../src/services/chain.js";

describe("validatePrivateKey (Fix 1.4)", () => {
	it("returns null when no key is provided", () => {
		expect(validatePrivateKey(undefined)).toBeNull();
	});

	it("returns null and logs error for key without 0x prefix", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = validatePrivateKey(
			"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
		);
		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("returns null and logs error for key that is too short", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = validatePrivateKey("0xabcd");
		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("returns null and logs error for key with invalid hex characters", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = validatePrivateKey(
			"0xgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
		);
		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid DEPLOYER_PRIVATE_KEY"));
		spy.mockRestore();
	});

	it("accepts a valid 0x-prefixed 64-char hex key", () => {
		const validKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
		const result = validatePrivateKey(validKey);
		expect(result).toBe(validKey);
	});
});
