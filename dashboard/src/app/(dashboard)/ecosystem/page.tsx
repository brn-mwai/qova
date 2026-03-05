"use client"

import Link from "next/link"
import {
  Robot,
  TrendUp,
  TrendDown,
  Warning,
  ArrowRight,
  ChartBar,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { NumberTicker } from "@/components/ui/number-ticker"
import { ScoreBadge } from "@/components/scores/score-badge"
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
import { PageHeader } from "@/components/shared/page-header"
import {
  useAgentList,
  useGradeDistribution,
  useRecentActivity,
} from "@/hooks/use-convex-data"

const GRADE_ORDER = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: number
  subtitle?: string
}): React.ReactElement {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums">
          <NumberTicker key={value} value={value} />
        </p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function GradeBar({
  grade,
  count,
  maxCount,
}: {
  grade: string
  count: number
  maxCount: number
}): React.ReactElement {
  const greenGrades = ["AAA", "AA", "A", "BBB"]
  const yellowGrades = ["BB", "B", "CCC"]
  const color = greenGrades.includes(grade)
    ? "var(--score-green)"
    : yellowGrades.includes(grade)
      ? "var(--score-yellow)"
      : "var(--score-red)"

  const width = maxCount > 0 ? (count / maxCount) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs w-8 text-right tabular-nums">{grade}</span>
      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-xs w-6 text-right tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  )
}

export default function EcosystemPage(): React.ReactElement {
  const agents = useAgentList()
  const gradeDistribution = useGradeDistribution()
  const recentActivity = useRecentActivity(20)

  const totalAgents = agents.length
  const avgScore =
    totalAgents > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.score, 0) / totalAgents)
      : 0
  const investmentGrade = agents.filter((a) =>
    ["AAA", "AA", "A", "BBB"].includes(a.grade),
  ).length
  const speculativeGrade = agents.filter((a) =>
    ["BB", "B", "CCC"].includes(a.grade),
  ).length
  const distressedGrade = agents.filter((a) =>
    ["CC", "C", "D"].includes(a.grade),
  ).length

  // Risk watchlist: agents with score < 400 or recent large drops
  const riskAgents = agents
    .filter((a) => a.score < 500)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)

  // Top movers: recently active agents
  const activityByAgent = new Map<string, number>()
  for (const act of recentActivity) {
    activityByAgent.set(act.agent, (activityByAgent.get(act.agent) ?? 0) + 1)
  }
  const topMovers = agents
    .map((a) => ({ ...a, activityCount: activityByAgent.get(a.address) ?? 0 }))
    .filter((a) => a.activityCount > 0)
    .sort((a, b) => b.activityCount - a.activityCount)
    .slice(0, 5)

  const maxGradeCount = Math.max(
    ...GRADE_ORDER.map((g) => gradeDistribution[g] ?? 0),
    1,
  )

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <PageHeader
          breadcrumb="Intelligence"
          title="Ecosystem"
          subtitle="The state of the autonomous agent economy on Base"
        />
      </div>

      {/* Macro Stats */}
      <div className="px-4 lg:px-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Agents"
          value={totalAgents}
          subtitle="Registered on-chain"
        />
        <StatCard
          label="Avg Score"
          value={avgScore}
          subtitle={`out of 1000`}
        />
        <StatCard
          label="Investment Grade"
          value={investmentGrade}
          subtitle="BBB or above"
        />
        <StatCard
          label="At Risk"
          value={distressedGrade}
          subtitle="CC or below"
        />
      </div>

      {/* Distribution + Breakdown */}
      <div className="px-4 lg:px-6 grid gap-4 lg:grid-cols-2">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Score Distribution</CardTitle>
            <CardDescription>
              Agent count by credit grade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {GRADE_ORDER.map((grade) => (
                <GradeBar
                  key={grade}
                  grade={grade}
                  count={gradeDistribution[grade] ?? 0}
                  maxCount={maxGradeCount}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agent Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Grade Tiers</CardTitle>
            <CardDescription>
              Distribution across risk categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: "var(--score-green)" }}
                    />
                    <span className="text-sm font-medium">Investment Grade</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {investmentGrade}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  AAA, AA, A, BBB -- Eligible for automated credit lines
                </p>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalAgents > 0 ? (investmentGrade / totalAgents) * 100 : 0}%`,
                      backgroundColor: "var(--score-green)",
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: "var(--score-yellow)" }}
                    />
                    <span className="text-sm font-medium">Speculative</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {speculativeGrade}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  BB, B, CCC -- Require enhanced monitoring
                </p>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalAgents > 0 ? (speculativeGrade / totalAgents) * 100 : 0}%`,
                      backgroundColor: "var(--score-yellow)",
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: "var(--score-red)" }}
                    />
                    <span className="text-sm font-medium">Distressed</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {distressedGrade}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  CC, C, D -- High default risk, restricted operations
                </p>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{
                      width: `${totalAgents > 0 ? (distressedGrade / totalAgents) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends + Watchlist */}
      <div className="px-4 lg:px-6 grid gap-4 lg:grid-cols-2">
        {/* Top Movers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Movers</CardTitle>
            <CardDescription>Most active agents recently</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {topMovers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs">Agent</TableHead>
                    <TableHead className="text-xs">Grade</TableHead>
                    <TableHead className="text-xs text-right">Score</TableHead>
                    <TableHead className="pr-6 text-xs text-right">Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMovers.map((agent) => (
                    <TableRow key={agent.address}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/agents/${agent.address}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {agent.addressShort}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ScoreBadge grade={agent.grade} size="xs" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {agent.score}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TrendUp className="size-3 text-score-green" />
                          <span className="font-mono text-xs tabular-nums">
                            {agent.activityCount} txns
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        {/* Risk Watchlist */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warning className="size-4 text-score-yellow" />
              <CardTitle className="text-sm">Risk Watchlist</CardTitle>
            </div>
            <CardDescription>
              Agents with scores below 500
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {riskAgents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs">Agent</TableHead>
                    <TableHead className="text-xs">Grade</TableHead>
                    <TableHead className="text-xs text-right">Score</TableHead>
                    <TableHead className="pr-6 text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskAgents.map((agent) => (
                    <TableRow key={agent.address}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/agents/${agent.address}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {agent.addressShort}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ScoreBadge grade={agent.grade} size="xs" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {agent.score}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Badge
                          variant="outline"
                          className={
                            agent.score < 300
                              ? "text-destructive border-score-red-border bg-score-red-bg"
                              : "text-score-yellow border-score-yellow-border bg-score-yellow-bg"
                          }
                        >
                          {agent.score < 300 ? "Critical" : "Watch"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ChartBar className="size-6 text-score-green mb-2" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs text-muted-foreground">
                  No agents currently at risk
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
