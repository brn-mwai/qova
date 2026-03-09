/**
 * Score utility functions for grading and display.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { ScoreGrade } from "../types/agent.js";
import { SCORE_GRADE_THRESHOLDS } from "../constants.js";

/** Score grade thresholds derived from constants (single source of truth). */
const GRADE_THRESHOLDS: readonly { grade: ScoreGrade; min: number }[] = (
	Object.entries(SCORE_GRADE_THRESHOLDS) as [ScoreGrade, number][]
).map(([grade, min]) => ({ grade, min }));

/**
 * Map a numeric score (0-1000) to a letter grade.
 * @param score - The reputation score.
 * @returns The corresponding letter grade.
 * @example getGrade(950) // "AAA"
 * @example getGrade(849) // "BBB"
 */
export function getGrade(score: number): ScoreGrade {
	for (const { grade, min } of GRADE_THRESHOLDS) {
		if (score >= min) return grade;
	}
	return "D";
}

/**
 * Map a numeric score to a hex color for UI display.
 * Matches the Qova UI design system thresholds.
 * @param score - The reputation score (0-1000).
 * @returns Hex color string.
 * @example getScoreColor(800) // "#22C55E" (green)
 * @example getScoreColor(500) // "#FACC15" (yellow)
 * @example getScoreColor(200) // "#EF4444" (red)
 */
export function getScoreColor(score: number): string {
	if (score >= 700) return "#22C55E";
	if (score >= 400) return "#FACC15";
	return "#EF4444";
}

/**
 * Format a score as a zero-padded 4-character string.
 * @param score - The reputation score (0-1000).
 * @returns Padded string, e.g. "0847".
 * @example formatScore(42) // "0042"
 * @example formatScore(1000) // "1000"
 */
export function formatScore(score: number): string {
	return String(Math.max(0, Math.min(1000, Math.round(score)))).padStart(4, "0");
}

/**
 * Convert a score (0-1000) to a percentage (0-100).
 * @param score - The reputation score.
 * @returns Percentage value.
 * @example scoreToPercentage(750) // 75
 */
export function scoreToPercentage(score: number): number {
	return score / 10;
}
