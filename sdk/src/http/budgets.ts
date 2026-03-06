/**
 * Budgets resource — spending limits and enforcement.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig } from "./fetch.js";
import { request } from "./fetch.js";
import type { BudgetStatusResponse, CheckBudgetResponse, SetBudgetInput, TxHashResponse } from "./types.js";

export class Budgets {
	constructor(private readonly config: FetchConfig) {}

	/** Get current budget status with remaining allowances. */
	async get(address: string): Promise<BudgetStatusResponse> {
		return request<BudgetStatusResponse>(this.config, {
			method: "GET",
			path: `/api/budgets/${encodeURIComponent(address)}`,
		});
	}

	/** Set spending limits for an agent. Amounts in wei strings. */
	async set(address: string, input: SetBudgetInput): Promise<TxHashResponse> {
		return request<TxHashResponse>(this.config, {
			method: "POST",
			path: `/api/budgets/${encodeURIComponent(address)}/set`,
			body: input,
		});
	}

	/** Check if a spend amount would be within budget. */
	async check(address: string, amount: string): Promise<CheckBudgetResponse> {
		return request<CheckBudgetResponse>(this.config, {
			method: "POST",
			path: `/api/budgets/${encodeURIComponent(address)}/check`,
			body: { amount },
		});
	}

	/** Record a spend against the agent's budget. */
	async recordSpend(address: string, amount: string): Promise<TxHashResponse> {
		return request<TxHashResponse>(this.config, {
			method: "POST",
			path: `/api/budgets/${encodeURIComponent(address)}/spend`,
			body: { amount },
		});
	}
}
