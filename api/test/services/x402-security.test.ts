/**
 * x402 security tests -- replay prevention + oversized header rejection.
 * Covers Fix 1.2 (replay) and Fix 2.1 (base64 length limit).
 * @author Qova Engineering <eng@qova.cc>
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	clearUsedNonces,
	decodePaymentHeader,
	verifyPayment,
} from "../../src/services/x402.js";

const PAY_TO = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";
const FAKE_PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const PRICE = "1000";

function makePaymentHeader(nonceOverride?: string): string {
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		x402Version: 1,
		scheme: "exact",
		network: "base-sepolia",
		payload: {
			signature:
				"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
			authorization: {
				from: FAKE_PAYER,
				to: PAY_TO,
				value: PRICE,
				validAfter: now - 60,
				validBefore: now + 300,
				nonce: nonceOverride ?? "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
	};
	return btoa(JSON.stringify(payload));
}

describe("x402 replay prevention (Fix 1.2)", () => {
	beforeEach(() => {
		clearUsedNonces();
	});

	it("rejects same nonce on second use", async () => {
		const nonce = "0x0000000000000000000000000000000000000000000000000000000000aaaaaa";
		const header = makePaymentHeader(nonce);

		// First use -- should pass nonce check (will fail on signature, but not on replay)
		const result1 = await verifyPayment(header, 1000n);
		// The fake signature will cause it to fail, but NOT for replay reasons
		expect(result1.error).not.toContain("Replay");

		// Second use -- should be rejected as replay
		const result2 = await verifyPayment(header, 1000n);
		expect(result2.valid).toBe(false);
		expect(result2.error).toContain("Replay detected");
	});

	it("accepts different nonces", async () => {
		const header1 = makePaymentHeader("0x0000000000000000000000000000000000000000000000000000000000bbbbbb");
		const header2 = makePaymentHeader("0x0000000000000000000000000000000000000000000000000000000000cccccc");

		const result1 = await verifyPayment(header1, 1000n);
		// Should not be a replay error
		expect(result1.error).not.toContain("Replay");

		const result2 = await verifyPayment(header2, 1000n);
		// Should also not be a replay error (different nonce)
		expect(result2.error).not.toContain("Replay");
	});

	it("clearUsedNonces allows nonce reuse after clearing", async () => {
		const nonce = "0x0000000000000000000000000000000000000000000000000000000000dddddd";
		const header = makePaymentHeader(nonce);

		await verifyPayment(header, 1000n);

		// Clear nonces
		clearUsedNonces();

		// Same nonce should work again
		const result = await verifyPayment(header, 1000n);
		expect(result.error).not.toContain("Replay");
	});
});

describe("x402 oversized header rejection (Fix 2.1)", () => {
	it("rejects oversized base64 payment header", () => {
		const oversized = "A".repeat(11_000); // > 10,000 chars
		const result = decodePaymentHeader(oversized);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("too large");
		}
	});

	it("accepts normal-sized payment header", () => {
		const header = makePaymentHeader();
		const result = decodePaymentHeader(header);

		expect("data" in result).toBe(true);
	});
});
