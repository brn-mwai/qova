/**
 * API-specific types not covered by @brnmwai/qova-core.
 * @author Qova Engineering <eng@qova.cc>
 */

/** Enriched agent response with formatted fields from SDK utils. */
export interface EnrichedAgentResponse {
	agent: string;
	score: number;
	grade: string;
	gradeColor: string;
	scoreFormatted: string;
	scorePercentage: number;
	lastUpdated: string;
	updateCount: number;
	isRegistered: boolean;
	addressShort: string;
	explorerUrl: string;
}

/** Score breakdown with per-factor contributions. */
export interface ScoreBreakdown {
	agent: string;
	score: number;
	grade: string;
	gradeColor: string;
	factors: {
		transactionVolume: FactorDetail;
		transactionCount: FactorDetail;
		successRate: FactorDetail;
		budgetCompliance: FactorDetail;
		accountAge: FactorDetail;
	};
	timestamp: string;
}

/** Single scoring factor detail. */
export interface FactorDetail {
	raw: string;
	normalized: number;
	weight: number;
	contribution: number;
}

/** Standard API error response. */
export interface ApiErrorResponse {
	error: string;
	code?: string;
	details?: unknown;
}

/**
 * Convert an object containing BigInt values to JSON-safe format.
 * All BigInt values become strings.
 */
export function serializeBigInts<T>(obj: T): T {
	return JSON.parse(
		JSON.stringify(obj, (_, value) => (typeof value === "bigint" ? value.toString() : value)),
	) as T;
}
