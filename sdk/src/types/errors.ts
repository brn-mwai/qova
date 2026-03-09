/**
 * SDK error types mapping from Solidity custom errors.
 * @author Qova Engineering <eng@qova.cc>
 */

/** Base error class for all Qova SDK errors. */
export class QovaError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "QovaError";
	}
}

/** Thrown when an operation targets an unregistered agent. */
export class AgentNotRegisteredError extends QovaError {
	constructor(agent: string) {
		super(`Agent ${agent} is not registered`, "AGENT_NOT_REGISTERED");
		this.name = "AgentNotRegisteredError";
	}
}

/** Thrown when attempting to register an already registered agent. */
export class AgentAlreadyRegisteredError extends QovaError {
	constructor(agent: string) {
		super(`Agent ${agent} is already registered`, "AGENT_ALREADY_REGISTERED");
		this.name = "AgentAlreadyRegisteredError";
	}
}

/** Thrown when a budget check fails for an agent action. */
export class BudgetExceededError extends QovaError {
	constructor(
		agent: string,
		public readonly requested?: bigint,
		public readonly available?: bigint,
	) {
		super(`Budget exceeded for agent ${agent}`, "BUDGET_EXCEEDED");
		this.name = "BudgetExceededError";
	}
}

/** Thrown when the caller lacks the required role. */
export class UnauthorizedError extends QovaError {
	constructor(role?: string) {
		super(`Unauthorized${role ? `: missing role ${role}` : ""}`, "UNAUTHORIZED");
		this.name = "UnauthorizedError";
	}
}

/** Thrown when a score value is out of the valid range (0-1000). */
export class InvalidScoreError extends QovaError {
	constructor(score: number) {
		super(`Invalid score ${score}: must be between 0 and 1000`, "INVALID_SCORE");
		this.name = "InvalidScoreError";
	}
}

/** Thrown when no budget has been configured for an agent. */
export class NoBudgetSetError extends QovaError {
	constructor(agent: string) {
		super(`No budget configured for agent ${agent}`, "NO_BUDGET_SET");
		this.name = "NoBudgetSetError";
	}
}

/** Thrown when a zero address is provided where a valid address is required. */
export class ZeroAddressError extends QovaError {
	constructor() {
		super("Zero address is not allowed", "ZERO_ADDRESS");
		this.name = "ZeroAddressError";
	}
}

/** Thrown when batch arrays have mismatched lengths. */
export class ArrayLengthMismatchError extends QovaError {
	constructor() {
		super("Batch arrays must have the same length", "ARRAY_LENGTH_MISMATCH");
		this.name = "ArrayLengthMismatchError";
	}
}

/**
 * Map a Solidity custom error name to the corresponding SDK error.
 * @param errorName - The Solidity custom error name from the revert.
 * @param args - The error arguments from the revert.
 * @returns A typed QovaError subclass.
 */
export function mapContractError(errorName: string, args?: readonly unknown[]): QovaError {
	const agentArg = typeof args?.[0] === "string" ? args[0] : "unknown";

	switch (errorName) {
		case "AgentNotRegistered":
			return new AgentNotRegisteredError(agentArg);
		case "AgentAlreadyRegistered":
			return new AgentAlreadyRegisteredError(agentArg);
		case "InvalidScore":
			return new InvalidScoreError(typeof args?.[0] === "number" ? args[0] : -1);
		case "ArrayLengthMismatch":
			return new ArrayLengthMismatchError();
		case "BudgetExceeded":
			return new BudgetExceededError(
				agentArg,
				typeof args?.[1] === "bigint" ? args[1] : undefined,
				typeof args?.[2] === "bigint" ? args[2] : undefined,
			);
		case "DailyLimitReached":
		case "MonthlyLimitReached":
		case "PerTxLimitReached":
			return new BudgetExceededError(
				agentArg,
				typeof args?.[1] === "bigint" ? args[1] : undefined,
				typeof args?.[2] === "bigint" ? args[2] : undefined,
			);
		case "NoBudgetSet":
			return new NoBudgetSetError(agentArg);
		case "BudgetCheckFailed":
			return new BudgetExceededError(agentArg);
		case "InvalidContract":
		case "ZeroAddress":
			return new ZeroAddressError();
		case "AccessControlUnauthorizedAccount":
			return new UnauthorizedError(typeof args?.[1] === "string" ? args[1] : undefined);
		default:
			return new QovaError(`Contract error: ${errorName}`, "CONTRACT_ERROR");
	}
}
