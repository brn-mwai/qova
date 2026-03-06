/**
 * Route aggregator — mounts all API routes with middleware stack.
 *
 * Middleware order:
 * 1. CORS
 * 2. Metrics collection
 * 3. Request logging
 * 4. Rate limiting (per route group)
 * 5. Auth (scope-based)
 * 6. Circuit breaker (on chain-dependent routes)
 * 7. Idempotency (on POST endpoints)
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyAuth, API_SCOPES } from "../middleware/auth.js";
import { circuitBreaker } from "../middleware/circuit-breaker.js";
import { idempotency } from "../middleware/idempotency.js";
import { metricsCollector, metricsRoutes } from "../middleware/metrics.js";
import { rateLimiter } from "../middleware/rate-limit.js";
import { requestLogger } from "../middleware/logger.js";
import { agentRoutes } from "./agents.js";
import { budgetRoutes } from "./budgets.js";
import { docsRoutes } from "./docs.js";
import { healthRoutes } from "./health.js";
import { apiKeyRoutes } from "./keys.js";
import { scoreRoutes } from "./scores.js";
import { transactionRoutes } from "./transactions.js";
import { verifyRoutes } from "./verify.js";
import { webhookRoutes } from "./webhooks.js";

const routes = new Hono();

// ── Global middleware ───────────────────────────────────────────────

// CORS — allow external developers to call from browsers
routes.use(
	"/*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
		exposeHeaders: [
			"X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset",
			"X-Request-Id", "Idempotency-Replayed",
		],
		maxAge: 86400,
	}),
);

// Metrics collection (before logging so it captures all requests)
routes.use("/*", metricsCollector());

// Request logging
routes.use("/*", requestLogger());

// ── Public routes (no auth) ─────────────────────────────────────────
routes.route("/health", healthRoutes);
routes.route("/docs", docsRoutes);
routes.route("/metrics", metricsRoutes);

// ── Protected routes ────────────────────────────────────────────────

// Rate limiting
routes.use("/agents/*", rateLimiter({ windowMs: 60_000, max: 120 }));
routes.use("/scores/*", rateLimiter({ windowMs: 60_000, max: 120 }));
routes.use("/transactions/*", rateLimiter({ windowMs: 60_000, max: 60 }));
routes.use("/budgets/*", rateLimiter({ windowMs: 60_000, max: 60 }));
routes.use("/verify/*", rateLimiter({ windowMs: 60_000, max: 60 }));
routes.use("/keys/*", rateLimiter({ windowMs: 60_000, max: 20 }));

// Scope enforcement: reads vs writes
routes.get("/agents", apiKeyAuth({ scope: API_SCOPES.AGENTS_READ }));
routes.get("/agents/*", apiKeyAuth({ scope: API_SCOPES.AGENTS_READ }));
routes.post("/agents/*", apiKeyAuth({ scope: API_SCOPES.AGENTS_WRITE }));

routes.use("/scores/*", apiKeyAuth({ scope: API_SCOPES.SCORES_READ }));

routes.get("/transactions/*", apiKeyAuth({ scope: API_SCOPES.TRANSACTIONS_READ }));
routes.post("/transactions/*", apiKeyAuth({ scope: API_SCOPES.TRANSACTIONS_WRITE }));

routes.get("/budgets/*", apiKeyAuth({ scope: API_SCOPES.AGENTS_READ }));
routes.post("/budgets/*", apiKeyAuth({ scope: API_SCOPES.AGENTS_WRITE }));

routes.use("/verify/*", apiKeyAuth({ scope: API_SCOPES.AGENTS_READ }));

// Circuit breaker on chain-dependent routes
routes.use("/agents/*", circuitBreaker({ name: "chain", failureThreshold: 5, cooldownMs: 30_000 }));
routes.use("/transactions/*", circuitBreaker({ name: "chain", failureThreshold: 5, cooldownMs: 30_000 }));
routes.use("/budgets/*", circuitBreaker({ name: "chain", failureThreshold: 5, cooldownMs: 30_000 }));
routes.use("/scores/*", circuitBreaker({ name: "chain", failureThreshold: 5, cooldownMs: 30_000 }));

// Idempotency on write endpoints
routes.post("/agents/*", idempotency());
routes.post("/transactions/*", idempotency());
routes.post("/budgets/*", idempotency());

// Mount route handlers
routes.route("/agents", agentRoutes);
routes.route("/transactions", transactionRoutes);
routes.route("/budgets", budgetRoutes);
routes.route("/scores", scoreRoutes);
routes.route("/verify", verifyRoutes);
routes.route("/keys", apiKeyRoutes);

// Webhooks — admin scope, rate limited
routes.use("/webhooks/*", rateLimiter({ windowMs: 60_000, max: 30 }));
routes.use("/webhooks/*", apiKeyAuth({ scope: API_SCOPES.ADMIN }));
routes.route("/webhooks", webhookRoutes);

export { routes };
