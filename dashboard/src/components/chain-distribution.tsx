"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { useChainDistribution } from "@/hooks/use-convex-data"
import { useChainFilter } from "@/components/providers/chain-provider"
import { getChain } from "@/lib/chains"

export function ChainDistributionChart(): React.ReactElement {
	const distribution = useChainDistribution()
	const { selectedChainId } = useChainFilter()

	const data = distribution.map((d) => {
		const chain = getChain(d.chainId)
		const isSelected = selectedChainId === 0 || d.chainId === selectedChainId
		return {
			name: chain?.name ?? `Chain ${d.chainId}`,
			value: d.count,
			color: isSelected ? (chain?.brandColor ?? "#888888") : "#333333",
			chainId: d.chainId,
			isSelected,
		}
	})

	const total = data.reduce((s, d) => s + d.value, 0)
	const filteredTotal = selectedChainId === 0
		? total
		: data.filter((d) => d.isSelected).reduce((s, d) => s + d.value, 0)

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Chain Distribution</CardTitle>
				<CardDescription className="text-xs">
					{selectedChainId === 0
						? `${total} agents across supported networks`
						: `${filteredTotal} agents on selected chain`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<p className="text-sm text-muted-foreground py-6 text-center">
						No agents registered yet
					</p>
				) : (
					<div className="flex items-center gap-6">
						<div className="h-[140px] w-[140px] shrink-0">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={data}
										cx="50%"
										cy="50%"
										innerRadius={40}
										outerRadius={65}
										paddingAngle={2}
										dataKey="value"
										stroke="none"
									>
										{data.map((entry) => (
											<Cell
												key={entry.name}
												fill={entry.color}
												opacity={entry.isSelected ? 1 : 0.25}
											/>
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											background: "hsl(var(--card))",
											border: "1px solid hsl(var(--border))",
											borderRadius: "8px",
											fontSize: "12px",
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
						<div className="flex flex-col gap-2">
							{data.map((entry) => (
								<div
									key={entry.name}
									className="flex items-center gap-2 text-sm"
									style={{ opacity: entry.isSelected ? 1 : 0.4 }}
								>
									<span
										className="inline-block size-2.5 rounded-full shrink-0"
										style={{ backgroundColor: entry.color }}
									/>
									<span className="text-muted-foreground">{entry.name}</span>
									<span className="font-mono font-medium ml-auto tabular-nums">
										{entry.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
