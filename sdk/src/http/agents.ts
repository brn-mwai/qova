/**
 * Agents resource — registration, scores, and details.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import { PageIterator } from "./pagination.js";
import type {
	AgentDetailsResponse,
	AgentListResponse,
	AgentRegisteredResponse,
	AgentScoreResponse,
	AgentSummary,
	BatchUpdateScoresResponse,
	PaginationParams,
	RegisterAgentResponse,
	UpdateScoreResponse,
} from "./types.js";

export class Agents {
	constructor(private readonly config: FetchConfig) {}

	/** List agents with cursor-based pagination. Returns one page. */
	async list(params?: PaginationParams): Promise<AgentListResponse> {
		const query: Record<string, string> = {};
		if (params?.limit) query.limit = String(params.limit);
		if (params?.cursor) query.cursor = params.cursor;
		if (params?.sort) query.sort = params.sort;

		return request<AgentListResponse>(this.config, {
			method: "GET",
			path: "/api/agents",
			query: Object.keys(query).length > 0 ? query : undefined,
		});
	}

	/**
	 * Auto-paginating iterator — fetches all pages lazily.
	 *
	 * @example
	 * ```ts
	 * for await (const agent of qova.agents.listAll({ limit: 50 })) {
	 *   console.log(agent);
	 * }
	 *
	 * // Or collect into an array
	 * const all = await qova.agents.listAll().toArray();
	 * ```
	 */
	listAll(params?: PaginationParams): PageIterator<AgentSummary> {
		return new PageIterator<AgentSummary>(this.config, "/api/agents", params);
	}

	/** Get enriched details for a single agent. */
	async get(address: string): Promise<AgentDetailsResponse> {
		return request<AgentDetailsResponse>(this.config, {
			method: "GET",
			path: `/api/agents/${encodeURIComponent(address)}`,
		});
	}

	/** Get an agent's current score with grade and color. */
	async score(address: string): Promise<AgentScoreResponse> {
		return request<AgentScoreResponse>(this.config, {
			method: "GET",
			path: `/api/agents/${encodeURIComponent(address)}/score`,
		});
	}

	/** Check whether an agent is registered. */
	async isRegistered(address: string): Promise<AgentRegisteredResponse> {
		return request<AgentRegisteredResponse>(this.config, {
			method: "GET",
			path: `/api/agents/${encodeURIComponent(address)}/registered`,
		});
	}

	/** Register a new agent on-chain. */
	async register(agent: string, options?: { idempotencyKey?: string }): Promise<RegisterAgentResponse> {
		return request<RegisterAgentResponse>(this.config, {
			method: "POST",
			path: "/api/agents/register",
			body: { agent },
			idempotencyKey: options?.idempotencyKey,
		});
	}

	/** Update an agent's reputation score. */
	async updateScore(
		address: string,
		score: number,
		reason?: string,
	): Promise<UpdateScoreResponse> {
		return request<UpdateScoreResponse>(this.config, {
			method: "POST",
			path: `/api/agents/${encodeURIComponent(address)}/score`,
			body: { score, reason },
		});
	}

	/** Batch update scores for multiple agents in one call. */
	async batchUpdateScores(
		agents: string[],
		scores: number[],
		reasons: string[],
	): Promise<BatchUpdateScoresResponse> {
		if (agents.length !== scores.length || agents.length !== reasons.length) {
			throw new Error("agents, scores, and reasons arrays must have the same length");
		}
		return request<BatchUpdateScoresResponse>(this.config, {
			method: "POST",
			path: "/api/agents/batch-scores",
			body: { agents, scores, reasons },
		});
	}
}
