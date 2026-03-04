/**
 * Verify resource — pre-transaction trust checks and sanctions screening.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type { SanctionsResponse, VerifyResponse } from "./types.js";

export class Verify {
	constructor(private readonly config: FetchConfig) {}

	/** Run a full trust verification on an agent before a transaction. */
	async agent(agent: string): Promise<VerifyResponse> {
		return request<VerifyResponse>(this.config, {
			method: "POST",
			path: "/api/verify",
			body: { agent },
		});
	}

	/** Run sanctions screening on an agent address. */
	async sanctions(agent: string): Promise<SanctionsResponse> {
		return request<SanctionsResponse>(this.config, {
			method: "POST",
			path: "/api/verify/sanctions",
			body: { agent },
		});
	}
}
