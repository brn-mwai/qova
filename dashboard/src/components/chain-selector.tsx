"use client"

import { SUPPORTED_CHAINS, type ChainConfig } from "@/lib/chains"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Globe } from "@phosphor-icons/react"
import { useAgentList } from "@/hooks/use-convex-data"
import { useMemo } from "react"

interface ChainSelectorProps {
	value?: number
	onValueChange?: (chainId: number) => void
	/** Compact mode for header placement. */
	compact?: boolean
	/** Show "All Chains" option. */
	showAll?: boolean
}

export function ChainSelector({
	value,
	onValueChange,
	compact = false,
	showAll = false,
}: ChainSelectorProps): React.ReactElement {
	const selected = SUPPORTED_CHAINS.find((c) => c.id === value)
	const agents = useAgentList()

	const chainCounts = useMemo(() => {
		const counts = new Map<number, number>()
		for (const a of agents) {
			if (a.chainId) {
				counts.set(a.chainId, (counts.get(a.chainId) ?? 0) + 1)
			}
		}
		return counts
	}, [agents])

	const totalAgents = agents.length

	return (
		<Select
			value={value !== undefined ? String(value) : "all"}
			onValueChange={(v) => {
				if (v === "all") {
					onValueChange?.(0)
				} else {
					onValueChange?.(Number(v))
				}
			}}
		>
			<SelectTrigger
				className={
					compact
						? "h-8 w-auto gap-1.5 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-accent"
						: "w-[180px]"
				}
			>
				<SelectValue>
					<span className="flex items-center gap-1.5">
						{selected ? (
							<>
								<ChainDot color={selected.brandColor} />
								{selected.name}
								{chainCounts.get(selected.id) !== undefined && (
									<span className="font-mono text-[10px] text-muted-foreground">
										({chainCounts.get(selected.id)})
									</span>
								)}
							</>
						) : (
							<>
								<Globe weight="bold" className="size-3.5" />
								All Chains
								{totalAgents > 0 && (
									<span className="font-mono text-[10px] text-muted-foreground">
										({totalAgents})
									</span>
								)}
							</>
						)}
					</span>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{showAll && (
					<SelectItem value="all">
						<span className="flex items-center gap-2">
							<Globe weight="bold" className="size-3.5" />
							All Chains
							{totalAgents > 0 && (
								<span className="font-mono text-[10px] text-muted-foreground ml-auto">
									{totalAgents}
								</span>
							)}
						</span>
					</SelectItem>
				)}
				{SUPPORTED_CHAINS.map((chain) => {
					const count = chainCounts.get(chain.id) ?? 0
					return (
						<SelectItem key={chain.id} value={String(chain.id)}>
							<span className="flex items-center gap-2">
								<ChainDot color={chain.brandColor} />
								{chain.name}
								{chain.isTestnet && (
									<span className="text-[10px] text-muted-foreground">testnet</span>
								)}
								<span className="font-mono text-[10px] text-muted-foreground ml-auto">
									{count}
								</span>
							</span>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}

function ChainDot({ color }: { color: string }): React.ReactElement {
	return (
		<span
			className="inline-block size-2.5 rounded-full shrink-0"
			style={{ backgroundColor: color }}
		/>
	)
}
