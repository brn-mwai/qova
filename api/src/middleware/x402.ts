/**
 * x402 micropayment middleware for Hono.
 *
 * Gates premium endpoints behind x402 payment authorization.
 * When no X-Payment header is present, returns HTTP 402 with payment
 * requirements. When a valid payment is provided, allows the request
 * through and stores the payer address in context.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { createPaymentRequired, verifyPayment } from "../services/x402.js";

// ─── Types ───────────────────────────────────────────────────────

interface X402Options {
	/**
	 * Price per request in USDC base units (6 decimals).
	 * e.g. "1000" = $0.001 USDC.
	 */
	price: string;

	/**
	 * Human-readable description of the paid resource.
	 * Included in the 402 response body.
	 */
	description?: string;
}

// ─── Middleware ───────────────────────────────────────────────────

/**
 * x402 payment-gating middleware.
 *
 * Apply to any Hono route to require x402 micropayment authorization.
 * Free routes simply omit this middleware.
 *
 * @example
 * ```ts
 * scoreRoutes.get(
 *   "/:address",
 *   x402Payment({ price: "1000" }),
 *   validateAddress(),
 *   async (c) => { ... }
 * );
 * ```
 */
export function x402Payment(
	opts: X402Options,
): (c: Context, next: Next) => Promise<Response | undefined> {
	const expectedAmount = BigInt(opts.price);
	const description = opts.description ?? "Qova reputation score lookup";

	return async (c: Context, next: Next) => {
		const paymentHeader = c.req.header("X-Payment");

		// No payment header -- return 402 with payment requirements
		if (!paymentHeader) {
			const resource = c.req.path;
			const body = createPaymentRequired(resource, expectedAmount, description);
			return c.json(body, 402);
		}

		// Verify the payment authorization
		const result = await verifyPayment(paymentHeader, expectedAmount);

		if (!result.valid) {
			return c.json(
				{
					error: result.error ?? "Payment verification failed",
					code: "PAYMENT_INVALID",
				},
				400,
			);
		}

		// Store payer address in context for downstream handlers
		c.set("x402Payer", result.payer);

		await next();
	};
}
