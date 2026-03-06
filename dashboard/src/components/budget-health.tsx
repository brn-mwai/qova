"use client"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useFilteredAgentList, useChainCurrency } from "@/hooks/use-convex-data"
import { shortenAddress } from "@/lib/constants"

function parseNumeric(value: string | undefined): number {
	if (!value) return 0
	const match = value.match(/([\d.]+)/)
	return match ? Number.parseFloat(match[1]) : 0
}

function utilizationColor(pct: number): string {
	if (pct > 85) return "text-score-red"
	if (pct > 60) return "text-score-yellow"
	return "text-score-green"
}

function barColor(pct: number): string {
	if (pct > 85) return "[&>div]:bg-[var(--score-red)]"
	if (pct > 60) return "[&>div]:bg-[var(--score-yellow)]"
	return "[&>div]:bg-[var(--score-green)]"
}

export function BudgetHealth(): React.ReactElement {
	const agents = useFilteredAgentList()
	const chainCurrency = useChainCurrency()

	const withBudget = agents
		.filter((a) => a.monthlyLimit)
		.map((a) => {
			const limit = parseNumeric(a.monthlyLimit)
			const spent = parseNumeric(a.monthlySpent)
			const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
			const currency = (a as { budgetCurrency?: string }).budgetCurrency ?? chainCurrency
			return {
				address: a.address,
				addressShort: a.addressShort,
				name: (a as { name?: string }).name,
				limit,
				spent,
				pct,
				currency,
			}
		})
		.sort((a, b) => b.pct - a.pct)
		.slice(0, 5)

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Budget Health</CardTitle>
				<CardDescription className="text-xs">
					Monthly budget utilization by agent
				</CardDescription>
			</CardHeader>
			<CardContent>
				{withBudget.length === 0 ? (
					<p className="text-sm text-muted-foreground py-6 text-center">
						No budgets configured yet
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{withBudget.map((a) => (
							<div key={a.address} className="space-y-1">
								<div className="flex items-center justify-between text-xs">
									<span className="font-mono text-muted-foreground">
										{a.name ?? shortenAddress(a.address)}
									</span>
									<span className={`font-mono tabular-nums ${utilizationColor(a.pct)}`}>
										{a.spent} / {a.limit} {a.currency}
									</span>
								</div>
								<Progress value={a.pct} className={`h-1.5 ${barColor(a.pct)}`} />
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
