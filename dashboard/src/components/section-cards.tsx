"use client"

import {
  ArrowsLeftRight,
  ChartBar,
  Robot,
  ShieldCheck,
  TrendUp,
  TrendDown,
} from "@phosphor-icons/react"
import { useFilteredAgentList, useChainDistribution, useCurrencyBreakdown } from "@/hooks/use-convex-data"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getChain } from "@/lib/chains"
import { getGrade } from "@/lib/constants"

export function SectionCards(): React.ReactElement {
  const agents = useFilteredAgentList()
  const chainDist = useChainDistribution()
  const currencyBreakdown = useCurrencyBreakdown()

  const totalAgents = agents.length
  const avgScore = totalAgents > 0
    ? Math.round(agents.reduce((s, a) => s + a.score, 0) / totalAgents)
    : 0
  const avgGrade = getGrade(avgScore)
  const highGrade = agents.filter((a) => a.score >= 700).length
  const registered = agents.filter((a) => a.isRegistered).length

  // Determine primary currency (most agents)
  const primaryCurrency = currencyBreakdown.length > 0
    ? currencyBreakdown.sort((a, b) => b.agentCount - a.agentCount)[0]
    : null
  const volumeData = parseVolumesByCurrency(agents)
  const primaryVolume = primaryCurrency
    ? volumeData.get(primaryCurrency.currency) ?? 0
    : parseVolumeNum(agents)
  const primarySymbol = primaryCurrency?.currency ?? "ETH"

  // Top grade across all agents
  const sorted = [...agents].sort((a, b) => b.score - a.score)
  const topGrade = sorted[0]?.grade ?? "N/A"

  // Chain distribution tooltip
  const chainTooltip = chainDist.length > 0
    ? chainDist.map((d) => `${getChain(d.chainId)?.name ?? "Unknown"}: ${d.count}`).join("\n")
    : "No agents"

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Agents</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums font-mono @[250px]/card:text-3xl">
            <Tooltip>
              <TooltipTrigger asChild>
                <span><NumberTicker key={totalAgents} value={totalAgents} /></span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs whitespace-pre">
                {chainTooltip}
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Robot weight="fill" />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {registered} registered on-chain <ShieldCheck className="size-4" weight="fill" />
          </div>
          <div className="text-muted-foreground">
            Across {chainDist.length || 1} network{chainDist.length !== 1 ? "s" : ""}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Average Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums font-mono @[250px]/card:text-3xl">
            <NumberTicker key={avgScore} value={avgScore} />
            <span className="text-sm font-normal text-muted-foreground ml-1">/ 1000</span>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendUp />
              {avgGrade}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Across all scored agents <ChartBar className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Scale: 0 - 1000
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Top Grade</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums font-mono @[250px]/card:text-3xl">
            {topGrade}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {highGrade > totalAgents / 2 ? <TrendUp /> : <TrendDown />}
              {totalAgents > 0 ? `${Math.round((highGrade / totalAgents) * 100)}%` : "0%"} BBB+
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {highGrade} investment-grade agents <ShieldCheck className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Score {"\u2265"} 700 (BBB or above)
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Volume</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums font-mono @[250px]/card:text-3xl">
            <NumberTicker key={primaryVolume} value={primaryVolume} decimalPlaces={2} />
            <span className="text-sm font-normal text-muted-foreground ml-1">{primarySymbol}</span>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ArrowsLeftRight />
              {currencyBreakdown.length > 1
                ? `${currencyBreakdown.length} currencies`
                : primarySymbol}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Cumulative transaction volume <ArrowsLeftRight className="size-4" />
          </div>
          <div className="text-muted-foreground">
            All tracked agents
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function parseVolumeNum(agents: { totalVolume?: string }[]): number {
  let sum = 0
  for (const a of agents) {
    if (!a.totalVolume) continue
    const match = a.totalVolume.match(/([\d.]+)/)
    if (match) sum += Number.parseFloat(match[1])
  }
  return sum
}

function parseVolumesByCurrency(
  agents: { totalVolume?: string; budgetCurrency?: string }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of agents) {
    if (!a.totalVolume) continue
    const cur = (a as { budgetCurrency?: string }).budgetCurrency ?? "ETH"
    const match = a.totalVolume.match(/([\d.]+)/)
    if (match) {
      map.set(cur, (map.get(cur) ?? 0) + Number.parseFloat(match[1]))
    }
  }
  return map
}
