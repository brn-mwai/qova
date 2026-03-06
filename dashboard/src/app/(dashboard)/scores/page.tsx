"use client";

import { ChartBar, MagnifyingGlass, Trophy } from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";
import { ScoreDistribution } from "@/components/charts/score-distribution";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ScoreBadge } from "@/components/scores/score-badge";
import { ScoreRing } from "@/components/scores/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useAgentByAddress, useFilteredLeaderboard, useScoreHistory } from "@/hooks/use-convex-data";

function isValidAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function ScoreLookupPanel({ address }: { address: string }): React.ReactElement {
	const agent = useAgentByAddress(address);
	const scoreHistory = useScoreHistory(address, 10);

	if (!agent) {
		return (
			<div className="flex flex-col gap-6 md:flex-row md:items-start">
				<div className="h-40 w-40 animate-pulse rounded-full bg-muted" />
				<div className="flex-1 space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-8 animate-pulse rounded bg-muted" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
			<ScoreRing score={agent.score} grade={agent.grade} size={160} />
			<div className="flex-1 space-y-4">
				<div className="flex items-center gap-3">
					<ScoreBadge grade={agent.grade} score={agent.score} showScore size="lg" />
					<span className="font-mono text-sm text-muted-foreground">{agent.addressShort}</span>
				</div>
				<div className="space-y-1">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Score</span>
						<span className="font-mono">{agent.score}/1000</span>
					</div>
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full transition-all duration-700 ease-out"
							style={{
								width: `${agent.scorePercentage}%`,
								backgroundColor: agent.gradeColor,
							}}
						/>
					</div>
				</div>
				{scoreHistory.length > 0 && (
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Recent History</p>
						{scoreHistory.slice(0, 5).map((s) => (
							<div key={s._id} className="flex items-center justify-between text-xs">
								<span className="font-mono">{s.score}</span>
								<ScoreBadge grade={s.grade} size="xs" />
								<span className="text-muted-foreground">
									{new Date(s.timestamp).toLocaleDateString()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

interface LeaderboardRow {
	rank: number;
	address: string;
	addressShort: string;
	score: number;
	grade: string;
	scorePercentage: number;
	gradeColor: string;
}

const leaderboardColumns: ColumnDef<LeaderboardRow>[] = [
	{
		accessorKey: "rank",
		header: "Rank",
		cell: ({ row }) => (
			<span className="font-mono text-xs font-bold text-muted-foreground">#{row.original.rank}</span>
		),
	},
	{
		accessorKey: "addressShort",
		header: "Agent",
		enableSorting: false,
		cell: ({ row }) => (
			<Link
				href={`/agents/${row.original.address}`}
				className="font-mono text-sm hover:underline"
			>
				{row.original.addressShort}
			</Link>
		),
	},
	{
		accessorKey: "score",
		header: "Score",
		cell: ({ row }) => (
			<div className="flex items-center gap-3">
				<span className="font-mono text-sm tabular-nums w-10">{row.original.score}</span>
				<div className="hidden sm:block h-1.5 w-20 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full transition-all"
						style={{
							width: `${row.original.scorePercentage}%`,
							backgroundColor: row.original.gradeColor,
						}}
					/>
				</div>
			</div>
		),
	},
	{
		accessorKey: "grade",
		header: "Grade",
		enableSorting: false,
		cell: ({ row }) => <ScoreBadge grade={row.original.grade} size="xs" />,
	},
];

export default function ScoresPage(): React.ReactElement {
	const leaderboard = useFilteredLeaderboard(50);
	const [lookupAddress, setLookupAddress] = useState("");
	const [activeAddress, setActiveAddress] = useState("");
	const [addressError, setAddressError] = useState<string | null>(null);

	function handleCompute(): void {
		const trimmed = lookupAddress.trim();
		setAddressError(null);

		if (!trimmed) {
			setAddressError("Please enter an agent address.");
			return;
		}

		if (!isValidAddress(trimmed)) {
			setAddressError("Invalid address. Must start with 0x and be 42 characters.");
			return;
		}

		setActiveAddress(trimmed);
	}

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
			<PageHeader
				breadcrumb="Intelligence"
				title="Score Analytics"
				subtitle="Distribution, trends, and leaderboard of agent reputation scores"
			/>

			{/* Score Distribution Chart */}
			<ScoreDistribution />

			{/* Compute Score */}
			<div className="rounded-lg border bg-card p-5">
				<div className="mb-4 flex items-center gap-2">
					<ChartBar size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Score Lookup</h2>
				</div>

				<div className="flex gap-2">
					<div className="relative flex-1">
						<MagnifyingGlass
							size={16}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							type="text"
							value={lookupAddress}
							onChange={(e) => {
								setLookupAddress(e.target.value);
								setAddressError(null);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCompute();
							}}
							placeholder="Enter agent address (0x...)"
							className="w-full rounded-md border bg-transparent py-2 pl-10 pr-4 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
						/>
					</div>
					<Button onClick={handleCompute}>
						Look Up
					</Button>
				</div>

				{addressError && <p className="mt-2 text-sm text-destructive">{addressError}</p>}

				{activeAddress && !addressError && (
					<div className="mt-6">
						<ScoreLookupPanel address={activeAddress} />
					</div>
				)}
			</div>

			{/* Leaderboard */}
			<div className="rounded-lg border bg-card p-5">
				<div className="mb-4 flex items-center gap-2">
					<Trophy size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Leaderboard</h2>
				</div>

				<DataTable<LeaderboardRow, unknown>
					columns={leaderboardColumns}
					data={leaderboard}
					pageSize={10}
					searchable
					searchPlaceholder="Search leaderboard..."
					getRowHref={(row) => `/agents/${row.address}`}
					showPageSizeSelector
					emptyState={
						<EmptyState
							icon={<Trophy size={40} />}
							title="No agents found"
							description="No registered agents to display in the leaderboard."
						/>
					}
				/>
			</div>
		</div>
	);
}
