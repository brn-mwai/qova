/**
 * x402 micropayment middleware + service tests.
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { x402Payment } from "../middleware/x402.js";
import {
	createPaymentRequired,
	decodePaymentHeader,
	type PaymentRequiredResponse,
	verifyPayment,
} from "../services/x402.js";

// ─── Constants ───────────────────────────────────────────────────

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";
const PRICE = "1000"; // $0.001 USDC (6 decimals)
const FAKE_PAYER = "0x1234567890abcdef1234567890abcdef12345678";

// ─── Helpers ─────────────────────────────────────────────────────

function makePaymentHeader(overrides: Record<string, unknown> = {}): string {
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
				nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
		...overrides,
	};
	return btoa(JSON.stringify(payload));
}

function makeExpiredPaymentHeader(): string {
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
				validAfter: now - 600,
				validBefore: now - 60, // expired
				nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
	};
	return btoa(JSON.stringify(payload));
}

function makeWrongAmountPaymentHeader(): string {
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
				value: "500", // too low, need 1000
				validAfter: now - 60,
				validBefore: now + 300,
				nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
	};
	return btoa(JSON.stringify(payload));
}

function createTestApp(): Hono {
	const app = new Hono();
	app.get("/paid", x402Payment({ price: PRICE, description: "Test paid endpoint" }), (c) =>
		c.json({ data: "premium content" }),
	);
	app.get("/free", (c) => c.json({ data: "free content" }));
	return app;
}

// ─── Service Tests ───────────────────────────────────────────────

describe("x402 service", () => {
	describe("createPaymentRequired", () => {
		it("returns correct 402 response structure", () => {
			const result = createPaymentRequired("/api/scores/0x123", 1000n);

			expect(result.x402Version).toBe(1);
			expect(result.error).toBe("Payment Required");
			expect(result.accepts).toHaveLength(1);

			const accept = result.accepts[0];
			expect(accept.scheme).toBe("exact");
			expect(accept.network).toBe("base-sepolia");
			expect(accept.maxAmountRequired).toBe("1000");
			expect(accept.resource).toBe("/api/scores/0x123");
			expect(accept.mimeType).toBe("application/json");
			expect(accept.payTo).toBe(PAY_TO);
			expect(accept.maxTimeoutSeconds).toBe(300);
			expect(accept.asset).toBe(USDC_BASE_SEPOLIA);
			expect(accept.extra.name).toBe("USDC.e");
			expect(accept.extra.version).toBe("1");
		});

		it("uses custom description when provided", () => {
			const result = createPaymentRequired("/test", 500n, "Custom lookup");

			expect(result.accepts[0].description).toBe("Custom lookup");
		});

		it("uses default description when not provided", () => {
			const result = createPaymentRequired("/test", 500n);

			expect(result.accepts[0].description).toBe("Qova reputation score lookup");
		});
	});

	describe("decodePaymentHeader", () => {
		it("decodes valid base64 payment header", () => {
			const header = makePaymentHeader();
			const result = decodePaymentHeader(header);

			expect("data" in result).toBe(true);
			if ("data" in result) {
				expect(result.data.x402Version).toBe(1);
				expect(result.data.scheme).toBe("exact");
				expect(result.data.payload.authorization.to).toBe(PAY_TO);
			}
		});

		it("rejects invalid base64", () => {
			const result = decodePaymentHeader("not-valid-base64!!!");

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toContain("base64");
			}
		});

		it("rejects invalid JSON", () => {
			const result = decodePaymentHeader(btoa("{invalid json"));

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toContain("JSON");
			}
		});

		it("rejects wrong x402 version", () => {
			const header = btoa(
				JSON.stringify({
					x402Version: 2,
					scheme: "exact",
					network: "base-sepolia",
					payload: {
						signature: "0xabc",
						authorization: {
							from: FAKE_PAYER,
							to: PAY_TO,
							value: "1000",
							validAfter: 0,
							validBefore: 9999999999,
							nonce: "0x01",
						},
					},
				}),
			);
			const result = decodePaymentHeader(header);

			expect("error" in result).toBe(true);
		});

		it("rejects missing required fields", () => {
			const header = btoa(
				JSON.stringify({
					x402Version: 1,
					scheme: "exact",
					// missing network and payload
				}),
			);
			const result = decodePaymentHeader(header);

			expect("error" in result).toBe(true);
		});
	});

	describe("verifyPayment", () => {
		it("rejects expired payment", async () => {
			const header = makeExpiredPaymentHeader();
			const result = await verifyPayment(header, 1000n);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("expired");
		});

		it("rejects insufficient amount", async () => {
			const header = makeWrongAmountPaymentHeader();
			const result = await verifyPayment(header, 1000n);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Insufficient payment");
		});

		it("rejects invalid base64 header", async () => {
			const result = await verifyPayment("not-base64!!!", 1000n);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("base64");
		});

		it("rejects wrong recipient", async () => {
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
						to: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
						value: PRICE,
						validAfter: now - 60,
						validBefore: now + 300,
						nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
					},
				},
			};
			const header = btoa(JSON.stringify(payload));
			const result = await verifyPayment(header, 1000n);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Invalid payment recipient");
		});

		it("rejects not-yet-active payment", async () => {
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
						validAfter: now + 600, // 10 minutes from now
						validBefore: now + 900,
						nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
					},
				},
			};
			const header = btoa(JSON.stringify(payload));
			const result = await verifyPayment(header, 1000n);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("not yet active");
		});

		it("rejects invalid signature (signature verification fails)", async () => {
			// This uses a structurally valid but cryptographically invalid signature
			const header = makePaymentHeader();
			const result = await verifyPayment(header, 1000n);

			// The fake signature won't recover to FAKE_PAYER
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});
	});
});

// ─── Middleware Tests ────────────────────────────────────────────

describe("x402 middleware", () => {
	it("returns 402 when no X-Payment header is present", async () => {
		const app = createTestApp();
		const res = await app.request("/paid");

		expect(res.status).toBe(402);

		const body = (await res.json()) as PaymentRequiredResponse;
		expect(body.x402Version).toBe(1);
		expect(body.error).toBe("Payment Required");
		expect(body.accepts).toHaveLength(1);
		expect(body.accepts[0].scheme).toBe("exact");
		expect(body.accepts[0].network).toBe("base-sepolia");
		expect(body.accepts[0].maxAmountRequired).toBe(PRICE);
		expect(body.accepts[0].asset).toBe(USDC_BASE_SEPOLIA);
		expect(body.accepts[0].payTo).toBe(PAY_TO);
	});

	it("402 response has correct content-type", async () => {
		const app = createTestApp();
		const res = await app.request("/paid");

		expect(res.status).toBe(402);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("does not gate free endpoints", async () => {
		const app = createTestApp();
		const res = await app.request("/free");

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: string };
		expect(body.data).toBe("free content");
	});

	it("returns 400 for invalid X-Payment header", async () => {
		const app = createTestApp();
		const res = await app.request("/paid", {
			headers: { "X-Payment": "not-valid-base64!!!" },
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; code: string };
		expect(body.code).toBe("PAYMENT_INVALID");
	});

	it("returns 400 for expired payment", async () => {
		const app = createTestApp();
		const header = makeExpiredPaymentHeader();
		const res = await app.request("/paid", {
			headers: { "X-Payment": header },
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; code: string };
		expect(body.code).toBe("PAYMENT_INVALID");
		expect(body.error).toContain("expired");
	});

	it("returns 400 for insufficient payment amount", async () => {
		const app = createTestApp();
		const header = makeWrongAmountPaymentHeader();
		const res = await app.request("/paid", {
			headers: { "X-Payment": header },
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; code: string };
		expect(body.code).toBe("PAYMENT_INVALID");
		expect(body.error).toContain("Insufficient");
	});
});
