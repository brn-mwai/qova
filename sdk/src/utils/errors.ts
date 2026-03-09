/**
 * Shared contract error handling utility.
 * FIX: CONCERNS.md §2.1 - Differentiated error types for contract calls.
 * @author Qova Engineering <eng@qova.cc>
 */

import { ContractFunctionRevertedError } from "viem";
import { mapContractError, QovaError } from "../types/errors.js";

/**
 * Handle errors from contract interactions with differentiated error types.
 * @param error - The caught error.
 * @param operation - Human-readable operation name for error messages.
 * @throws {QovaError} Always throws a typed error.
 */
export function handleContractError(error: unknown, operation: string): never {
	if (error instanceof QovaError) {
		throw error;
	}
	if (error instanceof ContractFunctionRevertedError && error.data) {
		throw mapContractError(
			error.data.errorName,
			error.data.args as readonly unknown[] | undefined,
		);
	}
	if (error instanceof Error) {
		if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
			throw new QovaError(`${operation}: RPC timeout`, "RPC_TIMEOUT", error);
		}
		if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
			throw new QovaError(`${operation}: Network error`, "NETWORK_ERROR", error);
		}
		if (error.message.includes("insufficient funds")) {
			throw new QovaError(`${operation}: Insufficient funds`, "INSUFFICIENT_FUNDS", error);
		}
	}
	throw new QovaError(`${operation}: Unknown error`, "UNKNOWN_ERROR", error);
}
