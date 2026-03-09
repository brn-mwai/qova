import { describe, expect, it } from "vitest";
import {
  isScoreUpdateArgs,
  isTransactionArgs,
  isAgentActionArgs,
  isBudgetArgs,
} from "../src/utils/guards.js";

describe("isScoreUpdateArgs", () => {
  it("accepts valid args with bigint values", () => {
    expect(
      isScoreUpdateArgs({
        agent: "0x1234567890abcdef1234567890abcdef12345678",
        oldScore: 500n,
        newScore: 750n,
        reason: "0xabc123",
        timestamp: 1700000000n,
      }),
    ).toBe(true);
  });

  it("accepts valid args with number values", () => {
    expect(
      isScoreUpdateArgs({
        agent: "0x1234567890abcdef1234567890abcdef12345678",
        oldScore: 500,
        newScore: 750,
        reason: "0xabc123",
        timestamp: 1700000000,
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isScoreUpdateArgs(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isScoreUpdateArgs(undefined)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isScoreUpdateArgs("string")).toBe(false);
    expect(isScoreUpdateArgs(42)).toBe(false);
  });

  it("rejects missing agent", () => {
    expect(
      isScoreUpdateArgs({
        oldScore: 500n,
        newScore: 750n,
        timestamp: 1700000000n,
      }),
    ).toBe(false);
  });

  it("rejects agent without 0x prefix", () => {
    expect(
      isScoreUpdateArgs({
        agent: "1234567890abcdef",
        oldScore: 500n,
        newScore: 750n,
        timestamp: 1700000000n,
      }),
    ).toBe(false);
  });

  it("rejects missing scores", () => {
    expect(
      isScoreUpdateArgs({
        agent: "0x1234",
        timestamp: 1700000000n,
      }),
    ).toBe(false);
  });
});

describe("isTransactionArgs", () => {
  it("accepts valid args", () => {
    expect(
      isTransactionArgs({
        agent: "0x1234567890abcdef1234567890abcdef12345678",
        txHash: "0xabcdef",
        amount: 1000000n,
        txType: 0,
        timestamp: 1700000000n,
      }),
    ).toBe(true);
  });

  it("accepts amount as number", () => {
    expect(
      isTransactionArgs({
        agent: "0x1234",
        txHash: "0xabcdef",
        amount: 1000000,
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isTransactionArgs(null)).toBe(false);
  });

  it("rejects missing txHash", () => {
    expect(
      isTransactionArgs({
        agent: "0x1234",
        amount: 1000000n,
      }),
    ).toBe(false);
  });

  it("rejects missing amount", () => {
    expect(
      isTransactionArgs({
        agent: "0x1234",
        txHash: "0xabcdef",
      }),
    ).toBe(false);
  });
});

describe("isAgentActionArgs", () => {
  it("is the same function as isTransactionArgs", () => {
    expect(isAgentActionArgs).toBe(isTransactionArgs);
  });
});

describe("isBudgetArgs", () => {
  it("accepts valid args", () => {
    expect(
      isBudgetArgs({
        agent: "0x1234567890abcdef1234567890abcdef12345678",
        dailySpent: 100n,
        monthlySpent: 500n,
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isBudgetArgs(null)).toBe(false);
  });

  it("rejects missing agent", () => {
    expect(isBudgetArgs({ dailySpent: 100n })).toBe(false);
  });

  it("rejects agent without 0x prefix", () => {
    expect(isBudgetArgs({ agent: "notanaddress" })).toBe(false);
  });
});
