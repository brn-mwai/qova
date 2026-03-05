import { describe, expect, it } from "bun:test";
import {
	classifyVerificationStatus,
	computeCreditGrade,
	computeVerification,
	type VerificationInput,
} from "../shared/verification";

const NOW = Math.floor(Date.now() / 1000);

/** Helper: create a fully verified agent input */
function verifiedAgent(overrides: Partial<VerificationInput> = {}): VerificationInput {
	return {
		isRegistered: true,
		score: 750,
		registrationTimestamp: NOW - 180 * 86400,
		contractExists: true,
		contractCreationTimestamp: NOW - 180 * 86400,
		ownerAddress: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
		ownerConsistent: true,
		transactionCount: 100,
		lastActivityTimestamp: NOW - 86400, // 1 day ago
		recentOwnershipTransfer: false,
		lastOwnershipTransferTimestamp: 0,
		sanctionsClean: true,
		currentTimestamp: NOW,
		hasBudget: true,
		...overrides,
	};
}

describe("computeVerification", () => {
	it("returns VERIFIED for a fully compliant agent", () => {
		const input = verifiedAgent();
		const result = computeVerification(input);

		expect(result.status).toBe("VERIFIED");
		expect(result.checksPassed).toBe(result.checksTotal);
		expect(result.checksTotal).toBe(8);
		expect(result.grade).toBe("BBB");
	});

	it("returns SUSPICIOUS for sanctioned agent", () => {
		const input = verifiedAgent({ sanctionsClean: false });
		const result = computeVerification(input);

		expect(result.status).toBe("SUSPICIOUS");
		expect(result.checks.find((c) => c.check === "sanctions_screening")?.passed).toBe(false);
	});

	it("returns UNVERIFIED for unregistered agent", () => {
		const input = verifiedAgent({ isRegistered: false, score: 0 });
		const result = computeVerification(input);

		expect(result.status).toBe("UNVERIFIED");
	});

	it("returns PARTIALLY_VERIFIED when most checks pass", () => {
		const input = verifiedAgent({
			contractCreationTimestamp: NOW - 3600, // only 1 hour old (fails age check)
			transactionCount: 0, // no transactions (fails activity check)
		});
		const result = computeVerification(input);

		// 6 of 8 checks pass = 75% => PARTIALLY_VERIFIED
		expect(result.status).toBe("PARTIALLY_VERIFIED");
		expect(result.checksPassed).toBe(6);
	});

	it("flags recent ownership transfer as suspicious", () => {
		const input = verifiedAgent({
			recentOwnershipTransfer: true,
			lastOwnershipTransferTimestamp: NOW - 86400, // 1 day ago (within 7-day window)
			contractCreationTimestamp: NOW - 3600, // also fails age check
			transactionCount: 0, // also fails activity
			score: 50, // also fails min score
		});
		const result = computeVerification(input);

		expect(result.status).toBe("SUSPICIOUS");
		expect(result.checks.find((c) => c.check === "ownership_stability")?.passed).toBe(false);
	});

	it("handles zero-activity agent correctly", () => {
		const input = verifiedAgent({
			transactionCount: 0,
			lastActivityTimestamp: 0,
		});
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "recent_activity")?.passed).toBe(false);
	});

	it("handles agent with no contract bytecode", () => {
		const input = verifiedAgent({
			contractExists: false,
			contractCreationTimestamp: 0,
		});
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "contract_exists")?.passed).toBe(false);
		expect(result.checks.find((c) => c.check === "contract_age")?.passed).toBe(false);
	});

	it("handles inactive agent (no activity for 30+ days)", () => {
		const input = verifiedAgent({
			lastActivityTimestamp: NOW - 45 * 86400, // 45 days ago
		});
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "recent_activity")?.passed).toBe(false);
	});

	it("handles owner address mismatch", () => {
		const input = verifiedAgent({ ownerConsistent: false });
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "owner_consistent")?.passed).toBe(false);
	});

	it("handles agent below minimum score threshold", () => {
		const input = verifiedAgent({ score: 50 });
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "minimum_score")?.passed).toBe(false);
	});

	it("passes ownership stability when transfer is outside suspicious window", () => {
		const input = verifiedAgent({
			recentOwnershipTransfer: true,
			lastOwnershipTransferTimestamp: NOW - 30 * 86400, // 30 days ago (outside 7-day window)
		});
		const result = computeVerification(input);

		expect(result.checks.find((c) => c.check === "ownership_stability")?.passed).toBe(true);
	});
});

describe("computeCreditGrade", () => {
	it("returns AAA for scores 950+", () => {
		expect(computeCreditGrade(950)).toBe("AAA");
		expect(computeCreditGrade(1000)).toBe("AAA");
	});

	it("returns AA for scores 900-949", () => {
		expect(computeCreditGrade(900)).toBe("AA");
		expect(computeCreditGrade(949)).toBe("AA");
	});

	it("returns A for scores 850-899", () => {
		expect(computeCreditGrade(850)).toBe("A");
		expect(computeCreditGrade(899)).toBe("A");
	});

	it("returns BBB for scores 750-849", () => {
		expect(computeCreditGrade(750)).toBe("BBB");
		expect(computeCreditGrade(849)).toBe("BBB");
	});

	it("returns BB for scores 650-749", () => {
		expect(computeCreditGrade(650)).toBe("BB");
		expect(computeCreditGrade(749)).toBe("BB");
	});

	it("returns B for scores 550-649", () => {
		expect(computeCreditGrade(550)).toBe("B");
		expect(computeCreditGrade(649)).toBe("B");
	});

	it("returns CCC for scores 450-549", () => {
		expect(computeCreditGrade(450)).toBe("CCC");
		expect(computeCreditGrade(549)).toBe("CCC");
	});

	it("returns CC for scores 350-449", () => {
		expect(computeCreditGrade(350)).toBe("CC");
		expect(computeCreditGrade(449)).toBe("CC");
	});

	it("returns C for scores 250-349", () => {
		expect(computeCreditGrade(250)).toBe("C");
		expect(computeCreditGrade(349)).toBe("C");
	});

	it("returns D for scores below 250", () => {
		expect(computeCreditGrade(0)).toBe("D");
		expect(computeCreditGrade(100)).toBe("D");
		expect(computeCreditGrade(249)).toBe("D");
	});
});

describe("classifyVerificationStatus edge cases", () => {
	it("returns SUSPICIOUS when sanctions flagged regardless of other checks", () => {
		const input = verifiedAgent({ sanctionsClean: false });
		const result = computeVerification(input);
		const status = classifyVerificationStatus(result.checks, input);
		expect(status).toBe("SUSPICIOUS");
	});

	it("returns UNVERIFIED when not registered", () => {
		const input = verifiedAgent({ isRegistered: false });
		const result = computeVerification(input);
		const status = classifyVerificationStatus(result.checks, input);
		expect(status).toBe("UNVERIFIED");
	});
});
