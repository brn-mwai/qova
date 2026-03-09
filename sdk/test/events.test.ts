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
});
