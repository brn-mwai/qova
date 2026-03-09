/**
 * AI consensus and response parsing tests.
 * Covers Fix 5.1: AI response validation, median aggregation, edge cases.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Replicate schemas from reputation-oracle/main.ts
const AIResponseSchema = z.object({
	choices: z.array(z.object({
		message: z.object({
			content: z.string(),
		}),
	})).min(1),
});

const AIAnalysisSchema = z.object({
	risk_score: z.number().min(0).max(100),
	behavioral_flags: z.array(z.string()),
	confidence: z.number().min(0).max(100),
});

function parseAIResponse(responseBody: string): {
	risk_score: number;
	behavioral_flags: string[];
	confidence: number;
} {
	const groqResponse = JSON.parse(responseBody);
	const parsed = AIResponseSchema.parse(groqResponse);
	const content = parsed.choices[0].message.content;
	return AIAnalysisSchema.parse(JSON.parse(content));
}

/** Simulate median aggregation across DON nodes */
function medianOf(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1] + sorted[mid]) / 2;
	}
	return sorted[mid];
}

/** Simulate AI score combination: 85% traditional + 15% AI */
function combineScores(traditionalScore: number, aiRiskScore: number): number {
	const aiAdjustment = (100 - aiRiskScore) * 10; // 0-1000 range
	const combined = Math.round(
		(traditionalScore * 8500) / 10000 + (aiAdjustment * 1500) / 10000,
	);
	return Math.max(0, Math.min(1000, combined));
}

describe("AI response parsing", () => {
	it("parses valid response with all fields", () => {
		const body = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 30,
						behavioral_flags: ["consistent_performer", "low_volume"],
						confidence: 75,
					}),
				},
			}],
		});
		const result = parseAIResponse(body);
		expect(result.risk_score).toBe(30);
		expect(result.behavioral_flags).toHaveLength(2);
		expect(result.confidence).toBe(75);
	});

	it("parses response with empty behavioral_flags", () => {
		const body = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 0,
						behavioral_flags: [],
						confidence: 100,
					}),
				},
			}],
		});
		const result = parseAIResponse(body);
		expect(result.behavioral_flags).toHaveLength(0);
	});

	it("rejects response with risk_score outside 0-100", () => {
		const body = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 101,
						behavioral_flags: [],
						confidence: 50,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(body)).toThrow();
	});

	it("rejects malformed outer JSON", () => {
		expect(() => parseAIResponse("not json")).toThrow();
	});

	it("rejects when content is not valid JSON", () => {
		const body = JSON.stringify({
			choices: [{ message: { content: "plain text" } }],
		});
		expect(() => parseAIResponse(body)).toThrow();
	});

	it("rejects when confidence is negative", () => {
		const body = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 50,
						behavioral_flags: [],
						confidence: -5,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(body)).toThrow();
	});
});

describe("median aggregation (consensus simulation)", () => {
	it("computes median of odd-length array", () => {
		expect(medianOf([10, 30, 20])).toBe(20);
	});

	it("computes median of even-length array", () => {
		expect(medianOf([10, 20, 30, 40])).toBe(25);
	});

	it("handles single node response", () => {
		expect(medianOf([42])).toBe(42);
	});

	it("handles identical node responses (consensus)", () => {
		expect(medianOf([50, 50, 50])).toBe(50);
	});

	it("median is resilient to one outlier in 3 nodes", () => {
		// Two nodes agree on ~30, one outlier at 90
		const result = medianOf([28, 32, 90]);
		expect(result).toBe(32); // Outlier rejected by median
	});
});

describe("AI score combination", () => {
	it("produces 850 traditional + 0 risk AI = high combined score", () => {
		const result = combineScores(850, 0);
		// 850 * 0.85 + 1000 * 0.15 = 722.5 + 150 = 872
		expect(result).toBeGreaterThan(850);
	});

	it("produces 850 traditional + 100 risk AI = lower combined score", () => {
		const result = combineScores(850, 100);
		// 850 * 0.85 + 0 * 0.15 = 722.5 + 0 = 722
		expect(result).toBeLessThan(850);
	});

	it("clamps to 1000 maximum", () => {
		expect(combineScores(1000, 0)).toBeLessThanOrEqual(1000);
	});

	it("clamps to 0 minimum", () => {
		expect(combineScores(0, 100)).toBeGreaterThanOrEqual(0);
	});

	it("AI contribution is exactly 15% weight", () => {
		// With traditional=0, the AI contribution alone is (100-risk)*10 * 0.15
		const aiOnly = combineScores(0, 0);
		// 0 * 0.85 + 1000 * 0.15 = 150
		expect(aiOnly).toBe(150);
	});
});
