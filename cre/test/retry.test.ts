/**
 * Retry utility tests.
 * Covers Fix 3.3: withRetry for transient failures.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "bun:test";
import { withRetry } from "../shared/retry";

/** Mock logger that records messages. */
function mockLogger(): { log: (msg: string) => void; messages: string[] } {
	const messages: string[] = [];
	return { log: (msg: string) => messages.push(msg), messages };
}

describe("withRetry", () => {
	it("returns result on first success", () => {
		const logger = mockLogger();
		const result = withRetry(() => 42, 2, logger);
		expect(result).toBe(42);
		expect(logger.messages).toHaveLength(0);
	});

	it("retries on first failure and returns on second success", () => {
		const logger = mockLogger();
		let attempts = 0;
		const result = withRetry(
			() => {
				attempts++;
				if (attempts === 1) throw new Error("transient");
				return "ok";
			},
			2,
			logger,
		);
		expect(result).toBe("ok");
		expect(attempts).toBe(2);
		expect(logger.messages).toHaveLength(1);
		expect(logger.messages[0]).toContain("Retry 1/2");
		expect(logger.messages[0]).toContain("transient");
	});

	it("throws after exhausting all retries", () => {
		const logger = mockLogger();
		expect(() =>
			withRetry(
				() => {
					throw new Error("persistent failure");
				},
				2,
				logger,
			),
		).toThrow("persistent failure");
		// 2 retry log messages (attempt 1 and 2 fail, attempt 0 = original)
		expect(logger.messages).toHaveLength(2);
	});

	it("returns result on third attempt (maxRetries=2)", () => {
		const logger = mockLogger();
		let attempts = 0;
		const result = withRetry(
			() => {
				attempts++;
				if (attempts <= 2) throw new Error(`fail-${attempts}`);
				return "finally";
			},
			2,
			logger,
		);
		expect(result).toBe("finally");
		expect(attempts).toBe(3);
		expect(logger.messages).toHaveLength(2);
	});

	it("works with maxRetries=0 (no retries)", () => {
		const logger = mockLogger();
		expect(() =>
			withRetry(
				() => {
					throw new Error("no retry");
				},
				0,
				logger,
			),
		).toThrow("no retry");
		expect(logger.messages).toHaveLength(0);
	});

	it("handles non-Error thrown values", () => {
		const logger = mockLogger();
		let attempts = 0;
		const result = withRetry(
			() => {
				attempts++;
				if (attempts === 1) throw "string error";
				return "recovered";
			},
			1,
			logger,
		);
		expect(result).toBe("recovered");
		expect(logger.messages[0]).toContain("string error");
	});
});
