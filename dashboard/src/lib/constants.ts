import { formatTokenAmount } from "./tokens";

/** Score grade thresholds -- mirrors @qova/core constants. */
export const SCORE_GRADES = [
	{ grade: "AAA", min: 950, color: "#22C55E", label: "Exceptional" },
	{ grade: "AA", min: 900, color: "#22C55E", label: "Excellent" },
	{ grade: "A", min: 850, color: "#22C55E", label: "Very Good" },
	{ grade: "BBB", min: 750, color: "#22C55E", label: "Good" },
	{ grade: "BB", min: 650, color: "#FACC15", label: "Fair" },
	{ grade: "B", min: 550, color: "#FACC15", label: "Adequate" },
	{ grade: "CCC", min: 450, color: "#FACC15", label: "Below Average" },
	{ grade: "CC", min: 350, color: "#EF4444", label: "Poor" },
	{ grade: "C", min: 250, color: "#EF4444", label: "Very Poor" },
	{ grade: "D", min: 0, color: "#EF4444", label: "Default" },
] as const;

/** Keep backwards compat alias. */
export const SCORE_GRADE_THRESHOLDS = SCORE_GRADES;

export type ScoreGrade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D";

/** Get letter grade from numeric score. */
export function getGrade(score: number): ScoreGrade {
	for (const { grade, min } of SCORE_GRADES) {
		if (score >= min) return grade as ScoreGrade;
	}
	return "D";
}

/** Get score color class based on score value. */
export function getScoreColorClass(score: number): "green" | "yellow" | "red" {
	if (score >= 700) return "green";
	if (score >= 400) return "yellow";
	return "red";
}

/** Get hex color for a score. */
export function getScoreColor(score: number): string {
	if (score >= 700) return "#22C55E";
	if (score >= 400) return "#FACC15";
	return "#EF4444";
}

/** Get hex color for a grade string. */
export function getGradeColor(grade: string): string {
	const entry = SCORE_GRADES.find((g) => g.grade === grade);
	if (entry) return entry.color;
	return "#EF4444";
}

/** Format score as zero-padded 4-char string. */
export function formatScore(score: number): string {
	return String(Math.max(0, Math.min(1000, Math.round(score)))).padStart(4, "0");
}

/** Score to percentage (0-100). */
export function scoreToPercentage(score: number): number {
	return score / 10;
}

/** Shorten wallet address for display. */
export function shortenAddress(address: string): string {
	if (address.length < 10) return address;
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** @deprecated Use `formatTokenAmount()` from `@/lib/tokens` instead. */
export function formatEth(wei: bigint | string): string {
	return formatTokenAmount(wei, "ETH", 18);
}

/** Re-export for convenience. */
export { formatTokenAmount } from "./tokens";
export { getExplorerUrl, getExplorerTxUrl } from "./chains";

/** @deprecated Use `SUPPORTED_CHAINS` from `@/lib/chains` instead. */
export const EXPLORER_URL = "https://basescan.org";

/** Transaction type labels. */
export const TX_TYPES = [
	{ value: 0, label: "Swap" },
	{ value: 1, label: "Transfer" },
	{ value: 2, label: "Stake" },
	{ value: 3, label: "Unstake" },
	{ value: 4, label: "Bridge" },
	{ value: 5, label: "Approve" },
	{ value: 6, label: "Mint" },
	{ value: 7, label: "Burn" },
] as const;

/** Format a relative timestamp. */
export function timeAgo(isoString: string): string {
	const now = Date.now();
	const then = new Date(isoString).getTime();
	const diffMs = now - then;
	const diffSec = Math.floor(diffMs / 1000);

	if (diffSec < 60) return `${diffSec}s ago`;
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDay = Math.floor(diffHr / 24);
	return `${diffDay}d ago`;
}
