/**
 * Client configuration types.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address, WalletClient } from "viem";
import { z } from "zod";

/** Supported chain identifiers. */
export const ChainSchema = z.enum(["base-sepolia", "base", "skale-base"]);
export type Chain = z.infer<typeof ChainSchema>;

/** Zod schema for the addresses of all deployed Qova contracts. */
export const ContractAddressesSchema = z.object({
	ReputationRegistry: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
	TransactionValidator: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
	BudgetEnforcer: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
	QovaCore: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<Address>,
});

export type ContractAddresses = z.infer<typeof ContractAddressesSchema>;

/** Zod schema for QovaClient configuration. walletClient cannot be validated by Zod. */
export const QovaClientConfigSchema = z.object({
	chain: ChainSchema,
	rpcUrl: z.string().url().optional(),
	contracts: ContractAddressesSchema.partial().optional(),
});

/** Full configuration for creating a QovaClient. */
export type QovaClientConfig = z.infer<typeof QovaClientConfigSchema> & {
	/** Required for write operations (registerAgent, updateScore, etc.). */
	walletClient?: WalletClient;
};
