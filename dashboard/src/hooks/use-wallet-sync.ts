"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useWalletStatus } from "./use-wallet-status";

/**
 * Syncs the connected wallet address to the Convex user record.
 * Call this once in the dashboard layout so it fires on every
 * wallet connect/disconnect event.
 *
 * Uses a "tried" ref to ensure we only attempt once per address,
 * preventing infinite retry loops when auth is unavailable.
 */
export function useWalletSync(): void {
	const { address, isConnected } = useWalletStatus();
	const linkWallet = useMutation(api.mutations.users.linkWallet);
	const lastSynced = useRef<string | undefined>(undefined);
	const tried = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (!isConnected || !address) return;
		if (address === lastSynced.current) return;
		if (address === tried.current) return;

		tried.current = address;
		linkWallet({ walletAddress: address })
			.then(() => {
				lastSynced.current = address;
			})
			.catch(() => {
				// Auth may not be available. Don't retry.
			});
	}, [address, isConnected, linkWallet]);
}
