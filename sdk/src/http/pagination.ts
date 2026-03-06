/**
 * Auto-pagination iterator — fetches pages lazily as you iterate.
 *
 * @example
 * ```ts
 * // Iterate through ALL agents automatically
 * for await (const agent of qova.agents.listAll({ limit: 50 })) {
 *   console.log(agent);
 * }
 *
 * // Or consume manually
 * const iter = qova.agents.listAll();
 * const first = await iter.next(); // { value: "0x...", done: false }
 * ```
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { FetchConfig, RequestOptions } from "./fetch.js";
import { request } from "./fetch.js";
import type { PaginatedResponse, PaginationParams } from "./types.js";

/**
 * Async iterator that auto-paginates through a Qova list endpoint.
 */
export class PageIterator<T> implements AsyncIterable<T> {
	private nextCursor: string | null = null;
	private buffer: T[] = [];
	private exhausted = false;
	private initialFetch = true;

	constructor(
		private readonly config: FetchConfig,
		private readonly path: string,
		private readonly params: PaginationParams = {},
	) {}

	async *[Symbol.asyncIterator](): AsyncIterator<T> {
		while (!this.exhausted || this.buffer.length > 0) {
			// Drain buffer first
			while (this.buffer.length > 0) {
				yield this.buffer.shift() as T;
			}

			if (this.exhausted) break;

			// Fetch next page
			const query: Record<string, string> = {};
			if (this.params.limit) query.limit = String(this.params.limit);
			if (this.params.sort) query.sort = this.params.sort;
			if (!this.initialFetch && this.nextCursor) {
				query.cursor = this.nextCursor;
			} else if (this.initialFetch && this.params.cursor) {
				query.cursor = this.params.cursor;
			}
			this.initialFetch = false;

			const opts: RequestOptions = { method: "GET", path: this.path, query };
			const page = await request<PaginatedResponse<T>>(this.config, opts);

			this.buffer = page.data;
			this.nextCursor = page.pagination.nextCursor;

			if (!page.pagination.hasMore || page.data.length === 0) {
				this.exhausted = true;
			}
		}
	}

	/** Collect all remaining items into an array. */
	async toArray(): Promise<T[]> {
		const results: T[] = [];
		for await (const item of this) {
			results.push(item);
		}
		return results;
	}

	/** Take up to `n` items from the iterator. */
	async take(n: number): Promise<T[]> {
		const results: T[] = [];
		for await (const item of this) {
			results.push(item);
			if (results.length >= n) break;
		}
		return results;
	}
}
