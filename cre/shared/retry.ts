/**
 * @file shared/retry.ts
 * Synchronous retry utility for CRE WASM workflows.
 * Uses .result() pattern -- no async/await.
 */

/**
 * Retry a synchronous function up to maxRetries times on failure.
 * Designed for CRE SDK .result() calls that throw on transient errors.
 * @param fn Function to execute (should call .result() internally).
 * @param maxRetries Maximum number of retry attempts (default: 2).
 * @param logger Logger for retry messages (runtime.log compatible).
 * @returns The result of fn on success.
 * @throws The last error if all retries are exhausted.
 */
export function withRetry<T>(
	fn: () => T,
	maxRetries: number,
	logger: { log: (msg: string) => void },
): T {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return fn();
		} catch (e) {
			lastError = e;
			if (attempt < maxRetries) {
				logger.log(
					`Retry ${attempt + 1}/${maxRetries}: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		}
	}
	throw lastError;
}
