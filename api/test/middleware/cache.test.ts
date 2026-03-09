/**
 * Cache middleware tests.
 * Covers Fix 6.1: Cache invalidation after writes.
 * @author Qova Engineering <eng@qova.cc>
 */

import { afterEach, describe, expect, it } from "vitest";
import {
	clearCache,
	deleteCache,
	deleteCacheByPrefix,
	getCached,
	setCache,
} from "../../src/middleware/cache.js";

describe("cache operations", () => {
	afterEach(() => {
		clearCache();
	});

	it("returns null for missing keys", () => {
		expect(getCached("nonexistent")).toBeNull();
	});

	it("stores and retrieves values", () => {
		setCache("key1", { score: 750 }, 60);
		expect(getCached("key1")).toEqual({ score: 750 });
	});

	it("returns null for expired entries", async () => {
		setCache("expiring", { data: true }, 0); // 0-second TTL
		// Wait a tick for expiry
		await new Promise((r) => setTimeout(r, 10));
		expect(getCached("expiring")).toBeNull();
	});

	it("deleteCache removes a specific key", () => {
		setCache("agent:0x1234", { name: "agent1" }, 60);
		setCache("agent:0x5678", { name: "agent2" }, 60);

		deleteCache("agent:0x1234");

		expect(getCached("agent:0x1234")).toBeNull();
		expect(getCached("agent:0x5678")).toEqual({ name: "agent2" });
	});

	it("deleteCacheByPrefix removes all keys with matching prefix", () => {
		setCache("score:0x1234", 750, 60);
		setCache("score:0x5678", 800, 60);
		setCache("agent:0x1234", { name: "agent1" }, 60);

		deleteCacheByPrefix("score:");

		expect(getCached("score:0x1234")).toBeNull();
		expect(getCached("score:0x5678")).toBeNull();
		expect(getCached("agent:0x1234")).toEqual({ name: "agent1" });
	});

	it("clearCache removes all entries", () => {
		setCache("a", 1, 60);
		setCache("b", 2, 60);
		setCache("c", 3, 60);

		clearCache();

		expect(getCached("a")).toBeNull();
		expect(getCached("b")).toBeNull();
		expect(getCached("c")).toBeNull();
	});
});
