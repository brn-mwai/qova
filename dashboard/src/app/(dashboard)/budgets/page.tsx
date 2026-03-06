"use client";

import { CurrencyEth, Gauge, Wallet } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { BudgetUsage } from "@/components/charts/budget-usage";
import { EmptyState } from "@/components/data/empty-state";
import { useFilteredAgentList } from "@/hooks/use-convex-data";
import { PageHeader } from "@/components/shared/page-header";
import { useConvexAvailable } from "@/components/providers/convex-provider";

function isValidAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export default function BudgetsPage(): React.ReactElement {
	const available = useConvexAvailable();
	const agents = useFilteredAgentList();
	const upsertAgent = useMutation(api.mutations.agents.upsertAgent);

	// Form state
	const [agentAddr, setAgentAddr] = useState("");
	const [dailyLimit, setDailyLimit] = useState("");
	const [monthlyLimit, setMonthlyLimit] = useState("");
	const [perTxLimit, setPerTxLimit] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState(false);

	function validateEthAmount(value: string, label: string): string | null {
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

		const dailyErr = validateEthAmount(dailyLimit, "Daily limit");
		if (dailyErr) {
			setFormError(dailyErr);
			return;
		}

		const monthlyErr = validateEthAmount(monthlyLimit, "Monthly limit");
		if (monthlyErr) {
			setFormError(monthlyErr);
			return;
		}

		const perTxErr = validateEthAmount(perTxLimit, "Per-transaction limit");
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
			// Find existing agent to preserve score
			const existing = agents.find(
				(a) => a.address.toLowerCase() === trimmedAddr.toLowerCase(),
			);

			await upsertAgent({
				address: trimmedAddr,
				score: existing?.score ?? 0,
				dailyLimit: `${dailyLimit.trim()} ETH`,
				monthlyLimit: `${monthlyLimit.trim()} ETH`,
				perTxLimit: `${perTxLimit.trim()} ETH`,
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

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
			<PageHeader
				breadcrumb="Operations"
				title="Budgets"
				subtitle="Spending limits and utilization for your agents"
			/>

			{/* Set Budget */}
			<div className="rounded-lg border bg-card p-5">
				<div className="mb-4 flex items-center gap-2">
					<Gauge size={18} className="text-foreground" />
					<h2 className="text-sm font-medium text-foreground">Set Budget</h2>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5 sm:col-span-2">
						<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Agent Address
						</label>
						<input
							type="text"
							value={agentAddr}
							onChange={(e) => {
								setAgentAddr(e.target.value);
								setFormError(null);
							}}
							placeholder="0x..."
							className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Daily Limit (ETH)
						</label>
						<div className="relative">
							<CurrencyEth
								size={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<input
								type="text"
								value={dailyLimit}
								onChange={(e) => {
									setDailyLimit(e.target.value);
									setFormError(null);
								}}
								placeholder="10.0"
								className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Monthly Limit (ETH)
						</label>
						<div className="relative">
							<CurrencyEth
								size={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<input
								type="text"
								value={monthlyLimit}
								onChange={(e) => {
									setMonthlyLimit(e.target.value);
									setFormError(null);
								}}
								placeholder="100.0"
								className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Per-Transaction Limit (ETH)
						</label>
						<div className="relative">
							<CurrencyEth
								size={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<input
								type="text"
								value={perTxLimit}
								onChange={(e) => {
									setPerTxLimit(e.target.value);
									setFormError(null);
								}}
								placeholder="5.0"
								className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
							/>
						</div>
					</div>
				</div>

				{formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
				{formSuccess && (
					<p className="mt-3 text-sm text-score-green">Budget updated successfully.</p>
				)}

				<div className="mt-4">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={submitting}
						className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{submitting ? "Submitting..." : "Set Budget"}
					</button>
				</div>
			</div>

			{/* Agent Budget Overview */}
			<div>
				<div className="mb-4 flex items-center gap-2">
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
							function parseEthVal(val: string | undefined): number {
								if (!val) return 0;
								const match = val.match(/([\d.]+)/);
								return match ? Number.parseFloat(match[1]) : 0;
							}

							const dLim = parseEthVal(agent.dailyLimit);
							const dSpent = parseEthVal(agent.dailySpent);
							const mLim = parseEthVal(agent.monthlyLimit);
							const mSpent = parseEthVal(agent.monthlySpent);
							const dailyPct = dLim > 0 ? (dSpent / dLim) * 100 : 0;
							const monthlyPct = mLim > 0 ? (mSpent / mLim) * 100 : 0;

							return (
								<div key={agent.address} className="rounded-lg border bg-card p-5">
									<div className="mb-4 flex items-center justify-between">
										<span className="font-mono text-sm">{agent.addressShort}</span>
										<span className="text-xs text-muted-foreground">
											Per-Tx: {agent.perTxLimit ?? "N/A"}
										</span>
									</div>
									<div className="space-y-4">
										<BudgetUsage
											label="Daily"
											percentage={dailyPct}
											used={agent.dailySpent ?? "0 ETH"}
											total={agent.dailyLimit ?? "0 ETH"}
										/>
										<BudgetUsage
											label="Monthly"
											percentage={monthlyPct}
											used={agent.monthlySpent ?? "0 ETH"}
											total={agent.monthlyLimit ?? "0 ETH"}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
