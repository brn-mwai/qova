/**
 * Score route timeout tests.
 * Covers Fix 3.1: RPC call timeouts.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";

/** Inline copy of the withTimeout utility from scores.ts for unit testing. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	]);
}

describe("withTimeout utility (Fix 3.1)", () => {
	it("resolves when promise completes before timeout", async () => {
		const result = await withTimeout(Promise.resolve(42), 1000, "test");
		expect(result).toBe(42);
	});

	it("rejects with timeout error when promise exceeds deadline", async () => {
		const slowPromise = new Promise<number>((resolve) => setTimeout(() => resolve(42), 500));
		await expect(withTimeout(slowPromise, 50, "slowOp")).rejects.toThrow(
			"slowOp timed out after 50ms",
		);
	});

	it("preserves original rejection when promise fails before timeout", async () => {
		const failingPromise = Promise.reject(new Error("RPC error"));
		await expect(withTimeout(failingPromise, 1000, "rpc")).rejects.toThrow("RPC error");
	});

	it("includes label in timeout error message", async () => {
		const neverResolve = new Promise<void>(() => {});
		try {
			await withTimeout(neverResolve, 10, "getTransactionStats");
		} catch (e) {
			expect((e as Error).message).toContain("getTransactionStats");
			expect((e as Error).message).toContain("10ms");
		}
	});
});
