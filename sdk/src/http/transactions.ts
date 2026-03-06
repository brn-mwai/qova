/**
 * Transactions resource — recording and stats.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type {
	RecordTransactionInput,
	TransactionStatsResponse,
	TxHashResponse,
} from "./types.js";

export class Transactions {
	constructor(private readonly config: FetchConfig) {}

	/** Get aggregate transaction stats for an agent. */
	async stats(address: string): Promise<TransactionStatsResponse> {
		return request<TransactionStatsResponse>(this.config, {
			method: "GET",
			path: `/api/transactions/${encodeURIComponent(address)}`,
		});
	}

	/** Record a new transaction for an agent. */
	async record(input: RecordTransactionInput, options?: { idempotencyKey?: string }): Promise<TxHashResponse> {
		return request<TxHashResponse>(this.config, {
			method: "POST",
			path: "/api/transactions/record",
			body: input,
			idempotencyKey: options?.idempotencyKey,
		});
	}
}
