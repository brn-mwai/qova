/**
 * API key authentication middleware.
 *
 * Validates Bearer tokens against hashed keys stored in Convex.
 * Keys are generated via the dashboard and follow the format: qova_<40 chars>.
 *
 * Usage:
 *   app.use("/api/*", apiKeyAuth());               // require any valid key
 *   app.use("/api/agents/*", apiKeyAuth("agents:read"));  // require specific scope
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { problemResponse } from "./problem.js";

/** Well-known scopes that map to API key permissions. */
export const API_SCOPES = {
	/** Read agent data, scores, budget status */
	AGENTS_READ: "agents:read",
	/** Register agents, update scores, set budgets */
	AGENTS_WRITE: "agents:write",
	/** Read transaction data */
	TRANSACTIONS_READ: "transactions:read",
	/** Record transactions, record spend */
	TRANSACTIONS_WRITE: "transactions:write",
	/** Access score computation and enrichment */
	SCORES_READ: "scores:read",
	/** Full access (all scopes) */
	ADMIN: "admin",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

/** Result of validating an API key. */
export interface ApiKeyInfo {
	userId: string;
	name: string;
	scopes: string[];
	keyPrefix: string;
}

/**
 * SHA-256 hash a string. Uses Web Crypto API (available in Bun, Node 18+, CF Workers).
 */
async function sha256(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * In-memory cache for validated keys to avoid hitting Convex on every request.
 * Keys expire after 5 minutes.
 */
const keyCache = new Map<string, { info: ApiKeyInfo; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedKey(hash: string): ApiKeyInfo | null {
	const cached = keyCache.get(hash);
	if (!cached) return null;
	if (Date.now() > cached.expiresAt) {
		keyCache.delete(hash);
		return null;
	}
	return cached.info;
}

function setCachedKey(hash: string, info: ApiKeyInfo): void {
	keyCache.set(hash, { info, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear the key cache. Useful for testing. */
export function clearKeyCache(): void {
	keyCache.clear();
}

/**
 * Validate an API key against the Convex database.
 * Override this with your actual Convex client call.
 */
type KeyValidator = (keyHash: string) => Promise<ApiKeyInfo | null>;

/** Default validator using Convex HTTP API. */
async function defaultKeyValidator(keyHash: string): Promise<ApiKeyInfo | null> {
	const convexUrl = process.env.CONVEX_URL;
	if (!convexUrl) {
		console.warn("[auth] CONVEX_URL not set, falling back to dev mode");
		return devModeValidator(keyHash);
	}

	try {
		const res = await fetch(`${convexUrl}/api/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "queries/apiKeyLookup:getByHash",
				args: { keyHash },
			}),
		});

		if (!res.ok) return null;

		const result = (await res.json()) as {
			value: {
				userId: string;
				name: string;
				scopes: string[];
				keyPrefix: string;
				isActive: boolean;
				expiresAt?: number;
			} | null;
		};

		if (!result.value) return null;
		if (!result.value.isActive) return null;
		if (result.value.expiresAt && result.value.expiresAt < Date.now()) return null;

		return {
			userId: result.value.userId,
			name: result.value.name,
			scopes: result.value.scopes,
			keyPrefix: result.value.keyPrefix,
		};
	} catch (error) {
		console.error("[auth] Key validation failed:", error);
		return null;
	}
}

/**
 * Development-mode validator: accepts any key prefixed with qova_
 * Only active when NODE_ENV !== "production" and CONVEX_URL is unset.
 */
function devModeValidator(_keyHash: string): ApiKeyInfo | null {
	if (process.env.NODE_ENV === "production") return null;
	return {
		userId: "dev-user",
		name: "Development Key",
		scopes: [API_SCOPES.ADMIN],
		keyPrefix: "qova_dev_xxx",
	};
}

/**
 * Extract the Bearer token from the Authorization header.
 */
function extractBearerToken(header: string | undefined): string | null {
	if (!header) return null;
	const parts = header.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") return null;
	const token = parts[1];
	if (!token || !token.startsWith("qova_")) return null;
	return token;
}

/**
 * Check if a set of scopes satisfies a required scope.
 * Admin scope grants access to everything.
 */
function hasScope(userScopes: string[], required: string): boolean {
	if (userScopes.includes(API_SCOPES.ADMIN)) return true;
	return userScopes.includes(required);
}

/**
 * Fire-and-forget: update lastUsedAt for the key.
 * Uses the Convex HTTP action bridge.
 */
function touchLastUsed(keyHash: string): void {
	const convexUrl = process.env.CONVEX_URL;
	const serviceSecret = process.env.CONVEX_SERVICE_SECRET;
	if (!convexUrl || !serviceSecret) return;

	// Non-blocking — don't await
	fetch(`${convexUrl}/api-keys/touch`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Service-Secret": serviceSecret,
		},
		body: JSON.stringify({ keyHash }),
	}).catch(() => {
		// Silently ignore — usage tracking is best-effort
	});
}

export interface AuthOptions {
	/** Specific scope required. If omitted, any valid key is accepted. */
	scope?: ApiScope;
	/** Custom key validator. Defaults to Convex lookup. */
	validator?: KeyValidator;
	/** Allow unauthenticated requests (key info set if present). Default: false. */
	optional?: boolean;
}

/**
 * API key authentication middleware for Hono.
 *
 * @example
 * // Require any valid API key
 * app.use("/api/*", apiKeyAuth());
 *
 * // Require specific scope
 * app.get("/api/agents", apiKeyAuth({ scope: "agents:read" }), handler);
 *
 * // Optional auth (sets key info if present, doesn't block)
 * app.get("/api/health", apiKeyAuth({ optional: true }), handler);
 */
export function apiKeyAuth(
	options: AuthOptions = {},
): (c: Context, next: Next) => Promise<Response | undefined> {
	const { scope, validator = defaultKeyValidator, optional = false } = options;

	return async (c: Context, next: Next) => {
		const authHeader = c.req.header("Authorization");
		const token = extractBearerToken(authHeader);

		// No token provided
		if (!token) {
			if (optional) {
				await next();
				return;
			}
			return problemResponse(c, 401, "UNAUTHORIZED", "Authentication Required",
				"Include header: Authorization: Bearer qova_your_api_key");
		}

		// Validate format
		if (token.length < 20) {
			return problemResponse(c, 401, "INVALID_KEY", "Invalid API Key Format",
				"API key must be at least 20 characters and start with qova_");
		}

		// Hash and check cache
		const keyHash = await sha256(token);
		let keyInfo = getCachedKey(keyHash);

		// Cache miss — validate against database
		if (!keyInfo) {
			keyInfo = await validator(keyHash);
			if (!keyInfo) {
				return problemResponse(c, 401, "INVALID_KEY", "Invalid or Expired API Key",
					"The provided API key is not valid or has expired");
			}
			setCachedKey(keyHash, keyInfo);
		}

		// Check scope
		if (scope && !hasScope(keyInfo.scopes, scope)) {
			return problemResponse(c, 403, "FORBIDDEN", "Insufficient Permissions",
				`This API key requires scope "${scope}" to access this endpoint`);
		}

		// Track usage (fire-and-forget)
		touchLastUsed(keyHash);

		// Attach key info to context for downstream handlers
		c.set("apiKey", keyInfo);
		c.set("userId", keyInfo.userId);

		await next();
	};
}

/**
 * Helper to get the authenticated API key info from context.
 */
export function getApiKey(c: Context): ApiKeyInfo | undefined {
	return c.get("apiKey") as ApiKeyInfo | undefined;
}
