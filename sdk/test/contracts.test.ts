import { describe, expect, it } from "vitest";
import { InvalidScoreError, QovaError } from "../src/types/errors.js";
import { handleContractError } from "../src/utils/errors.js";
import { updateScore, batchUpdateScores } from "../src/contracts/reputation.js";

// We can't test actual contract calls without a chain, but we CAN test
// client-side validation (§1.3, §1.4) and error handling (§2.1).

describe("updateScore client-side validation (§1.3)", () => {
  it("rejects score > 1000", async () => {
    await expect(
      updateScore(
        {} as any, // wallet (won't be reached)
        {} as any, // publicClient
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        1001,
        "0x00",
      ),
    ).rejects.toThrow(InvalidScoreError);
  });

  it("rejects negative score", async () => {
    await expect(
      updateScore(
        {} as any,
        {} as any,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        -1,
        "0x00",
      ),
    ).rejects.toThrow(InvalidScoreError);
  });

  it("rejects invalid agent address", async () => {
    await expect(
      updateScore(
        {} as any,
        {} as any,
        "0x0000000000000000000000000000000000000001",
        "not-an-address" as any,
        500,
        "0x00",
      ),
    ).rejects.toThrow(QovaError);
  });
});

describe("batchUpdateScores client-side validation (§1.4)", () => {
  it("rejects mismatched array lengths", async () => {
    await expect(
      batchUpdateScores(
        {} as any,
        {} as any,
        "0x0000000000000000000000000000000000000001",
        ["0x0000000000000000000000000000000000000002"],
        [500, 600], // 2 scores but only 1 agent
        ["0x00"],
      ),
    ).rejects.toThrow(QovaError);
  });

  it("rejects empty arrays", async () => {
    await expect(
      batchUpdateScores(
        {} as any,
        {} as any,
        "0x0000000000000000000000000000000000000001",
        [],
        [],
        [],
      ),
    ).rejects.toThrow(QovaError);
  });

  it("rejects score > 1000 in batch", async () => {
    await expect(
      batchUpdateScores(
        {} as any,
        {} as any,
        "0x0000000000000000000000000000000000000001",
        ["0x0000000000000000000000000000000000000002"],
        [1500],
        ["0x00"],
      ),
    ).rejects.toThrow(InvalidScoreError);
  });
});

describe("handleContractError (§2.1)", () => {
  it("re-throws QovaError unchanged", () => {
    const original = new QovaError("test", "TEST");
    expect(() => handleContractError(original, "op")).toThrow(original);
  });

  it("maps timeout errors", () => {
    const err = new Error("request timeout");
    expect(() => handleContractError(err, "getScore")).toThrow(QovaError);
    try {
      handleContractError(err, "getScore");
    } catch (e) {
      expect((e as QovaError).code).toBe("RPC_TIMEOUT");
    }
  });

  it("maps network errors (ECONNREFUSED)", () => {
    const err = new Error("ECONNREFUSED");
    try {
      handleContractError(err, "op");
    } catch (e) {
      expect((e as QovaError).code).toBe("NETWORK_ERROR");
    }
  });

  it("maps fetch failed errors", () => {
    const err = new Error("fetch failed");
    try {
      handleContractError(err, "op");
    } catch (e) {
      expect((e as QovaError).code).toBe("NETWORK_ERROR");
    }
  });

  it("maps insufficient funds errors", () => {
    const err = new Error("insufficient funds for gas");
    try {
      handleContractError(err, "op");
    } catch (e) {
      expect((e as QovaError).code).toBe("INSUFFICIENT_FUNDS");
    }
  });

  it("falls back to UNKNOWN_ERROR", () => {
    try {
      handleContractError("some string error", "op");
    } catch (e) {
      expect((e as QovaError).code).toBe("UNKNOWN_ERROR");
    }
  });
});
