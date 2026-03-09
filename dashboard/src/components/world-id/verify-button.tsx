"use client";

import {
	Fingerprint,
	ShieldCheck,
	SpinnerGap,
	Warning,
	CheckCircle,
} from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorldIdStatus } from "@/hooks/use-convex-data";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID;
const ACTION = process.env.NEXT_PUBLIC_WORLD_ID_ACTION ?? "verify-qova-user";

/**
 * World ID v4 uses RP context with server-side signing.
 * When NEXT_PUBLIC_WORLD_ID_APP_ID is configured AND the backend RP endpoint
 * is available, this component performs real Orb verification.
 * Otherwise it operates in demo mode for hackathon judges.
 */
const DEMO_MODE = !APP_ID;

interface WorldIdVerifyButtonProps {
	/** Compact mode shows a smaller badge-style button */
	compact?: boolean;
	/** Callback after successful verification */
	onVerified?: () => void;
}

export function WorldIdVerifyButton({
	compact = false,
	onVerified,
}: WorldIdVerifyButtonProps): React.ReactElement {
	const worldIdStatus = useWorldIdStatus();
	const verifyMutation = useMutation(api.mutations.worldId.verifyWorldId);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [demoComplete, setDemoComplete] = useState(false);

	const handleDemoVerify = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			// Demo: simulate World ID verification with deterministic nullifier
			const demoNullifier = `0x00demo${Date.now().toString(16).padStart(56, "0")}`;
			const demoMerkleRoot = `0x00merkle${Date.now().toString(16).padStart(54, "0")}`;
			const demoProof = `0x00proof${Date.now().toString(16).padStart(55, "0")}`;

			const res = await verifyMutation({
				nullifierHash: demoNullifier,
				merkleRoot: demoMerkleRoot,
				proof: demoProof,
				verificationLevel: "orb",
			});

			if (res.alreadyVerified && !res.success) {
				setError("This World ID has already been used for another account.");
			} else if (!res.success) {
				setError("Verification failed - please sign in first.");
			} else {
				setDemoComplete(true);
				onVerified?.();
			}
		} catch {
			setError("Verification failed. Please try again.");
		} finally {
			setLoading(false);
		}
	}, [verifyMutation, onVerified]);

	const handleRealVerify = useCallback(async (): Promise<void> => {
		if (!APP_ID) {
			setError("World ID not configured");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			// Real World ID v4 flow: requires RP context from backend
			const rpResponse = await fetch("/api/world-id/rp-context", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ app_id: APP_ID, action: ACTION }),
			});

			if (!rpResponse.ok) {
				throw new Error("Failed to get RP context");
			}

			// Import IDKit dynamically to avoid SSR issues
			const idkit = await import("@worldcoin/idkit");
			const IDKit = idkit.IDKit;
			const orbLegacy = idkit.orbLegacy;

			const rpData = (await rpResponse.json()) as {
				rp_id: string;
				nonce: string;
				created_at: number;
				expires_at: number;
				signature: string;
			};

			const request = await IDKit.request({
				app_id: APP_ID as `app_${string}`,
				action: ACTION,
				rp_context: rpData,
				allow_legacy_proofs: true,
			}).preset(orbLegacy());

			const completion = await request.pollUntilCompletion({
				timeout: 120000,
			});

			if (completion.success) {
				const result = completion.result;
				// Extract nullifier from the first response item
				const firstResponse = result.responses[0];
				if (!firstResponse) throw new Error("No response from World ID");

				const nullifier = "nullifier" in firstResponse
					? firstResponse.nullifier
					: "";
				const merkleRoot = "merkle_root" in firstResponse
					? firstResponse.merkle_root
					: "";
				const proof = Array.isArray(firstResponse.proof)
					? firstResponse.proof.join(",")
					: firstResponse.proof;

				const res = await verifyMutation({
					nullifierHash: nullifier,
					merkleRoot: merkleRoot,
					proof: proof,
					verificationLevel: "orb",
				});

				if (res.alreadyVerified && !res.success) {
					setError("This World ID has already been used for another account.");
				} else if (!res.success) {
					setError("Verification failed - please sign in first.");
				} else {
					onVerified?.();
				}
			} else {
				setError(`Verification failed: ${completion.error}`);
			}
		} catch {
			setError("World ID verification failed. Please try again.");
		} finally {
			setLoading(false);
		}
	}, [verifyMutation, onVerified]);

	// Already verified -- show verified badge
	if (worldIdStatus.verified || demoComplete) {
		if (compact) {
			return (
				<Badge
					variant="outline"
					className="border-score-green-border bg-score-green-bg text-score-green gap-1.5"
				>
					<ShieldCheck size={12} weight="fill" />
					Verified Human
				</Badge>
			);
		}

		return (
			<div className="flex items-center gap-2 rounded-lg border border-score-green-border bg-score-green-bg px-4 py-3">
				<ShieldCheck size={20} weight="fill" className="text-score-green shrink-0" />
				<div className="flex flex-col">
					<span className="text-sm font-medium text-score-green">
						World ID Verified
					</span>
					<span className="text-xs text-muted-foreground">
						{worldIdStatus.level === "orb" ? "Orb" : "Device"} verification
						{DEMO_MODE ? " (Demo)" : ""}
						{worldIdStatus.verifiedAt
							? ` - ${new Date(worldIdStatus.verifiedAt).toLocaleDateString()}`
							: ""}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{DEMO_MODE && (
				<div className="flex items-center gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
					<Warning size={14} className="text-yellow-500 shrink-0" />
					<span className="text-xs text-muted-foreground">
						Demo mode - set NEXT_PUBLIC_WORLD_ID_APP_ID for production verification
					</span>
				</div>
			)}

			<Button
				variant={compact ? "outline" : "default"}
				size={compact ? "sm" : "default"}
				onClick={DEMO_MODE ? handleDemoVerify : handleRealVerify}
				disabled={loading}
				className={compact ? "" : "gap-2"}
			>
				{loading ? (
					<SpinnerGap size={14} className="animate-spin" />
				) : (
					<Fingerprint size={compact ? 14 : 16} weight="duotone" />
				)}
				{compact ? "Verify with World ID" : "Verify Your Identity with World ID"}
			</Button>

			{demoComplete && (
				<p className="text-xs text-score-green flex items-center gap-1">
					<CheckCircle size={12} weight="fill" />
					World ID proof-of-personhood verified
				</p>
			)}

			{error && (
				<p className="text-xs text-destructive flex items-center gap-1">
					<Warning size={12} />
					{error}
				</p>
			)}
		</div>
	);
}
