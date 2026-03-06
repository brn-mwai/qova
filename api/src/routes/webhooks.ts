/**
 * Webhook management endpoints — CRUD, delivery logs, test ping.
 *
 * Requires admin scope. Webhooks are stored in Convex and delivered
 * by the webhook engine in services/webhooks.ts.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import { Hono } from "hono";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { getApiKey } from "../middleware/auth.js";
import { problemResponse } from "../middleware/problem.js";
import type { AppEnv } from "../types/env.js";
import {
	emitWebhookEvent,
	getDeliveryLog,
	type WebhookConfig,
	type WebhookEvent,
} from "../services/webhooks.js";

export const webhookRoutes = new Hono<AppEnv>();

// ── In-memory webhook store (production: Convex) ────────────────────

const webhooks = new Map<string, WebhookConfig & { userId: string; createdAt: number }>();

function generateWebhookSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return "whsec_" + Array.from(bytes).map((b) => b.toString(36)).join("").slice(0, 40);
}

function generateWebhookId(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return "wh_" + Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

// ── Schemas ─────────────────────────────────────────────────────────

const VALID_EVENTS: WebhookEvent[] = [
	"agent.registered",
	"agent.score.updated",
	"transaction.recorded",
	"budget.exceeded",
	"key.created",
	"key.revoked",
];

const CreateWebhookRequest = z.object({
	url: z.string().url().startsWith("https://", { message: "Webhook URL must use HTTPS" }),
	events: z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1),
	description: z.string().max(200).optional(),
});

const UpdateWebhookRequest = z.object({
	url: z.string().url().startsWith("https://", { message: "Webhook URL must use HTTPS" }).optional(),
	events: z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1).optional(),
	isActive: z.boolean().optional(),
	description: z.string().max(200).optional(),
});

// ── Routes ──────────────────────────────────────────────────────────

/** POST /api/webhooks — Register a new webhook. */
webhookRoutes.post("/", validateBody(CreateWebhookRequest), (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const body = c.get("body") as z.infer<typeof CreateWebhookRequest>;
	const id = generateWebhookId();
	const secret = generateWebhookSecret();

	const webhook = {
		id,
		url: body.url,
		secret,
		events: body.events,
		isActive: true,
		userId: caller.userId,
		createdAt: Date.now(),
	};

	webhooks.set(id, webhook);

	return c.json({
		id,
		url: body.url,
		events: body.events,
		isActive: true,
		secret,
		createdAt: new Date(webhook.createdAt).toISOString(),
		warning: "Store the signing secret securely. It will not be shown again.",
	}, 201);
});

/** GET /api/webhooks — List all webhooks for the user. */
webhookRoutes.get("/", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const userWebhooks = Array.from(webhooks.values())
		.filter((w) => w.userId === caller.userId)
		.map(({ secret: _secret, userId: _userId, ...rest }) => rest);

	return c.json({ webhooks: userWebhooks });
});

/** GET /api/webhooks/:id — Get a single webhook (without secret). */
webhookRoutes.get("/:id", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	const { secret: _secret, userId: _userId, ...safe } = webhook;
	return c.json(safe);
});

/** PATCH /api/webhooks/:id — Update a webhook. */
webhookRoutes.patch("/:id", validateBody(UpdateWebhookRequest), (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	const updates = c.get("body") as z.infer<typeof UpdateWebhookRequest>;
	if (updates.url) webhook.url = updates.url;
	if (updates.events) webhook.events = updates.events;
	if (updates.isActive !== undefined) webhook.isActive = updates.isActive;

	const { secret: _secret, userId: _userId, ...safe } = webhook;
	return c.json(safe);
});

/** DELETE /api/webhooks/:id — Delete a webhook. */
webhookRoutes.delete("/:id", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	webhooks.delete(c.req.param("id"));
	return c.json({ deleted: true, id: c.req.param("id") });
});

/** GET /api/webhooks/:id/deliveries — Delivery log for a webhook. */
webhookRoutes.get("/:id/deliveries", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
	const deliveries = getDeliveryLog(webhook.id, limit);

	return c.json({ deliveries });
});

/** POST /api/webhooks/:id/test — Send a test ping. */
webhookRoutes.post("/:id/test", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	// Fire a test event
	emitWebhookEvent(
		[webhook],
		"agent.registered" as WebhookEvent,
		{ test: true, message: "Test webhook delivery from Qova", timestamp: new Date().toISOString() },
	);

	return c.json({ sent: true, webhookId: webhook.id, note: "Test event dispatched. Check your endpoint and delivery logs." });
});

/** POST /api/webhooks/:id/rotate-secret — Rotate the signing secret. */
webhookRoutes.post("/:id/rotate-secret", (c) => {
	const caller = getApiKey(c);
	if (!caller) return problemResponse(c, 401, "UNAUTHORIZED", "Unauthorized", "Valid API key required");

	const webhook = webhooks.get(c.req.param("id"));
	if (!webhook || webhook.userId !== caller.userId) {
		return problemResponse(c, 404, "WEBHOOK_NOT_FOUND", "Webhook Not Found", "No webhook found with this ID");
	}

	webhook.secret = generateWebhookSecret();

	return c.json({
		id: webhook.id,
		secret: webhook.secret,
		warning: "Store the new signing secret securely. The previous secret is now invalid.",
	});
});

/** Get all active webhooks for a user (used by internal event emitters). */
export function getWebhooksForUser(userId: string): WebhookConfig[] {
	return Array.from(webhooks.values())
		.filter((w) => w.userId === userId && w.isActive);
}

/** Clear all webhooks (for testing). */
export function clearWebhooks(): void {
	webhooks.clear();
}
