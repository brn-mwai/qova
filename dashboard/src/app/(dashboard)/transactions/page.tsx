"use client";

import { ArrowsLeftRight, ArrowSquareOut, Funnel, Plus, Receipt } from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { TxTypeBadge } from "@/components/data/tx-type-badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useFilteredAgentList, useFilteredRecentActivity, useChainCurrency } from "@/hooks/use-convex-data";
import { useConvexAvailable } from "@/components/providers/convex-provider";
import { useChainFilter } from "@/components/providers/chain-provider";
import { PageHeader } from "@/components/shared/page-header";
import { TX_TYPES } from "@/lib/constants";
import { getChain, getExplorerTxUrl, DEFAULT_CHAIN_ID } from "@/lib/chains";
import { getTokensForChain, isUsdPegged } from "@/lib/tokens";

function isValidAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isValidTxHash(hash: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

interface TxRow {
	agent: string;
	addressShort: string;
	totalTxCount: number;
	totalVolume: string;
	successRate: string;
	lastActivity: string;
}

function parseRate(rate: string): number {
	const match = rate.match(/([\d.]+)/);
	return match ? Number.parseFloat(match[1]) : 0;
}

function getRateColor(rate: number): string {
	if (rate >= 90) return "var(--score-green)";
	if (rate >= 70) return "var(--score-yellow)";
	return "var(--score-red)";
}

const txColumns: ColumnDef<TxRow>[] = [
	{
		accessorKey: "addressShort",
		header: "Agent",
		enableSorting: false,
		cell: ({ row }) => (
			<AddressDisplay address={row.original.agent} className="text-sm" />
		),
	},
	{
		accessorKey: "totalTxCount",
		header: "Transactions",
		cell: ({ row }) => (
			<span className="font-mono text-sm font-medium tabular-nums">{row.original.totalTxCount}</span>
		),
	},
	{
		accessorKey: "totalVolume",
		header: "Volume",
		enableSorting: false,
		cell: ({ row }) => {
			const vol = row.original.totalVolume;
			// Extract numeric and token parts (e.g., "42,180 USDC.e")
			const match = vol.match(/^([\d,.]+)\s+(.+)$/);
			if (match) {
				const num = match[1];
				const token = match[2];
				if (isUsdPegged(token)) {
					return (
						<span className="font-mono text-sm font-medium tabular-nums">
							<span className="text-muted-foreground">$</span>{num}
							<span className="ml-1 text-xs text-muted-foreground font-normal">{token}</span>
						</span>
					);
				}
				return (
					<span className="font-mono text-sm font-medium tabular-nums">
						{num} <span className="text-xs text-muted-foreground font-normal">{token}</span>
					</span>
				);
			}
			return <span className="font-mono text-sm font-medium tabular-nums">{vol}</span>;
		},
	},
	{
		id: "successRate",
		header: "Success Rate",
		enableSorting: false,
		cell: ({ row }) => {
			const rate = parseRate(row.original.successRate);
			const color = getRateColor(rate);
			return (
				<div className="flex items-center gap-2">
					<div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full transition-all"
							style={{ width: `${rate}%`, backgroundColor: color }}
						/>
					</div>
					<span className="font-mono text-xs tabular-nums" style={{ color }}>
						{row.original.successRate}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "lastActivity",
		header: "Last Activity",
		cell: ({ row }) => (
			<span className="text-xs text-muted-foreground">
				{new Date(row.original.lastActivity).getTime() > 0
					? new Date(row.original.lastActivity).toLocaleDateString()
					: "N/A"}
			</span>
		),
	},
];

export default function TransactionsPage(): React.ReactElement {
	const available = useConvexAvailable();
	const agents = useFilteredAgentList();
	const recentActivity = useFilteredRecentActivity(50);
	const logActivity = useMutation(api.mutations.activity.logActivity);
	const currency = useChainCurrency();
	const { selectedChainId } = useChainFilter();

	// Available tokens for the selected chain
	const chainId = selectedChainId !== 0 ? selectedChainId : DEFAULT_CHAIN_ID;
	const chainTokens = useMemo(() => getTokensForChain(chainId), [chainId]);

	// Form state
	const [agentAddr, setAgentAddr] = useState("");
	const [txHash, setTxHash] = useState("");
	const [amount, setAmount] = useState("");
	const [txCurrency, setTxCurrency] = useState(currency);
	const [txType, setTxType] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState(false);

	// Activity filter state
	const [activityTypeFilter, setActivityTypeFilter] = useState("all");

	const txStats: TxRow[] = useMemo(() => {
		return agents
			.filter((a) => (a.totalTxCount ?? 0) > 0)
			.map((a) => ({
				agent: a.address,
				addressShort: a.addressShort,
				totalTxCount: a.totalTxCount ?? 0,
				totalVolume: a.totalVolume ?? `0 ${currency}`,
				successRate: a.successRate ?? "0%",
				lastActivity: a.lastActivity ?? new Date().toISOString(),
			}));
	}, [agents, currency]);

	const filteredActivity = useMemo(() => {
		if (activityTypeFilter === "all") return recentActivity;
		return recentActivity.filter((tx) => tx.type === activityTypeFilter);
	}, [recentActivity, activityTypeFilter]);

	const activityTypes = useMemo(() => {
		const types = new Set<string>();
		for (const tx of recentActivity) {
			if (tx.type) types.add(tx.type);
		}
		return Array.from(types).sort();
	}, [recentActivity]);

	/** Resolve the explorer TX URL based on the agent's chain or selected chain. */
	function getTxExplorerUrl(txHashVal: string, agentAddr: string): string {
		const agent = agents.find((a) => a.address.toLowerCase() === agentAddr.toLowerCase());
		const chainId = agent?.chainId ?? selectedChainId;
		if (chainId && chainId !== 0) return getExplorerTxUrl(chainId, txHashVal);
		return getExplorerTxUrl(0, txHashVal);
	}

	async function handleSubmit(): Promise<void> {
		setFormError(null);
		setFormSuccess(false);

		const trimmedAgent = agentAddr.trim();
		const trimmedHash = txHash.trim();
		const trimmedAmount = amount.trim();

		if (!trimmedAgent) {
			setFormError("Agent address is required.");
			return;
		}
		if (!isValidAddress(trimmedAgent)) {
			setFormError("Invalid agent address. Must start with 0x and be 42 characters.");
			return;
		}
		if (!trimmedHash) {
			setFormError("Transaction hash is required.");
			return;
		}
		if (!isValidTxHash(trimmedHash)) {
			setFormError("Invalid transaction hash. Must start with 0x and be 66 characters.");
			return;
		}
		if (!trimmedAmount) {
			setFormError("Amount is required.");
			return;
		}
		const amountNum = Number.parseFloat(trimmedAmount);
		if (Number.isNaN(amountNum) || amountNum <= 0) {
			setFormError("Amount must be a positive number.");
			return;
		}

		if (!available) {
			setFormError("Database not configured. Set NEXT_PUBLIC_CONVEX_URL to enable writes.");
			return;
		}

		setSubmitting(true);
		try {
			const txTypeNames = ["Swap", "Transfer", "Stake", "Unstake", "Bridge", "Approve", "Mint", "Burn"];
			const typeName = txTypeNames[txType] ?? "Other";

			await logActivity({
				agent: trimmedAgent,
				type: typeName,
				description: `${typeName} of ${trimmedAmount} ${txCurrency}`,
				amount: `${trimmedAmount} ${txCurrency}`,
				txHash: trimmedHash,
			});

			setFormSuccess(true);
			setAgentAddr("");
			setTxHash("");
			setAmount("");
			setTxType(0);
		} catch {
			setFormError("Failed to record transaction.");
		} finally {
			setSubmitting(false);
		}
	}

	useEffect(() => {
		if (formSuccess) {
			const timer = setTimeout(() => setFormSuccess(false), 3000);
			return (): void => {
				clearTimeout(timer);
			};
		}
	}, [formSuccess]);

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
			<PageHeader
				breadcrumb="Operations"
				title="Transactions"
				subtitle="On-chain transaction records across your agents"
				info={{
					description: "Record and track on-chain transactions for your agents. Log transaction hashes and amounts, and monitor activity filtered by type.",
					sections: [
						{ title: "Record Transaction", description: "Log a new transaction with the agent's address, transaction hash, amount, and type." },
						{ title: "Transaction Stats", description: "See each agent's total transaction count, volume traded, and success rate." },
						{ title: "Recent Activity", description: "A filterable log of all transactions with agent, type, description, amount, and timestamp." },
					],
				}}
			/>

			{/* Record Transaction */}
			<div className="rounded-lg border bg-card p-5">
				<div className="mb-4 flex items-center gap-2">
					<Plus size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Record Transaction</h2>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label className="text-xs uppercase tracking-wider text-muted-foreground">
							Agent Address
						</Label>
						<Input
							value={agentAddr}
							onChange={(e) => {
								setAgentAddr(e.target.value);
								setFormError(null);
							}}
							placeholder="0x..."
							className="font-mono text-sm"
							aria-invalid={formError?.toLowerCase().includes("agent") ? true : undefined}
						/>
						{agents.length > 0 && !agentAddr && (
							<div className="flex flex-wrap gap-1.5">
								{agents.slice(0, 4).map((a) => (
									<button
										key={a.address}
										type="button"
										onClick={() => {
											setAgentAddr(a.address);
											setFormError(null);
										}}
										className="rounded-md border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
									>
										{a.addressShort}
									</button>
								))}
							</div>
						)}
					</div>
					<div className="space-y-2">
						<Label className="text-xs uppercase tracking-wider text-muted-foreground">
							Transaction Hash
						</Label>
						<Input
							value={txHash}
							onChange={(e) => {
								setTxHash(e.target.value);
								setFormError(null);
							}}
							placeholder="0x..."
							className="font-mono text-sm"
							aria-invalid={formError?.toLowerCase().includes("hash") ? true : undefined}
						/>
					</div>
					<div className="space-y-2">
						<Label className="text-xs uppercase tracking-wider text-muted-foreground">
							Amount
						</Label>
						<div className="flex gap-2">
							<Input
								value={amount}
								onChange={(e) => {
									setAmount(e.target.value);
									setFormError(null);
								}}
								placeholder="0.0"
								className="font-mono text-sm flex-1"
								aria-invalid={formError?.toLowerCase().includes("amount") ? true : undefined}
							/>
							<Select
								value={txCurrency}
								onValueChange={setTxCurrency}
							>
								<SelectTrigger className="w-[120px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{chainTokens.map((t) => (
										<SelectItem key={t.symbol} value={t.symbol}>
											{t.symbol}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="space-y-2">
						<Label className="text-xs uppercase tracking-wider text-muted-foreground">
							Transaction Type
						</Label>
						<Select
							value={String(txType)}
							onValueChange={(val) => setTxType(Number(val))}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TX_TYPES.map((t) => (
									<SelectItem key={t.value} value={String(t.value)}>
										{t.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
				{formSuccess && (
					<p className="mt-3 text-sm text-score-green">Transaction recorded successfully.</p>
				)}

				<div className="mt-4">
					<Button
						onClick={handleSubmit}
						disabled={submitting}
					>
						{submitting ? "Submitting..." : "Record"}
					</Button>
				</div>
			</div>

			{/* Agent Transaction Stats */}
			<div className="rounded-lg border bg-card p-5">
				<div className="mb-4 flex items-center gap-2">
					<Receipt size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Agent Transaction Stats</h2>
				</div>

				<DataTable<TxRow, unknown>
					columns={txColumns}
					data={txStats}
					pageSize={10}
					searchable
					searchPlaceholder="Search agents..."
					getRowHref={(row) => `/agents/${row.agent}`}
					showPageSizeSelector
					emptyState={
						<EmptyState
							icon={<ArrowsLeftRight size={40} />}
							title="No transaction data"
							description="Record a transaction above to start tracking agent activity."
						/>
					}
				/>
			</div>

			{/* Recent Activity */}
			{recentActivity.length > 0 && (
				<div className="rounded-lg border bg-card p-5">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-sm font-medium text-foreground">
							Recent Activity
							<span className="ml-2 text-xs text-muted-foreground font-normal">
								{filteredActivity.length} of {recentActivity.length}
							</span>
						</h2>
						{activityTypes.length > 1 && (
							<div className="flex items-center gap-2">
								<Funnel size={14} className="text-muted-foreground" />
								<Select
									value={activityTypeFilter}
									onValueChange={setActivityTypeFilter}
								>
									<SelectTrigger className="h-7 w-28 text-xs" size="sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All types</SelectItem>
										{activityTypes.map((type) => (
											<SelectItem key={type} value={type}>
												{type}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</div>
					<div className="overflow-hidden rounded-lg border">
						<TooltipProvider delayDuration={200}>
						<Table>
							<TableHeader>
								<TableRow className="bg-muted hover:bg-muted">
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Agent</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredActivity.length > 0 ? (
									filteredActivity.map((tx) => (
										<TableRow key={tx._id} className="group">
											<TableCell className="px-4 py-3">
												<AddressDisplay address={tx.agent} className="text-xs" />
											</TableCell>
											<TableCell className="px-4 py-3">
												<TxTypeBadge type={tx.type} />
											</TableCell>
											<TableCell className="px-4 py-3 max-w-[200px]">
												<span className="truncate block text-xs text-muted-foreground">
													{tx.description}
												</span>
											</TableCell>
											<TableCell className="px-4 py-3 text-right">
												{tx.amount && (() => {
													const m = tx.amount.match(/^([\d,.]+)\s+(.+)$/);
													if (m) {
														const token = m[2];
														return (
															<span className="font-mono text-xs font-medium tabular-nums">
																{isUsdPegged(token) && <span className="text-muted-foreground">$</span>}
																{m[1]}
																<span className="ml-1 text-muted-foreground font-normal">{token}</span>
															</span>
														);
													}
													return <span className="font-mono text-xs font-medium tabular-nums">{tx.amount}</span>;
												})()}
											</TableCell>
											<TableCell className="px-4 py-3 text-right">
												<div className="flex items-center justify-end gap-1.5">
													<Tooltip>
														<TooltipTrigger asChild>
															<span className="text-xs text-muted-foreground cursor-default">
																{timeAgo(tx.timestamp)}
															</span>
														</TooltipTrigger>
														<TooltipContent side="left" className="font-mono text-xs">
															{new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
														</TooltipContent>
													</Tooltip>
													{tx.txHash && (
														<a
															href={getTxExplorerUrl(tx.txHash, tx.agent)}
															target="_blank"
															rel="noopener noreferrer"
															className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
														>
															<ArrowSquareOut size={12} />
														</a>
													)}
												</div>
											</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
											No transactions matching filter
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
						</TooltipProvider>
					</div>
				</div>
			)}
		</div>
	);
}
