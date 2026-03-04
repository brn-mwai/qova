/**
 * Webhook delivery engine — fires events to registered webhook URLs.
 *
 * Features:
 * - HMAC-SHA256 signature in X-Qova-Signature header
 * - Exponential backoff retries (3 attempts)
 * - Delivery logging per attempt
 * - Event types: agent.registered, agent.score.updated, transaction.recorded, budget.exceeded
 *
 * @author Qova Engineering <eng@qova.cc>
 */

export interface WebhookConfig {
	id: string;
	url: string;
	secret: string;
	events: string[];
	isActive: boolean;
}

export interface WebhookDelivery {
	webhookId: string;
	event: string;
	url: string;
	attempt: number;
	status: "success" | "failed" | "pending";
	httpStatus?: number;
	error?: string;
	timestamp: number;
	durationMs: number;
}

export type WebhookEvent =
	| "agent.registered"
	| "agent.score.updated"
	| "transaction.recorded"
	| "budget.exceeded"
	| "key.created"
	| "key.revoked";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 5_000, 30_000]; // 1s, 5s, 30s

/** In-memory delivery log (production: push to Convex/DB). */
const deliveryLog: WebhookDelivery[] = [];

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Deliver a webhook with retries.
 */
async function deliverWebhook(
	webhook: WebhookConfig,
	event: WebhookEvent,
	payload: Record<string, unknown>,
): Promise<WebhookDelivery> {
	const body = JSON.stringify({
		event,
		timestamp: new Date().toISOString(),
		data: payload,
	});

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const start = Date.now();
		const delivery: WebhookDelivery = {
			webhookId: webhook.id,
			event,
			url: webhook.url,
			attempt: attempt + 1,
			status: "pending",
			timestamp: start,
			durationMs: 0,
		};

		try {
			const signature = await signPayload(body, webhook.secret);

			const response = await fetch(webhook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Qova-Signature": `sha256=${signature}`,
					"X-Qova-Event": event,
					"X-Qova-Delivery": `${webhook.id}-${Date.now()}`,
					"User-Agent": "Qova-Webhooks/0.2.0",
				},
				body,
				signal: AbortSignal.timeout(10_000),
			});

			delivery.durationMs = Date.now() - start;
			delivery.httpStatus = response.status;

			if (response.ok) {
				delivery.status = "success";
				deliveryLog.push(delivery);
				return delivery;
			}

			delivery.status = "failed";
			delivery.error = `HTTP ${response.status}`;
			deliveryLog.push(delivery);
		} catch (error) {
			delivery.durationMs = Date.now() - start;
			delivery.status = "failed";
			delivery.error = error instanceof Error ? error.message : String(error);
			deliveryLog.push(delivery);
		}

		// Wait before retry (unless last attempt)
		if (attempt < MAX_RETRIES - 1) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
		}
	}

	// All retries failed
	return deliveryLog[deliveryLog.length - 1]!;
}

/**
 * Fan out an event to all matching webhooks.
 * Fire-and-forget — does not block the caller.
 */
export function emitWebhookEvent(
	webhooks: WebhookConfig[],
	event: WebhookEvent,
	payload: Record<string, unknown>,
): void {
	const matching = webhooks.filter(
		(w) => w.isActive && w.events.includes(event),
	);

	for (const webhook of matching) {
		// Fire-and-forget — catch errors to prevent unhandled rejections
		deliverWebhook(webhook, event, payload).catch((err) => {
			console.error(`[webhook] delivery failed for ${webhook.id}:`, err);
		});
	}
}

/**
 * Get delivery log for a specific webhook (most recent first).
 */
export function getDeliveryLog(webhookId?: string, limit = 50): WebhookDelivery[] {
	const filtered = webhookId
		? deliveryLog.filter((d) => d.webhookId === webhookId)
		: deliveryLog;
	return filtered.slice(-limit).reverse();
}

/**
 * Replay a specific delivery (re-send the same event).
 */
export async function replayDelivery(
	webhook: WebhookConfig,
	deliveryEntry: WebhookDelivery,
	payload: Record<string, unknown>,
): Promise<WebhookDelivery> {
	return deliverWebhook(webhook, deliveryEntry.event as WebhookEvent, payload);
}

/** Clear delivery log (for testing). */
export function clearDeliveryLog(): void {
	deliveryLog.length = 0;
}
