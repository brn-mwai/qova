"use client";

import {
	ArrowSquareOut,
	Plus,
	Robot,
	TrendUp,
	TrendDown,
} from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ScoreBadge } from "@/components/scores/score-badge";
import { StatusBadge } from "@/components/data/status-badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RegisterAgentDialog } from "@/components/register-agent-dialog";
import { useFilteredAgentList } from "@/hooks/use-convex-data";
import { getScoreColor } from "@/lib/constants";

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Agent row type                                                     */
/* ------------------------------------------------------------------ */

interface AgentRow {
	address: string;
	addressShort: string;
	name?: string;
	score: number;
	grade: string;
	isRegistered: boolean;
	updateCount: number;
	lastUpdated: string;
	explorerUrl: string;
	chainId?: number;
	budgetCurrency?: string;
	totalTxCount?: number;
	successRate?: string;
	previousScore?: number;
}

/* ------------------------------------------------------------------ */
/*  Column Definitions                                                 */
/* ------------------------------------------------------------------ */

const columns: ColumnDef<AgentRow>[] = [
	{
		accessorKey: "addressShort",
		header: "Agent",
		enableSorting: false,
		cell: ({ row }) => (
			<div className="flex flex-col gap-0.5">
				{row.original.name && (
					<Link href={`/agents/${row.original.address}`} className="text-sm font-medium hover:underline">
						{row.original.name}
					</Link>
				)}
				<AddressDisplay address={row.original.address} className="text-xs" />
			</div>
		),
	},
	{
		accessorKey: "score",
		header: "Score",
		cell: ({ row }) => {
			const { score, previousScore } = row.original;
			const delta = previousScore !== undefined ? score - previousScore : 0;
			return (
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<span className="font-mono text-sm font-medium tabular-nums">{score}</span>
						{delta !== 0 && (
							<span className={`inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums ${delta > 0 ? "text-score-green" : "text-score-red"}`}>
								{delta > 0 ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
								{delta > 0 ? `+${delta}` : delta}
							</span>
						)}
					</div>
					<div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full transition-all"
							style={{
								width: `${score / 10}%`,
								backgroundColor: getScoreColor(score),
							}}
						/>
					</div>
				</div>
			);
		},
	},
	{
		accessorKey: "grade",
		header: "Grade",
		enableSorting: false,
		cell: ({ row }) => <ScoreBadge grade={row.original.grade} size="xs" />,
	},
	{
		id: "status",
		header: "Status",
		enableSorting: false,
		cell: ({ row }) => (
			<StatusBadge status={row.original.isRegistered ? "active" : "pending"} />
		),
	},
	{
		id: "activity",
		header: "Activity",
		cell: ({ row }) => {
			const txCount = row.original.totalTxCount ?? 0;
			const rate = row.original.successRate ?? "0%";
			return (
				<div className="flex flex-col gap-0.5">
					<span className="font-mono text-xs tabular-nums">{txCount} txns</span>
					{txCount > 0 && (
						<span className="text-[10px] text-muted-foreground">{rate} success</span>
					)}
				</div>
			);
		},
	},
	{
		accessorKey: "lastUpdated",
		header: "Last Updated",
		cell: ({ row }) => (
			<span className="text-xs text-muted-foreground">{timeAgo(row.original.lastUpdated)}</span>
		),
	},
	{
		id: "explorer",
		header: () => <span className="sr-only">Explorer</span>,
		enableSorting: false,
		cell: ({ row }) => (
			<a
				href={row.original.explorerUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex text-muted-foreground hover:text-foreground transition-colors"
				onClick={(e) => e.stopPropagation()}
			>
				<ArrowSquareOut size={14} />
			</a>
		),
	},
];

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function AgentsPage(): React.ReactElement {
	const agents = useFilteredAgentList();
	const [registerOpen, setRegisterOpen] = useState(false);

	// Listen for command palette "Register New Agent" event
	useEffect(() => {
		function handler(): void {
			setRegisterOpen(true);
		}
		window.addEventListener("qova:register-agent", handler);
		return (): void => {
			window.removeEventListener("qova:register-agent", handler);
		};
	}, []);

	const rows: AgentRow[] = useMemo(() => {
		return agents.map((a) => ({
			address: a.address,
			addressShort: a.addressShort,
			name: a.name,
			score: a.score,
			grade: a.grade,
			isRegistered: a.isRegistered,
			updateCount: a.updateCount,
			lastUpdated: a.lastUpdated,
			explorerUrl: a.explorerUrl,
			chainId: a.chainId,
			budgetCurrency: a.budgetCurrency,
			totalTxCount: a.totalTxCount,
			successRate: a.successRate,
			previousScore: a.previousScore,
		}));
	}, [agents]);

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<PageHeader
					breadcrumb="Operations"
					title="Agents"
					subtitle="All AI agents registered on the Qova protocol"
					info={{
						description: "View and manage all your registered agents. Each agent is identified by its wallet address and tracked for trust scoring.",
						sections: [
							{ title: "Agent Table", description: "A sortable list of your agents showing their address, trust score, grade, transaction count, success rate, and when they were last active." },
						],
					}}
				/>
				<RegisterAgentDialog
					open={registerOpen}
					onOpenChange={setRegisterOpen}
				>
					<Button>
						<Plus size={14} weight="bold" />
						Register Agent
					</Button>
				</RegisterAgentDialog>
			</div>

			{/* Table */}
			<DataTable<AgentRow, unknown>
				columns={columns}
				data={rows}
				pageSize={10}
				searchable
				searchPlaceholder="Search by address or grade..."
				getRowHref={(row) => `/agents/${row.address}`}
				showPageSizeSelector
				showColumnToggle
				emptyState={
					<EmptyState
						icon={<Robot size={40} />}
						title="No agents registered"
						description="Register your first agent to get started with trust scoring."
						action={{
							label: "Register Agent",
							onClick: () => setRegisterOpen(true),
						}}
					/>
				}
			/>
		</div>
	);
}
