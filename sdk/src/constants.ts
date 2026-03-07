/**
 * @brnmwai/qova-core - Contract addresses, chain configuration, and protocol constants.
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Address } from "viem";
import type { ContractAddresses } from "./types/config.js";

/** Supported chain IDs */
export const CHAIN_IDS = {
	BASE_SEPOLIA: 84532,
	BASE_MAINNET: 8453,
	SKALE_BASE: 1187947933,
} as const;

/** Deployed contract addresses per network */
export const CONTRACTS: Record<number, ContractAddresses> = {
	[CHAIN_IDS.BASE_SEPOLIA]: {
		ReputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB" as Address,
		TransactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900" as Address,
		BudgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E" as Address,
		QovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a" as Address,
	},
};

/** Default chain for development */
export const DEFAULT_CHAIN_ID = CHAIN_IDS.BASE_SEPOLIA;

/**
 * Get contract addresses for a given chain ID.
 * @param chainId - The chain ID to look up.
 * @returns Contract addresses for the chain.
 * @throws If no contracts are deployed on the given chain.
 */
export function getContracts(chainId: number): ContractAddresses {
	const contracts = CONTRACTS[chainId];
	if (!contracts) {
		throw new Error(`No contracts deployed on chain ${chainId}`);
	}
	return contracts;
}

/** Block explorer URLs per chain */
export const BLOCK_EXPLORERS: Record<number, string> = {
	[CHAIN_IDS.BASE_SEPOLIA]: "https://sepolia.basescan.org",
	[CHAIN_IDS.BASE_MAINNET]: "https://basescan.org",
	[CHAIN_IDS.SKALE_BASE]: "https://skale-base-explorer.skalenodes.com",
};

/** Default RPC URLs per chain */
export const DEFAULT_RPC_URLS: Record<number, string> = {
	[CHAIN_IDS.BASE_SEPOLIA]: "https://sepolia.base.org",
	[CHAIN_IDS.BASE_MAINNET]: "https://mainnet.base.org",
	[CHAIN_IDS.SKALE_BASE]: "https://skale-base.skalenodes.com/v1/base",
};

/** Minimum possible reputation score. */
export const MIN_SCORE = 0;

/** Maximum possible reputation score. */
export const MAX_SCORE = 1000;

/** Score grade thresholds: minimum score required for each grade. */
export const SCORE_GRADE_THRESHOLDS = {
	AAA: 950,
	AA: 900,
	A: 850,
	BBB: 750,
	BB: 650,
	B: 550,
	CCC: 450,
	CC: 350,
	C: 250,
	D: 0,
} as const;

/** Chain ID to viem chain name mapping for internal use. */
export const CHAIN_ID_MAP: Record<number, "base-sepolia" | "base" | "skale-base"> = {
	[CHAIN_IDS.BASE_SEPOLIA]: "base-sepolia",
	[CHAIN_IDS.BASE_MAINNET]: "base",
	[CHAIN_IDS.SKALE_BASE]: "skale-base",
};
