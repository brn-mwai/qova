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
import { useChainFilter } from "@/components/providers/chain-provider"
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
import { getChain, DEFAULT_CHAIN_ID } from "@/lib/chains"
import { getGrade } from "@/lib/constants"
import { isUsdPegged } from "@/lib/tokens"

export function SectionCards(): React.ReactElement {
  const agents = useFilteredAgentList()
  const chainDist = useChainDistribution()
  const currencyBreakdown = useCurrencyBreakdown()
  const { selectedChainId } = useChainFilter()

  const totalAgents = agents.length
  const avgScore = totalAgents > 0
    ? Math.round(agents.reduce((s, a) => s + a.score, 0) / totalAgents)
    : 0
  const avgGrade = getGrade(avgScore)
  const highGrade = agents.filter((a) => a.score >= 700).length
  const registered = agents.filter((a) => a.isRegistered).length

  // Parse volumes grouped by token
  const volumeByToken = parseVolumesByCurrency(agents)
  // Split into USD-pegged total and non-USD tokens
  let usdVolume = 0
  const nonUsdTokens: { symbol: string; amount: number }[] = []
  for (const [symbol, amount] of volumeByToken.entries()) {
    if (isUsdPegged(symbol)) {
      usdVolume += amount
    } else {
      nonUsdTokens.push({ symbol, amount })
    }
  }
  const hasUsdVolume = usdVolume > 0
  const totalVolume = hasUsdVolume ? usdVolume : parseVolumeNum(agents)

  // Volume footer description
  const tokenList = [...volumeByToken.keys()]
  const volumeFooter = tokenList.length > 1
    ? `Across ${tokenList.join(", ")}`
    : tokenList.length === 1
      ? `Denominated in ${tokenList[0]}`
      : "No volume data"

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
            {hasUsdVolume && <span className="text-muted-foreground">$</span>}
            <NumberTicker key={totalVolume} value={totalVolume} decimalPlaces={hasUsdVolume ? 0 : 2} />
            {!hasUsdVolume && <span className="text-sm font-normal text-muted-foreground ml-1">{tokenList[0] ?? "USD"}</span>}
            {hasUsdVolume && <span className="text-sm font-normal text-muted-foreground ml-1">USD</span>}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ArrowsLeftRight />
              {tokenList.length > 1
                ? `${tokenList.length} tokens`
                : tokenList[0] ?? "USDC.e"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Cumulative transaction volume <ArrowsLeftRight className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {volumeFooter}
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
    const match = a.totalVolume.match(/([\d,.]+)/)
    if (match) sum += Number.parseFloat(match[1].replace(/,/g, ""))
  }
  return sum
}

function parseVolumesByCurrency(
  agents: { totalVolume?: string; budgetCurrency?: string }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of agents) {
    if (!a.totalVolume) continue
    // Extract token symbol from the volume string (e.g., "42,180 USDC.e" -> "USDC.e")
    const symbolMatch = a.totalVolume.match(/[\d.,]+\s+(.+)/)
    const cur = symbolMatch?.[1] ?? a.budgetCurrency ?? "USDC.e"
    const numMatch = a.totalVolume.match(/([\d,.]+)/)
    if (numMatch) {
      const value = Number.parseFloat(numMatch[1].replace(/,/g, ""))
      map.set(cur, (map.get(cur) ?? 0) + value)
    }
  }
  return map
}
