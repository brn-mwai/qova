/**
 * Keys resource — API key management (create, list, revoke).
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type {
	ApiKeyListResponse,
	CreateApiKeyInput,
	CreateApiKeyResponse,
	RevokeApiKeyResponse,
} from "./types.js";

export class Keys {
	constructor(private readonly config: FetchConfig) {}

	/** Create a new API key. The full key is only returned once. */
	async create(input: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
		return request<CreateApiKeyResponse>(this.config, {
			method: "POST",
			path: "/api/keys",
			body: input,
		});
	}

	/** List all API keys for the authenticated user. */
	async list(): Promise<ApiKeyListResponse> {
		return request<ApiKeyListResponse>(this.config, {
			method: "GET",
			path: "/api/keys",
		});
	}

	/** Revoke an API key by ID. */
	async revoke(id: string): Promise<RevokeApiKeyResponse> {
		return request<RevokeApiKeyResponse>(this.config, {
			method: "DELETE",
			path: `/api/keys/${encodeURIComponent(id)}`,
		});
	}
}
