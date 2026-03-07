/**
 * Qova contract ABIs for use with viem.
 *
 * All ABIs are exported as `const` assertions to enable
 * full type inference with viem's contract utilities.
 *
 * @example
 * ```ts
 * import { qovaCoreAbi } from "./abi";
 * import { getContract } from "viem";
 *
 * const contract = getContract({
 *   address: "0x...",
 *   abi: qovaCoreAbi,
 *   client,
 * });
 * ```
 */

export { budgetEnforcerAbi } from "./budget-enforcer.js";
export { qovaCoreAbi } from "./qova-core.js";
export { reputationConsumerAbi } from "./reputation-consumer.js";
export { reputationRegistryAbi } from "./reputation-registry.js";
export { transactionValidatorAbi } from "./transaction-validator.js";
export { verificationConsumerAbi } from "./verification-consumer.js";
