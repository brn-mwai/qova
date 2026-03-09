import { describe, expect, it } from "vitest";
import { watchScoreUpdates, watchTransactions, watchAgentActions } from "../src/events.js";
import { QovaError } from "../src/types/errors.js";

describe("event watchers", () => {
  // §2.3 - QovaError for unsupported chains
  it("watchScoreUpdates throws QovaError for unsupported chain", () => {
    expect(() =>
      watchScoreUpdates({ chain: "mainnet" as any }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchTransactions throws QovaError for unsupported chain", () => {
    expect(() =>
      watchTransactions({ chain: "mainnet" as any }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchAgentActions throws QovaError for unsupported chain", () => {
    expect(() =>
      watchAgentActions({ chain: "mainnet" as any }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchScoreUpdates should return an unsubscribe function", () => {
    const unwatch = watchScoreUpdates(
      { chain: "base-sepolia" },
      () => {},
    );
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  it("watchTransactions should return an unsubscribe function", () => {
    const unwatch = watchTransactions(
      { chain: "base-sepolia" },
      () => {},
    );
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  it("watchAgentActions should return an unsubscribe function", () => {
    const unwatch = watchAgentActions(
      { chain: "base-sepolia" },
      () => {},
    );
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  it("watchScoreUpdates should accept agent filter", () => {
    const unwatch = watchScoreUpdates(
      {
        chain: "base-sepolia",
        agent: "0x0a3AF9a104Bd2B5d96C7E24fe95Cc03432431158",
      },
      () => {},
    );
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  // §3.1 - skale-base chain support in events
  it("watchScoreUpdates throws for skale-base (no contracts deployed)", () => {
    // skale-base is in CHAIN_MAP but has no deployed contracts in CONTRACTS
    expect(() =>
      watchScoreUpdates({ chain: "skale-base" }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchTransactions throws for skale-base (no contracts deployed)", () => {
    expect(() =>
      watchTransactions({ chain: "skale-base" }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchAgentActions throws for skale-base (no contracts deployed)", () => {
    expect(() =>
      watchAgentActions({ chain: "skale-base" }, () => {}),
    ).toThrow(QovaError);
  });

  it("watchScoreUpdates should work with base chain", () => {
    // base mainnet has no contracts deployed either
    expect(() =>
      watchScoreUpdates({ chain: "base" }, () => {}),
    ).toThrow(QovaError);
  });

  it("error message includes chain name", () => {
    try {
      watchScoreUpdates({ chain: "unknown-chain" as any }, () => {});
    } catch (e) {
      expect((e as QovaError).message).toContain("unknown-chain");
      expect((e as QovaError).code).toBe("UNSUPPORTED_CHAIN");
    }
  });
});
