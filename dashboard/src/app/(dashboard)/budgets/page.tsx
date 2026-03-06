"use client";

import { CurrencyEth, Gauge, SpinnerGap, Wallet } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { BudgetUsage } from "@/components/charts/budget-usage";
import { EmptyState } from "@/components/data/empty-state";
import { AddressDisplay } from "@/components/shared/address-display";
import { ScoreBadge } from "@/components/scores/score-badge";
import { useFilteredAgentList, useChainCurrency } from "@/hooks/use-convex-data";
import { PageHeader } from "@/components/shared/page-header";
import type { PageInfo } from "@/components/shared/page-header";
import { useConvexAvailable } from "@/components/providers/convex-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isValidAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export default function BudgetsPage(): React.ReactElement {
	const available = useConvexAvailable();
	const agents = useFilteredAgentList();
	const upsertAgent = useMutation(api.mutations.agents.upsertAgent);
	const currency = useChainCurrency();

	// Form state
	const [agentAddr, setAgentAddr] = useState("");
	const [dailyLimit, setDailyLimit] = useState("");
	const [monthlyLimit, setMonthlyLimit] = useState("");
	const [perTxLimit, setPerTxLimit] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState(false);

	function validateAmount(value: string, label: string): string | null {
		if (!value.trim()) return `${label} is required.`;
		const num = Number.parseFloat(value);
		if (Number.isNaN(num) || num <= 0) return `${label} must be a positive number.`;
		return null;
	}

	async function handleSubmit(): Promise<void> {
		setFormError(null);
		setFormSuccess(false);

		const trimmedAddr = agentAddr.trim();

		if (!trimmedAddr) {
			setFormError("Agent address is required.");
			return;
		}
		if (!isValidAddress(trimmedAddr)) {
			setFormError("Invalid agent address. Must start with 0x and be 42 characters.");
			return;
		}

		const dailyErr = validateAmount(dailyLimit, "Daily limit");
		if (dailyErr) {
			setFormError(dailyErr);
			return;
		}

		const monthlyErr = validateAmount(monthlyLimit, "Monthly limit");
		if (monthlyErr) {
			setFormError(monthlyErr);
			return;
		}

		const perTxErr = validateAmount(perTxLimit, "Per-transaction limit");
		if (perTxErr) {
			setFormError(perTxErr);
			return;
		}

		if (!available) {
			setFormError("Database not configured. Set NEXT_PUBLIC_CONVEX_URL to enable writes.");
			return;
		}

		setSubmitting(true);
		try {
			const existing = agents.find(
				(a) => a.address.toLowerCase() === trimmedAddr.toLowerCase(),
			);

			await upsertAgent({
				address: trimmedAddr,
				score: existing?.score ?? 0,
				dailyLimit: `${dailyLimit.trim()} ${currency}`,
				monthlyLimit: `${monthlyLimit.trim()} ${currency}`,
				perTxLimit: `${perTxLimit.trim()} ${currency}`,
			});

			setFormSuccess(true);
			setAgentAddr("");
			setDailyLimit("");
			setMonthlyLimit("");
			setPerTxLimit("");
		} catch {
			setFormError("Failed to set budget.");
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

	const agentsWithBudgets = agents.filter(
		(a) => a.dailyLimit || a.monthlyLimit,
	);

	const pageInfo: PageInfo = {
		description: "Set and monitor spending limits for your agents. Define daily, monthly, and per-transaction caps to keep your agents within budget and improve their compliance scores.",
		sections: [
			{ title: "Set Budget", description: "Enter an agent's wallet address and set maximum spending amounts per day, per month, and per transaction." },
			{ title: "Budget Overview", description: "See each agent's spending progress at a glance. Green means healthy, yellow means approaching the limit, red means near or over the limit." },
		],
	};

	return (
		<div className="flex flex-col gap-6 py-4 md:py-6 px-4 lg:px-6">
			<PageHeader
				breadcrumb="Operations"
				title="Budgets"
				subtitle="Spending limits and utilization for your agents"
				info={pageInfo}
			/>

			{/* Set Budget */}
			<Card className="py-0">
				<CardHeader className="pb-0 pt-5">
					<CardTitle className="flex items-center gap-2 text-sm">
						<Gauge size={18} className="text-foreground" />
						Set Budget
					</CardTitle>
				</CardHeader>
				<CardContent className="pb-5">
					<div className="grid gap-4">
						<div className="space-y-1.5">
							<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Agent Address
							</label>
							<Input
								type="text"
								value={agentAddr}
								onChange={(e) => {
									setAgentAddr(e.target.value);
									setFormError(null);
								}}
								placeholder="0x..."
								className="font-mono text-sm"
							/>
							<p className="text-[11px] text-muted-foreground">
								The 0x wallet address of the agent you want to budget.
							</p>
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-1.5">
								<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Daily Limit ({currency})
								</label>
								<div className="relative">
									<CurrencyEth
										size={16}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										type="text"
										value={dailyLimit}
										onChange={(e) => {
											setDailyLimit(e.target.value);
											setFormError(null);
										}}
										placeholder="10.0"
										className="pl-9 font-mono text-sm"
									/>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Maximum {currency} this agent can spend per day.
								</p>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Monthly Limit ({currency})
								</label>
								<div className="relative">
									<CurrencyEth
										size={16}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										type="text"
										value={monthlyLimit}
										onChange={(e) => {
											setMonthlyLimit(e.target.value);
											setFormError(null);
										}}
										placeholder="100.0"
										className="pl-9 font-mono text-sm"
									/>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Maximum {currency} this agent can spend per month.
								</p>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Per-Transaction Limit ({currency})
								</label>
								<div className="relative">
									<CurrencyEth
										size={16}
										className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
									/>
									<Input
										type="text"
										value={perTxLimit}
										onChange={(e) => {
											setPerTxLimit(e.target.value);
											setFormError(null);
										}}
										placeholder="5.0"
										className="pl-9 font-mono text-sm"
									/>
								</div>
								<p className="text-[11px] text-muted-foreground">
									Maximum {currency} allowed in a single transaction.
								</p>
							</div>
						</div>
					</div>

					{formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
					{formSuccess && (
						<p className="mt-3 text-sm text-score-green">Budget updated successfully.</p>
					)}

					<div className="mt-4">
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={submitting}
						>
							{submitting ? (
								<>
									<SpinnerGap size={16} className="animate-spin" />
									Submitting...
								</>
							) : (
								"Set Budget"
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Agent Budget Overview */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<Wallet size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Agent Budget Overview</h2>
				</div>

				{agentsWithBudgets.length === 0 ? (
					<EmptyState
						icon={<Wallet size={40} />}
						title="No budgets configured"
						description="Set a budget for an agent above to start tracking utilization."
					/>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{agentsWithBudgets.map((agent) => {
							function parseVal(val: string | undefined): number {
								if (!val) return 0;
								const match = val.match(/([\d.]+)/);
								return match ? Number.parseFloat(match[1]) : 0;
							}

							const dLim = parseVal(agent.dailyLimit);
							const dSpent = parseVal(agent.dailySpent);
							const mLim = parseVal(agent.monthlyLimit);
							const mSpent = parseVal(agent.monthlySpent);
							const dailyPct = dLim > 0 ? (dSpent / dLim) * 100 : 0;
							const monthlyPct = mLim > 0 ? (mSpent / mLim) * 100 : 0;

							return (
								<Card key={agent.address} className="py-0">
									<CardContent className="p-4">
										<div className="mb-3 flex items-center justify-between">
											<div className="flex flex-col gap-0.5">
												{agent.name && (
													<Link href={`/agents/${agent.address}`} className="text-sm font-medium hover:underline">
														{agent.name}
													</Link>
												)}
												<AddressDisplay address={agent.address} className="text-xs" />
											</div>
											<ScoreBadge grade={agent.grade} size="xs" />
										</div>
										{agent.perTxLimit && (
											<div className="mb-3">
												<span className="inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
													Per-Tx: {agent.perTxLimit}
												</span>
											</div>
										)}
										<div className="space-y-4">
											<BudgetUsage
												label="Daily"
												percentage={dailyPct}
												used={agent.dailySpent ?? `0 ${currency}`}
												total={agent.dailyLimit ?? `0 ${currency}`}
											/>
											<BudgetUsage
												label="Monthly"
												percentage={monthlyPct}
												used={agent.monthlySpent ?? `0 ${currency}`}
												total={agent.monthlyLimit ?? `0 ${currency}`}
											/>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
