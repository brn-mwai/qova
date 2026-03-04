/**
 * API key management endpoints.
 *
 * Create, list, and revoke API keys programmatically.
 * Requires a valid API key with admin scope.
 *
 * Bootstrap: create your first key from the dashboard, then use it here.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { validateBody } from "../middleware/validate.js";
import { apiKeyAuth, getApiKey, API_SCOPES } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";
import { z } from "zod";

export const apiKeyRoutes = new Hono<AppEnv>();

/** Schema for creating a new API key. */
const CreateApiKeyRequest = z.object({
	name: z.string().min(1).max(100),
	scopes: z.array(
		z.enum([
			"agents:read",
			"agents:write",
			"transactions:read",
			"transactions:write",
			"scores:read",
			"admin",
		]),
	).min(1),
	expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * SHA-256 hash a string.
 */
async function sha256(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically random API key.
 */
function generateApiKey(): string {
	const randomBytes = new Uint8Array(30);
	crypto.getRandomValues(randomBytes);
	return (
		"qova_" +
		Array.from(randomBytes)
			.map((b) => b.toString(36).padStart(2, "0"))
			.join("")
			.slice(0, 40)
	);
}

/**
 * Call a Convex HTTP action endpoint with service authentication.
 */
async function callConvex<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
	const convexUrl = process.env.CONVEX_URL;
	const serviceSecret = process.env.CONVEX_SERVICE_SECRET;

	if (!convexUrl || !serviceSecret) {
		console.error("[keys] CONVEX_URL or CONVEX_SERVICE_SECRET not set");
		return null;
	}

	const res = await fetch(`${convexUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Service-Secret": serviceSecret,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "unknown error");
		console.error(`[keys] Convex call to ${path} failed: ${res.status} ${text}`);
		return null;
	}

	return (await res.json()) as T;
}

/**
 * POST /api/keys — Create a new API key.
 *
 * The full key is returned ONCE. It cannot be retrieved again.
 */
apiKeyRoutes.post(
	"/",
	apiKeyAuth({ scope: API_SCOPES.ADMIN }),
	validateBody(CreateApiKeyRequest),
	async (c) => {
		const caller = getApiKey(c);
		if (!caller) return c.json({ error: "Unauthorized" }, 401);

		const body = c.get("body") as z.infer<typeof CreateApiKeyRequest>;

		// Generate key on this server
		const key = generateApiKey();
		const keyPrefix = key.slice(0, 12);
		const keyHash = await sha256(key);

		const expiresAt = body.expiresInDays
			? Date.now() + body.expiresInDays * 86400000
			: undefined;

		// Store via Convex HTTP action
		const result = await callConvex<{ id: string }>("/api-keys/store", {
			userId: caller.userId,
			name: body.name,
			scopes: body.scopes,
			expiresAt,
			keyPrefix,
			keyHash,
		});

		if (!result) {
			return c.json({ error: "Failed to create key" }, 500);
		}

		return c.json(
			{
				key,
				keyPrefix,
				id: result.id,
				name: body.name,
				scopes: body.scopes,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
				warning: "This is the only time the full key will be shown. Store it securely.",
			},
			201,
		);
	},
);

/** GET /api/keys — List API keys for the authenticated user. */
apiKeyRoutes.get(
	"/",
	apiKeyAuth({ scope: API_SCOPES.ADMIN }),
	async (c) => {
		const caller = getApiKey(c);
		if (!caller) return c.json({ error: "Unauthorized" }, 401);

		const result = await callConvex<{ keys: unknown[] }>("/api-keys/list", {
			userId: caller.userId,
		});

		return c.json({ keys: result?.keys ?? [] });
	},
);

/** DELETE /api/keys/:id — Revoke an API key. */
apiKeyRoutes.delete(
	"/:id",
	apiKeyAuth({ scope: API_SCOPES.ADMIN }),
	async (c) => {
		const caller = getApiKey(c);
		if (!caller) return c.json({ error: "Unauthorized" }, 401);

		const id = c.req.param("id");

		const result = await callConvex<{ revoked: boolean }>("/api-keys/revoke", {
			id,
			userId: caller.userId,
		});

		if (!result) {
			return c.json({ error: "Failed to revoke key" }, 500);
		}

		return c.json({ revoked: true, id });
	},
);
