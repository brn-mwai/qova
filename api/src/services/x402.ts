/**
 * x402 payment verification service.
 *
 * Decodes X-Payment headers, verifies EIP-712 signatures for
 * USDC transferWithAuthorization, and builds HTTP 402 response bodies.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import { type Address, type Hex, verifyTypedData } from "viem";
import { z } from "zod";

// ─── Constants ───────────────────────────────────────────────────

/** USDC on Base Sepolia. */
const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/** Default facilitator / payTo address (deployer). */
const DEFAULT_PAY_TO: Address = "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158";

/** x402 protocol version. */
const X402_VERSION = 1;

/** Default payment timeout in seconds (5 minutes). */
const DEFAULT_TIMEOUT_SECONDS = 300;

// ─── EIP-712 Domain & Types for TransferWithAuthorization ────────

/**
 * EIP-712 domain for USDC transferWithAuthorization (EIP-3009).
 * This matches the USDC contract's domain separator on Base Sepolia.
 */
const TRANSFER_WITH_AUTHORIZATION_DOMAIN = {
	name: "USDC.e",
	version: "1",
	chainId: 84532n, // Base Sepolia
	verifyingContract: USDC_BASE_SEPOLIA,
} as const;

/**
 * EIP-712 types for TransferWithAuthorization (EIP-3009).
 */
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
	TransferWithAuthorization: [
		{ name: "from", type: "address" },
		{ name: "to", type: "address" },
		{ name: "value", type: "uint256" },
		{ name: "validAfter", type: "uint256" },
		{ name: "validBefore", type: "uint256" },
		{ name: "nonce", type: "bytes32" },
	],
} as const;

// ─── Zod Schemas ─────────────────────────────────────────────────

const HexStringSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid hex string");

const AuthorizationSchema = z.object({
	from: HexStringSchema,
	to: HexStringSchema,
	value: z.string(),
	validAfter: z.number().int(),
	validBefore: z.number().int(),
	nonce: HexStringSchema,
});

const PaymentPayloadSchema = z.object({
	signature: HexStringSchema,
	authorization: AuthorizationSchema,
});

const PaymentHeaderSchema = z.object({
	x402Version: z.literal(X402_VERSION),
	scheme: z.literal("exact"),
	network: z.string(),
	payload: PaymentPayloadSchema,
});

// ─── Types ───────────────────────────────────────────────────────

export type PaymentHeader = z.infer<typeof PaymentHeaderSchema>;
export type Authorization = z.infer<typeof AuthorizationSchema>;

export interface PaymentAccept {
	scheme: "exact";
	network: string;
	maxAmountRequired: string;
	resource: string;
	description: string;
	mimeType: string;
	payTo: string;
	maxTimeoutSeconds: number;
	asset: string;
	extra: {
		name: string;
		version: string;
	};
}

export interface PaymentRequiredResponse {
	x402Version: number;
	error: string;
	accepts: PaymentAccept[];
}

export interface PaymentVerificationResult {
	valid: boolean;
	error?: string;
	payer?: Address;
}

// ─── Service Functions ───────────────────────────────────────────

/**
 * Build an HTTP 402 Payment Required response body.
 *
 * @param resource - The API resource path (e.g., "/api/scores/:address").
 * @param price - Price in USDC base units (6 decimals, so 1000 = $0.001).
 * @param description - Human-readable description of the resource.
 * @returns The 402 response body conforming to x402 spec.
 */
export function createPaymentRequired(
	resource: string,
	price: bigint,
	description = "Qova reputation score lookup",
): PaymentRequiredResponse {
	return {
		x402Version: X402_VERSION,
		error: "Payment Required",
		accepts: [
			{
				scheme: "exact",
				network: "base-sepolia",
				maxAmountRequired: price.toString(),
				resource,
				description,
				mimeType: "application/json",
				payTo: DEFAULT_PAY_TO,
				maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
				asset: USDC_BASE_SEPOLIA,
				extra: {
					name: "USDC.e",
					version: "1",
				},
			},
		],
	};
}

/**
 * Decode and validate an X-Payment header value.
 *
 * @param headerValue - Raw base64-encoded JSON string from the X-Payment header.
 * @returns Parsed and validated payment header, or an error string.
 */
export function decodePaymentHeader(
	headerValue: string,
): { data: PaymentHeader } | { error: string } {
	let decoded: string;
	try {
		decoded = atob(headerValue);
	} catch {
		return { error: "Invalid base64 encoding in X-Payment header" };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(decoded);
	} catch {
		return { error: "Invalid JSON in X-Payment header" };
	}

	const result = PaymentHeaderSchema.safeParse(parsed);
	if (!result.success) {
		return {
			error: `Invalid payment header: ${result.error.issues.map((i) => i.message).join(", ")}`,
		};
	}

	return { data: result.data };
}

/**
 * Verify an x402 payment authorization.
 *
 * Checks:
 * 1. The payment header is structurally valid (Zod).
 * 2. The payment hasn't expired (validBefore > now).
 * 3. The payment is active (validAfter <= now).
 * 4. The amount matches the expected price.
 * 5. The recipient matches our payTo address.
 * 6. The EIP-712 signature is valid and recovers to the `from` address.
 *
 * @param paymentHeader - Raw base64-encoded X-Payment header value.
 * @param expectedAmount - Expected payment amount in USDC base units.
 * @returns Verification result with validity status and optional error.
 */
export async function verifyPayment(
	paymentHeader: string,
	expectedAmount: bigint,
): Promise<PaymentVerificationResult> {
	// 1. Decode and validate structure
	const decoded = decodePaymentHeader(paymentHeader);
	if ("error" in decoded) {
		return { valid: false, error: decoded.error };
	}

	const { payload } = decoded.data;
	const { authorization, signature } = payload;
	const now = Math.floor(Date.now() / 1000);

	// 2. Check expiration
	if (authorization.validBefore <= now) {
		return { valid: false, error: "Payment authorization has expired" };
	}

	// 3. Check not-yet-active
	if (authorization.validAfter > now) {
		return { valid: false, error: "Payment authorization is not yet active" };
	}

	// 4. Check amount matches
	if (BigInt(authorization.value) < expectedAmount) {
		return {
			valid: false,
			error: `Insufficient payment: expected ${expectedAmount.toString()}, got ${authorization.value}`,
		};
	}

	// 5. Check recipient
	if (authorization.to.toLowerCase() !== DEFAULT_PAY_TO.toLowerCase()) {
		return {
			valid: false,
			error: `Invalid payment recipient: expected ${DEFAULT_PAY_TO}, got ${authorization.to}`,
		};
	}

	// 6. Verify EIP-712 signature
	try {
		const valid = await verifyTypedData({
			address: authorization.from as Address,
			domain: TRANSFER_WITH_AUTHORIZATION_DOMAIN,
			types: TRANSFER_WITH_AUTHORIZATION_TYPES,
			primaryType: "TransferWithAuthorization",
			message: {
				from: authorization.from as Address,
				to: authorization.to as Address,
				value: BigInt(authorization.value),
				validAfter: BigInt(authorization.validAfter),
				validBefore: BigInt(authorization.validBefore),
				nonce: authorization.nonce as Hex,
			},
			signature: signature as Hex,
		});

		if (!valid) {
			return { valid: false, error: "Invalid EIP-712 signature" };
		}

		return { valid: true, payer: authorization.from as Address };
	} catch {
		return { valid: false, error: "Signature verification failed" };
	}
}
