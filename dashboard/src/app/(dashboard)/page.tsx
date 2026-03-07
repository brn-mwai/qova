"use client"

import { ArrowSquareOut, TrendUp, TrendDown, ArrowRight } from "@phosphor-icons/react"
import Link from "next/link"
import { SectionCards } from "@/components/section-cards"
import { QuickActions } from "@/components/quick-actions"
import { ScoreTrendChart } from "@/components/charts/score-trend-chart"
import { ChainDistributionChart } from "@/components/chain-distribution"
import { BudgetHealth } from "@/components/budget-health"
import { ScoreAlerts } from "@/components/score-alerts"
import { ActivityChart } from "@/components/charts/activity-chart"
import { ScoreBadge } from "@/components/scores/score-badge"
import { AddressDisplay } from "@/components/shared/address-display"
import { TxTypeBadge } from "@/components/data/tx-type-badge"
import { useFilteredLeaderboard, useFilteredRecentActivity, useChainCurrency } from "@/hooks/use-convex-data"
import { useChainFilter } from "@/components/providers/chain-provider"
import { getExplorerTxUrl } from "@/lib/chains"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function fullTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

const DASHBOARD_INFO = {
  description: "A real-time overview of all your registered agents and how they're performing. See trust scores, spending, and activity at a glance.",
  sections: [
    { title: "Stats Row", description: "Key metrics showing total agents, average trust score, top grade in your portfolio, and cumulative transaction volume." },
    { title: "Getting Started", description: "Step-by-step shortcuts to register an agent, run scoring, view the leaderboard, and set budgets." },
    { title: "Score Trend", description: "A line chart showing how your agents' trust scores have changed over time." },
    { title: "Chain Distribution", description: "A breakdown of which blockchain networks your agents are operating on." },
    { title: "Budget Health", description: "Shows how much of your agents' monthly spending limits have been used." },
    { title: "Score Alerts", description: "Notifications about recent score changes, budget warnings, and verification events." },
    { title: "Top Agents", description: "Your best-performing agents ranked by trust score." },
    { title: "Recent Activity", description: "A log of the latest transactions, verifications, and events from all your agents." },
  ],
}

export default function OverviewPage(): React.ReactElement {
  const leaderboard = useFilteredLeaderboard(5)
  const recentActivity = useFilteredRecentActivity(12)
  const { selectedChainId } = useChainFilter()

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <PageHeader
          title="Dashboard"
          subtitle="Real-time overview of your registered agents and the ecosystem"
          info={DASHBOARD_INFO}
        />
      </div>

      {/* Stats Row */}
      <SectionCards />

      {/* Quick Actions */}
      <div className="px-4 lg:px-6">
        <QuickActions />
      </div>

      {/* Score Trend + Chain Distribution */}
      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <div className="lg:col-span-2">
          <ScoreTrendChart />
        </div>
        <ChainDistributionChart />
      </div>

      {/* Budget Health + Score Alerts */}
      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <BudgetHealth />
        <ScoreAlerts />
      </div>

      {/* Top Agents + Activity Chart */}
      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Top Agents</CardTitle>
                <CardDescription className="text-xs">Ranked by trust score</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/agents">
                  View all
                  <ArrowRight className="size-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {leaderboard.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6 w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Grade</TableHead>
                    <TableHead className="pr-4 sm:pr-6 text-right text-xs">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((agent) => (
                    <TableRow key={agent.address} className="group">
                      <TableCell className="pl-4 sm:pl-6 font-mono text-xs font-bold text-muted-foreground">
                        {agent.rank}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/agents/${agent.address}`}
                          className="hover:underline"
                        >
                          <span className="text-sm font-medium block truncate max-w-[140px] sm:max-w-none">{agent.name ?? agent.addressShort}</span>
                        </Link>
                        <AddressDisplay address={agent.address} className="text-[11px] hidden sm:block" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <ScoreBadge grade={agent.grade} size="xs" />
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-sm font-medium tabular-nums">{agent.score}</span>
                          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${agent.scorePercentage}%`,
                                backgroundColor: agent.gradeColor,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No agents scored yet
              </p>
            )}
          </CardContent>
        </Card>

        <ActivityChart />
      </div>

      {/* Recent Activity */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Latest agent transactions and events</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/transactions">
                  View all
                  <ArrowRight className="size-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentActivity.length > 0 ? (
              <TooltipProvider delayDuration={200}>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4 sm:pl-6 text-xs">Agent</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-right text-xs">Amount</TableHead>
                        <TableHead className="pr-4 sm:pr-6 text-right text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentActivity.map((tx) => (
                        <TableRow key={tx._id} className="group">
                          <TableCell className="pl-4 sm:pl-6">
                            <Link href={`/agents/${tx.agent}`} className="block">
                              <AddressDisplay address={tx.agent} className="text-xs" />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <TxTypeBadge type={tx.type} />
                          </TableCell>
                          <TableCell className="max-w-[240px]">
                            <span className="truncate block text-xs text-muted-foreground">{tx.description}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.amount && (
                              <span className="font-mono text-xs font-medium tabular-nums text-score-green">{tx.amount}</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-4 sm:pr-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground cursor-default">
                                    {timeAgo(tx.timestamp)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="font-mono text-xs">
                                  {fullTimestamp(tx.timestamp)}
                                </TooltipContent>
                              </Tooltip>
                              {tx.txHash && (
                                <a
                                  href={getExplorerTxUrl(selectedChainId, tx.txHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ArrowSquareOut size={12} />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden divide-y">
                  {recentActivity.map((tx) => (
                    <div key={tx._id} className="px-4 py-3 flex items-start gap-3">
                      <div className="shrink-0 pt-0.5">
                        <TxTypeBadge type={tx.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <AddressDisplay address={tx.agent} className="text-[11px]" />
                          <span className="text-[11px] text-muted-foreground">{timeAgo(tx.timestamp)}</span>
                        </div>
                      </div>
                      {tx.amount && (
                        <span className="font-mono text-xs font-medium tabular-nums text-score-green shrink-0">{tx.amount}</span>
                      )}
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No activity recorded yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
