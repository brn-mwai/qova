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
	const centerValue = selectedChainId === 0 ? total : filteredTotal

	return (
		<Card className="flex flex-col">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium">Chain Distribution</CardTitle>
				<CardDescription className="text-xs">
					{selectedChainId === 0
						? `${total} agents across supported networks`
						: `${filteredTotal} agents on selected chain`}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 flex flex-col items-center justify-center">
				{total === 0 ? (
					<p className="text-sm text-muted-foreground py-6 text-center">
						No agents registered yet
					</p>
				) : (
					<div className="flex flex-col items-center gap-3 w-full">
						<div className="w-full aspect-square max-w-[180px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={data}
										cx="50%"
										cy="50%"
										innerRadius="52%"
										outerRadius="82%"
										paddingAngle={data.length > 1 ? 2 : 0}
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
									<text
										x="50%"
										y="50%"
										textAnchor="middle"
										dominantBaseline="central"
									>
										<tspan
											x="50%"
											dy="-0.4em"
											className="fill-foreground font-mono text-2xl font-bold"
										>
											{centerValue}
										</tspan>
										<tspan
											x="50%"
											dy="1.5em"
											className="fill-muted-foreground text-[10px]"
										>
											agents
										</tspan>
									</text>
								</PieChart>
							</ResponsiveContainer>
						</div>
						<div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 w-full">
							{data.map((entry) => (
								<div
									key={entry.name}
									className="flex items-center gap-1.5 text-xs"
									style={{ opacity: entry.isSelected ? 1 : 0.4 }}
								>
									<span
										className="inline-block size-2 rounded-full shrink-0"
										style={{ backgroundColor: entry.color }}
									/>
									<span className="text-muted-foreground">{entry.name}</span>
									<span className="font-mono font-medium tabular-nums">
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
