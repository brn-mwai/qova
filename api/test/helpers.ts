/**
 * Shared test utilities for route tests.
 *
 * In test/dev environments without CONVEX_URL, the auth middleware
 * falls back to dev-mode validation which accepts any qova_-prefixed key.
 */

/** A valid test API key (dev mode accepts any qova_ key ≥20 chars). */
export const TEST_API_KEY = "qova_test_000000000000000000000000000000";

/** Standard auth headers for test requests. */
export const AUTH_HEADERS: Record<string, string> = {
	Authorization: `Bearer ${TEST_API_KEY}`,
};

/**
 * Merge auth headers with optional additional headers.
 */
export function authedHeaders(extra: Record<string, string> = {}): Record<string, string> {
	return { ...AUTH_HEADERS, ...extra };
}
