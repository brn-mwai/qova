import { describe, expect, it } from "vitest";
import {
  QovaError,
  AgentNotRegisteredError,
  AgentAlreadyRegisteredError,
  BudgetExceededError,
  UnauthorizedError,
  InvalidScoreError,
  NoBudgetSetError,
  ZeroAddressError,
  ArrayLengthMismatchError,
  mapContractError,
} from "../src/types/errors.js";

describe("QovaError", () => {
  it("should create with message and code", () => {
    const err = new QovaError("test error", "TEST_CODE");
    expect(err.message).toBe("test error");
    expect(err.code).toBe("TEST_CODE");
    expect(err.name).toBe("QovaError");
    expect(err.cause).toBeUndefined();
  });

  it("should create with cause", () => {
    const cause = new Error("root cause");
    const err = new QovaError("wrapper", "WRAP", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("typed error subclasses", () => {
  it("AgentNotRegisteredError", () => {
    const err = new AgentNotRegisteredError("0x1234");
    expect(err.name).toBe("AgentNotRegisteredError");
    expect(err.code).toBe("AGENT_NOT_REGISTERED");
    expect(err.message).toContain("0x1234");
    expect(err).toBeInstanceOf(QovaError);
  });

  it("AgentAlreadyRegisteredError", () => {
    const err = new AgentAlreadyRegisteredError("0xabcd");
    expect(err.name).toBe("AgentAlreadyRegisteredError");
    expect(err.code).toBe("AGENT_ALREADY_REGISTERED");
  });

  it("BudgetExceededError", () => {
    const err = new BudgetExceededError("0x1234", 100n, 50n);
    expect(err.name).toBe("BudgetExceededError");
    expect(err.code).toBe("BUDGET_EXCEEDED");
    expect(err.requested).toBe(100n);
    expect(err.available).toBe(50n);
  });

  it("UnauthorizedError with role", () => {
    const err = new UnauthorizedError("OPERATOR_ROLE");
    expect(err.message).toContain("OPERATOR_ROLE");
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("UnauthorizedError without role", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("InvalidScoreError", () => {
    const err = new InvalidScoreError(1500);
    expect(err.message).toContain("1500");
    expect(err.code).toBe("INVALID_SCORE");
  });

  it("NoBudgetSetError", () => {
    const err = new NoBudgetSetError("0x1234");
    expect(err.code).toBe("NO_BUDGET_SET");
  });

  it("ZeroAddressError", () => {
    const err = new ZeroAddressError();
    expect(err.code).toBe("ZERO_ADDRESS");
  });

  it("ArrayLengthMismatchError", () => {
    const err = new ArrayLengthMismatchError();
    expect(err.code).toBe("ARRAY_LENGTH_MISMATCH");
  });
});

describe("mapContractError", () => {
  it("should map AgentNotRegistered", () => {
    const err = mapContractError("AgentNotRegistered");
    expect(err).toBeInstanceOf(AgentNotRegisteredError);
  });

  it("should map AgentAlreadyRegistered", () => {
    const err = mapContractError("AgentAlreadyRegistered");
    expect(err).toBeInstanceOf(AgentAlreadyRegisteredError);
  });

  it("should map InvalidScore", () => {
    const err = mapContractError("InvalidScore");
    expect(err).toBeInstanceOf(InvalidScoreError);
  });

  it("should map ArrayLengthMismatch", () => {
    const err = mapContractError("ArrayLengthMismatch");
    expect(err).toBeInstanceOf(ArrayLengthMismatchError);
  });

  it("should map BudgetExceeded", () => {
    const err = mapContractError("BudgetExceeded", [100n, 50n]);
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("should map DailyLimitReached", () => {
    const err = mapContractError("DailyLimitReached", [100n, 50n]);
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("should map NoBudgetSet", () => {
    const err = mapContractError("NoBudgetSet");
    expect(err).toBeInstanceOf(NoBudgetSetError);
  });

  it("should map BudgetCheckFailed", () => {
    const err = mapContractError("BudgetCheckFailed");
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("should map ZeroAddress", () => {
    const err = mapContractError("ZeroAddress");
    expect(err).toBeInstanceOf(ZeroAddressError);
  });

  it("should map AccessControlUnauthorizedAccount", () => {
    const err = mapContractError("AccessControlUnauthorizedAccount", ["0x1234", "0xrole"]);
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("should return generic QovaError for unknown errors", () => {
    const err = mapContractError("SomeUnknownError");
    expect(err).toBeInstanceOf(QovaError);
    expect(err.code).toBe("CONTRACT_ERROR");
  });

  it("should extract agent address from AgentNotRegistered args", () => {
    const err = mapContractError("AgentNotRegistered", ["0xABCD"]);
    expect(err).toBeInstanceOf(AgentNotRegisteredError);
    expect(err.message).toContain("0xABCD");
  });

  it("should extract agent address from AgentAlreadyRegistered args", () => {
    const err = mapContractError("AgentAlreadyRegistered", ["0x9999"]);
    expect(err).toBeInstanceOf(AgentAlreadyRegisteredError);
    expect(err.message).toContain("0x9999");
  });

  it("should extract score from InvalidScore args", () => {
    const err = mapContractError("InvalidScore", [2000]);
    expect(err).toBeInstanceOf(InvalidScoreError);
    expect(err.message).toContain("2000");
  });

  it("should extract agent from NoBudgetSet args", () => {
    const err = mapContractError("NoBudgetSet", ["0xBEEF"]);
    expect(err).toBeInstanceOf(NoBudgetSetError);
    expect(err.message).toContain("0xBEEF");
  });

  it("should extract agent from BudgetExceeded with full args", () => {
    const err = mapContractError("BudgetExceeded", ["0xCAFE", 500n, 100n]) as BudgetExceededError;
    expect(err).toBeInstanceOf(BudgetExceededError);
    expect(err.message).toContain("0xCAFE");
    expect(err.requested).toBe(500n);
    expect(err.available).toBe(100n);
  });

  it("should map MonthlyLimitReached", () => {
    const err = mapContractError("MonthlyLimitReached", ["0x1234", 200n, 50n]);
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("should map PerTxLimitReached", () => {
    const err = mapContractError("PerTxLimitReached");
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("should map InvalidContract to ZeroAddressError", () => {
    const err = mapContractError("InvalidContract");
    expect(err).toBeInstanceOf(ZeroAddressError);
  });

  it("should fallback to 'unknown' when args are missing", () => {
    const err = mapContractError("AgentNotRegistered");
    expect(err).toBeInstanceOf(AgentNotRegisteredError);
    expect(err.message).toContain("unknown");
  });
});
