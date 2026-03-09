import { NextResponse } from "next/server";
import crypto from "node:crypto";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID ?? "";
const RP_ID = process.env.WORLD_ID_RP_ID ?? "";
const APP_KEY = process.env.WORLD_ID_APP_KEY ?? "";

/**
 * Generate a signed RP (Relying Party) context for World ID v4.
 * The client sends this to IDKit so World App can verify the request origin.
 *
 * POST /api/world-id/rp-context
 * Body: { app_id: string, action: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
	if (!APP_ID || !APP_KEY || !RP_ID) {
		return NextResponse.json(
			{ error: "World ID not configured" },
			{ status: 503 },
		);
	}

	const body = (await request.json()) as { app_id?: string; action?: string };

	if (body.app_id !== APP_ID) {
		return NextResponse.json({ error: "Invalid app_id" }, { status: 400 });
	}

	const nonce = crypto.randomBytes(16).toString("hex");
	const createdAt = Math.floor(Date.now() / 1000);
	const expiresAt = createdAt + 300; // 5 minutes

	// Build the signing payload per World ID v4 spec
	const signingPayload = `${APP_ID}.${body.action ?? "verify-qova-user"}.${nonce}.${createdAt}.${expiresAt}`;

	// Sign with HMAC-SHA256 using the app key
	const keyBytes = APP_KEY.startsWith("0x") ? APP_KEY.slice(2) : APP_KEY;
	const signature = crypto
		.createHmac("sha256", Buffer.from(keyBytes, "hex"))
		.update(signingPayload)
		.digest("hex");

	return NextResponse.json({
		rp_id: RP_ID,
		nonce,
		created_at: createdAt,
		expires_at: expiresAt,
		signature: `0x${signature}`,
	});
}
