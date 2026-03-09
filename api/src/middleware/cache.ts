/**
 * Simple in-memory TTL cache for read-heavy endpoints.
 * @author Qova Engineering <eng@qova.cc>
 */

const cache = new Map<string, { data: unknown; expires: number }>();

/**
 * Get a cached value by key.
 * @param key - Cache key (typically the request URL).
 * @returns Cached data if still valid, null otherwise.
 */
export function getCached<T>(key: string): T | null {
	const cached = cache.get(key);
	if (cached && cached.expires > Date.now()) return cached.data as T;
	cache.delete(key);
	return null;
}

/**
 * Store a value in the cache with a TTL.
 * @param key - Cache key.
 * @param data - Data to cache.
 * @param ttlSeconds - Time-to-live in seconds (default 30).
 */
export function setCache(key: string, data: unknown, ttlSeconds = 30): void {
	cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

/**
 * Delete a specific cache entry by key.
 * @param key - Cache key to invalidate.
 */
export function deleteCache(key: string): void {
	cache.delete(key);
}

/**
 * Delete all cache entries matching a prefix.
 * @param prefix - Key prefix to match.
 */
export function deleteCacheByPrefix(prefix: string): void {
	for (const key of cache.keys()) {
		if (key.startsWith(prefix)) cache.delete(key);
	}
}

/** Clear all cached entries. Useful for testing. */
export function clearCache(): void {
	cache.clear();
}
