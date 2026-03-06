/**
 * Scores resource — computation, breakdowns, enrichment, anomaly detection.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type {
	AnomalyCheckResponse,
	ComputeScoreInput,
	ComputeScoreResponse,
	EnrichResponse,
	ScoreBreakdownResponse,
} from "./types.js";

export class Scores {
	constructor(private readonly config: FetchConfig) {}

	/** Get full score breakdown with per-factor contributions. */
	async breakdown(address: string): Promise<ScoreBreakdownResponse> {
		return request<ScoreBreakdownResponse>(this.config, {
			method: "GET",
			path: `/api/scores/${encodeURIComponent(address)}`,
		});
	}

	/** Compute a score from raw metrics without reading on-chain state. */
	async compute(input: ComputeScoreInput): Promise<ComputeScoreResponse> {
		return request<ComputeScoreResponse>(this.config, {
			method: "POST",
			path: "/api/scores/compute",
			body: input,
		});
	}

	/** Get off-chain enrichment data for an agent (sanctions, risk level). */
	async enrich(agent: string, onchainData?: Record<string, unknown>): Promise<EnrichResponse> {
		return request<EnrichResponse>(this.config, {
			method: "POST",
			path: "/api/scores/enrich",
			body: { agent, onchainData },
		});
	}

	/** Run anomaly detection on a transaction. */
	async anomalyCheck(
		agent: string,
		txHash: string,
		amount: string,
		txType: number,
	): Promise<AnomalyCheckResponse> {
		return request<AnomalyCheckResponse>(this.config, {
			method: "POST",
			path: "/api/scores/anomaly-check",
			body: { agent, txHash, amount, txType },
		});
	}
}
