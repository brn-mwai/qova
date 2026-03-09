/**
 * Hono app configuration -- middleware stack + route mounting.
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { bodyLimit } from "hono/body-limit";
import { errorHandler } from "./middleware/error.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { routes } from "./routes/index.js";
import { MOCK_AGENTS } from "./constants.js";

const isProd = process.env.NODE_ENV === "production";

const CORS_ORIGINS = isProd
	? [
			"https://qova.cc",
			"https://app.qova.cc",
			"https://docs.qova.cc",
		]
	: [
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:5173",
			"https://qova.cc",
			"https://app.qova.cc",
			"https://docs.qova.cc",
		];

const app = new Hono();

// ─── Request ID ──────────────────────────────────────────────────
app.use("*", requestId);

// ─── Security Headers ────────────────────────────────────────────

app.use("*", async (c, next) => {
	await next();
	c.header("X-Frame-Options", "DENY");
	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-XSS-Protection", "1; mode=block");
	c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	c.header("Referrer-Policy", "strict-origin-when-cross-origin");
	c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
});

// ─── Security Middleware ──────────────────────────────────────────

// CORS -- restrict to known origins
app.use(
	"*",
	cors({
		origin: CORS_ORIGINS,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Payment"],
		maxAge: 86400,
	}),
);

// Body size limit -- 1MB for all requests
app.use("*", bodyLimit({ maxSize: 1024 * 1024 }));

// Global rate limit -- 100 req/min per IP
app.use("*", rateLimit({ windowMs: 60_000, max: 100 }));

// Stricter limit on write endpoints -- 20 req/min per IP
app.use(
	"/api/agents/register",
	rateLimit({ windowMs: 60_000, max: 20 }),
);
app.use(
	"/api/agents/batch-scores",
	rateLimit({ windowMs: 60_000, max: 10 }),
);
app.use(
	"/api/transactions/record",
	rateLimit({ windowMs: 60_000, max: 30 }),
);

// ─── Observability ────────────────────────────────────────────────
app.use("*", logger((msg) => {
	// Redact sensitive headers from log output
	const redacted = msg
		.replace(/X-Payment:\s*\S+/gi, "X-Payment: [REDACTED]")
		.replace(/Authorization:\s*\S+/gi, "Authorization: [REDACTED]");
	console.log(redacted);
}));
app.use("*", prettyJSON());
app.onError(errorHandler);

// ─── Routes ───────────────────────────────────────────────────────

// Mount API routes under /api
app.route("/api", routes);

// x402 micropayment middleware is applied per-route in routes/scores.ts.
// Premium endpoints (GET /api/scores/:address) return HTTP 402 when
// no X-Payment header is present.

// CRE-compatible routes under /v1 (backward compat with CRE workflow configs)
app.get("/v1/agents", (c) => {
	return c.json({ agents: MOCK_AGENTS });
});
app.post("/v1/enrich", async (c) => {
	return c.json({
		sanctionsClean: true,
		apiReputationScore: 82,
		riskLevel: "LOW",
		lastChecked: Date.now(),
	});
});
app.post("/v1/anomaly-check", async (c) => {
	return c.json({
		anomalyDetected: false,
		riskScore: 0.12,
		flags: [],
	});
});
app.post("/v1/sanctions/check", async (c) => {
	return c.json({
		clean: true,
		checked: true,
		source: "mock-ofac-sdn",
		timestamp: Date.now(),
	});
});
app.post("/v1/webhook", async (c) => {
	return c.json({ received: true });
});

// Root -- API info
app.get("/", (c) =>
	c.json({
		name: "Qova Protocol API",
		version: "0.1.0",
		chain: isProd ? "base" : "base-sepolia",
		docs: "https://docs.qova.cc/api",
	}),
);

// 404 handler
app.notFound((c) => c.json({ error: "Not Found", code: "NOT_FOUND" }, 404));

export { app };
