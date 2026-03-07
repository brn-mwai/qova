"use client";

import Link from "next/link";
import {
	ArrowRight,
	CheckCircle,
	Code,
	MagnifyingGlass,
	ShieldCheck,
	XCircle,
} from "@phosphor-icons/react";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { ScoreBadge } from "@/components/scores/score-badge";
import { StatusBadge } from "@/components/data/status-badge";
import { useConvexAvailable } from "@/components/providers/convex-provider";
import { PageHeader } from "@/components/shared/page-header";
import { getGrade } from "@/lib/constants";
function isValidAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

interface VerifyResult {
	agent: string;
	verified: boolean;
	score: number;
	grade: string;
	sanctionsClean: boolean;
	isRegistered: boolean;
	timestamp: string;
}

export default function VerifyPage(): React.ReactElement {
	const available = useConvexAvailable();
	const verifyAction = useAction(api.actions.chain.verifyAgent);
	const [address, setAddress] = useState("");
	const [result, setResult] = useState<VerifyResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleVerify(): Promise<void> {
		const trimmed = address.trim();
		setError(null);
		setResult(null);

		if (!trimmed) {
			setError("Please enter an agent address.");
			return;
		}

		if (!isValidAddress(trimmed)) {
			setError("Invalid address. Must start with 0x and be 42 characters.");
			return;
		}

		if (!available) {
			setError("Database not configured. Set NEXT_PUBLIC_CONVEX_URL to enable verification.");
			return;
		}

		setLoading(true);
		try {
			const res = await verifyAction({ agent: trimmed });
			setResult(res);
		} catch {
			setError("Verification failed. Please check the agent address and try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
			<PageHeader
				breadcrumb="Intelligence"
				title="Verify an Agent"
				subtitle="Check any AI agent's on-chain reputation score"
				info={{
					description: "Publicly verify any agent's trust score and registration status. Enter an address to check its score, grade, and sanctions status.",
					sections: [
						{ title: "Verify Agent", description: "Enter a wallet address to look up an agent's trust score and verification status." },
						{ title: "Score Badge", description: "Get a shareable badge you can embed in your website to display an agent's trust score." },
					],
				}}
			/>

			<div className="mx-auto max-w-2xl space-y-6">
				{/* Verify Input */}
				<div className="rounded-lg border bg-card p-6">
					<div className="mb-2 flex items-center gap-2">
						<ShieldCheck size={20} className="text-foreground" />
						<h1 className="font-heading text-lg font-semibold">Verify Agent</h1>
					</div>
					<p className="mb-6 text-sm text-muted-foreground">
						Check an agent's trust score, registration status, and sanctions screening in a single
						request.
					</p>

					<div className="flex gap-2">
						<div className="relative flex-1">
							<MagnifyingGlass
								size={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<input
								type="text"
								value={address}
								onChange={(e) => {
									setAddress(e.target.value);
									setError(null);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleVerify();
								}}
								placeholder="Enter agent address (0x...)"
								className="w-full rounded-md border bg-transparent py-2.5 pl-10 pr-4 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
							/>
						</div>
						<button
							type="button"
							onClick={handleVerify}
							disabled={loading || !address.trim()}
							className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? (
								<span className="inline-flex items-center gap-2">
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
									Verifying...
								</span>
							) : (
								"Verify Agent"
							)}
						</button>
					</div>

					{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				</div>

				{/* Loading State */}
				{loading && (
					<div className="rounded-lg border bg-card p-8">
						<div className="flex flex-col items-center gap-4">
							<div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
							<div className="h-5 w-48 animate-pulse rounded bg-muted" />
							<div className="h-4 w-32 animate-pulse rounded bg-muted" />
						</div>
					</div>
				)}

				{/* Result */}
				{result && !loading && (
					<div className="animate-fade-up rounded-lg border bg-card p-6">
						<div className="mb-6 flex flex-col items-center gap-3">
							{result.verified ? (
								<div className="rounded-full border-2 border-score-green-border bg-score-green-bg p-4">
									<CheckCircle size={32} weight="fill" className="text-score-green" />
								</div>
							) : (
								<div className="rounded-full border-2 border-score-red-border bg-score-red-bg p-4">
									<XCircle size={32} weight="fill" className="text-score-red" />
								</div>
							)}
							<span
								className={`font-heading text-lg font-semibold ${
									result.verified ? "text-score-green" : "text-score-red"
								}`}
							>
								{result.verified ? "Verified Agent" : "Not Verified"}
							</span>
						</div>

						<div className="space-y-3">
							<DetailRow label="Agent">
								<span className="font-mono text-xs">
									{result.agent.slice(0, 10)}...{result.agent.slice(-6)}
								</span>
							</DetailRow>
							<DetailRow label="Score">
								<div className="flex items-center gap-2">
									<ScoreBadge grade={result.grade || getGrade(result.score)} size="xs" />
									<span className="font-mono text-sm">{result.score}</span>
								</div>
							</DetailRow>
							<DetailRow label="Grade">
								<ScoreBadge
									grade={result.grade || getGrade(result.score)}
									size="sm"
									showScore
									score={result.score}
								/>
							</DetailRow>
							<DetailRow label="Sanctions Status">
								<StatusBadge status={result.sanctionsClean ? "verified" : "unverified"} />
							</DetailRow>
							<DetailRow label="Registration Status">
								<StatusBadge status={result.isRegistered ? "active" : "inactive"} />
							</DetailRow>
							<DetailRow label="Verified At">
								<span className="text-xs text-muted-foreground">
									{new Date(result.timestamp).toLocaleString()}
								</span>
							</DetailRow>
						</div>

						{/* Actions */}
						<div className="mt-6 flex flex-col gap-2 sm:flex-row">
							<Link
								href={`/verify/report/${result.agent}`}
								className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
							>
								<ArrowRight size={14} />
								View Full Report
							</Link>
							<button
								type="button"
								onClick={() => {
									const badgeUrl = `${window.location.origin}/api/badge/${result.agent}`
									navigator.clipboard.writeText(
										`![Qova Score](${badgeUrl})`
									)
								}}
								className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
							>
								<Code size={14} />
								Copy Badge Embed
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="flex items-center justify-between border-b py-2 last:border-b-0">
			<span className="text-sm text-muted-foreground">{label}</span>
			<div>{children}</div>
		</div>
	);
}
