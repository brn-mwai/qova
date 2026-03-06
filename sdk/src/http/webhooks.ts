/**
 * Webhooks resource — create, manage, and test webhook endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type {
	CreateWebhookInput,
	CreateWebhookResponse,
	UpdateWebhookInput,
	WebhookListResponse,
	WebhookResponse,
	WebhookDeliveriesResponse,
	WebhookTestResponse,
	WebhookRotateSecretResponse,
	DeleteWebhookResponse,
} from "./types.js";

export class Webhooks {
	constructor(private readonly config: FetchConfig) {}

	/** Create a new webhook endpoint. */
	async create(input: CreateWebhookInput): Promise<CreateWebhookResponse> {
		return request<CreateWebhookResponse>(this.config, {
			method: "POST",
			path: "/api/webhooks",
			body: input,
		});
	}

	/** List all webhooks. */
	async list(): Promise<WebhookListResponse> {
		return request<WebhookListResponse>(this.config, {
			method: "GET",
			path: "/api/webhooks",
		});
	}

	/** Get a single webhook by ID. */
	async get(id: string): Promise<WebhookResponse> {
		return request<WebhookResponse>(this.config, {
			method: "GET",
			path: `/api/webhooks/${encodeURIComponent(id)}`,
		});
	}

	/** Update a webhook. */
	async update(id: string, input: UpdateWebhookInput): Promise<WebhookResponse> {
		return request<WebhookResponse>(this.config, {
			method: "PATCH",
			path: `/api/webhooks/${encodeURIComponent(id)}`,
			body: input,
		});
	}

	/** Delete a webhook. */
	async delete(id: string): Promise<DeleteWebhookResponse> {
		return request<DeleteWebhookResponse>(this.config, {
			method: "DELETE",
			path: `/api/webhooks/${encodeURIComponent(id)}`,
		});
	}

	/** Get delivery log for a webhook. */
	async deliveries(id: string, limit = 50): Promise<WebhookDeliveriesResponse> {
		return request<WebhookDeliveriesResponse>(this.config, {
			method: "GET",
			path: `/api/webhooks/${encodeURIComponent(id)}/deliveries`,
			query: { limit: String(limit) },
		});
	}

	/** Send a test ping to a webhook. */
	async test(id: string): Promise<WebhookTestResponse> {
		return request<WebhookTestResponse>(this.config, {
			method: "POST",
			path: `/api/webhooks/${encodeURIComponent(id)}/test`,
		});
	}

	/** Rotate the signing secret. Returns the new secret. */
	async rotateSecret(id: string): Promise<WebhookRotateSecretResponse> {
		return request<WebhookRotateSecretResponse>(this.config, {
			method: "POST",
			path: `/api/webhooks/${encodeURIComponent(id)}/rotate-secret`,
		});
	}
}
