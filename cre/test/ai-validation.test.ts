/**
 * AI response validation tests.
 * Covers Fix 1.2: HTTP response structure validation for Groq API.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Replicate the schemas from reputation-oracle/main.ts for isolated testing
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

/** Simulate the validated parse logic from the fixed analyzeAgentBehavior */
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

describe("AI response validation (Fix 1.2)", () => {
	it("parses valid AI response", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 25,
						behavioral_flags: ["consistent_performer"],
						confidence: 85,
					}),
				},
			}],
		});

		const result = parseAIResponse(response);
		expect(result.risk_score).toBe(25);
		expect(result.behavioral_flags).toEqual(["consistent_performer"]);
		expect(result.confidence).toBe(85);
	});

	it("rejects response with missing choices array", () => {
		const response = JSON.stringify({ data: "no choices" });
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects response with empty choices array", () => {
		const response = JSON.stringify({ choices: [] });
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects response with missing message content", () => {
		const response = JSON.stringify({
			choices: [{ message: {} }],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects AI analysis with risk_score > 100", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 150,
						behavioral_flags: [],
						confidence: 50,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects AI analysis with negative risk_score", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: -10,
						behavioral_flags: [],
						confidence: 50,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects AI analysis with confidence > 100", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 30,
						behavioral_flags: [],
						confidence: 200,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects non-JSON content in message", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: "This is not JSON",
				},
			}],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("rejects AI analysis with missing behavioral_flags", () => {
		const response = JSON.stringify({
			choices: [{
				message: {
					content: JSON.stringify({
						risk_score: 30,
						confidence: 50,
					}),
				},
			}],
		});
		expect(() => parseAIResponse(response)).toThrow();
	});

	it("accepts boundary values (0 and 100)", () => {
		const response = JSON.stringify({
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
		const result = parseAIResponse(response);
		expect(result.risk_score).toBe(0);
		expect(result.confidence).toBe(100);
	});
});
