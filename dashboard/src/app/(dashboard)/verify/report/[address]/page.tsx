"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  ShieldCheck,
  XCircle,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreBadge } from "@/components/scores/score-badge"
import {
  useAgentByAddress,
  useScoreHistory,
  useCreWorkflows,
  useChainCurrency,
} from "@/hooks/use-convex-data"
import { toast } from "sonner"
function ScoreRing({
  score,
  size = 120,
}: {
  score: number
  size?: number
}): React.ReactElement {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(score / 1000, 1)
  const offset = circumference * (1 - percentage)

  const color =
    score >= 700
      ? "var(--score-green)"
      : score >= 400
        ? "var(--score-yellow)"
        : "var(--score-red)"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            {
              "--circumference": circumference,
              "--target-offset": offset,
            } as React.CSSProperties
          }
          className="animate-score-fill"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 1000</span>
      </div>
    </div>
  )
}

function ReportSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 py-4 md:py-6 px-4 lg:px-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}

export default function CreditReportPage(): React.ReactElement {
  const params = useParams()
  const address = params.address as string
  const agent = useAgentByAddress(address)
  const currency = useChainCurrency()
  const scoreHistory = useScoreHistory(address, 30)
  const workflows = useCreWorkflows()

  if (!agent) {
    return <ReportSkeleton />
  }

  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`
  const badgeUrl = `/api/badge/${address}`

  function copyBadgeEmbed(): void {
    navigator.clipboard.writeText(
      `![Qova Score](${window.location.origin}${badgeUrl})`,
    )
    toast.success("Badge embed copied to clipboard")
  }

  // Score trend
  const recentScores = scoreHistory.slice(-7)
  const scoreDelta =
    recentScores.length >= 2
      ? recentScores[recentScores.length - 1].score - recentScores[0].score
      : 0

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <Link
          href="/verify"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to Verify
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="size-5" />
          <h2 className="text-lg font-semibold tracking-tight">Credit Report</h2>
        </div>
        <p className="text-sm text-muted-foreground font-mono">{address}</p>
      </div>

      {/* Score Overview */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
              <ScoreRing score={agent.score} />
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ScoreBadge
                      grade={agent.grade}
                      size="lg"
                      showScore
                      score={agent.score}
                    />
                    {scoreDelta !== 0 && (
                      <span
                        className={`font-mono text-sm ${scoreDelta > 0 ? "text-score-green" : "text-destructive"}`}
                      >
                        {scoreDelta > 0 ? "+" : ""}
                        {scoreDelta} (7d)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated {agent.lastUpdated ? new Date(agent.lastUpdated).toLocaleString() : "N/A"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transactions</p>
                    <p className="font-mono text-sm tabular-nums">{agent.totalTxCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume</p>
                    <p className="font-mono text-sm tabular-nums">{agent.totalVolume ?? `0 ${currency}`}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</p>
                    <p className="font-mono text-sm tabular-nums">{agent.successRate ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Updates</p>
                    <p className="font-mono text-sm tabular-nums">{agent.updateCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown + Status */}
      <div className="px-4 lg:px-6 grid gap-4 lg:grid-cols-2">
        {/* CRE Workflow Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Score Breakdown</CardTitle>
            <CardDescription>
              Estimated contribution from each CRE workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflows.map((w) => {
                const contribution = Math.round(agent.score * w.weight)
                return (
                  <div key={w.workflowId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">{w.name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {contribution} / {Math.round(1000 * w.weight)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(contribution / (1000 * w.weight)) * 100}%`,
                          backgroundColor:
                            contribution / (1000 * w.weight) > 0.7
                              ? "var(--score-green)"
                              : contribution / (1000 * w.weight) > 0.4
                                ? "var(--score-yellow)"
                                : "var(--score-red)",
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent Status</CardTitle>
            <CardDescription>Registration and compliance details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Registration</span>
                <div className="flex items-center gap-1.5">
                  {agent.isRegistered ? (
                    <>
                      <CheckCircle weight="fill" className="size-4 text-score-green" />
                      <span className="text-sm">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle weight="fill" className="size-4 text-destructive" />
                      <span className="text-sm">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">On-chain</span>
                <a
                  href={agent.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm hover:underline"
                >
                  {shortAddr}
                  <ArrowSquareOut className="size-3" />
                </a>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Daily Budget</span>
                <span className="font-mono text-sm">{agent.dailyLimit ?? "N/A"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Monthly Budget</span>
                <span className="font-mono text-sm">{agent.monthlyLimit ?? "N/A"}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Per-Tx Limit</span>
                <span className="font-mono text-sm">{agent.perTxLimit ?? "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score History */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Score History (Last 30 Snapshots)</CardTitle>
            <CardDescription>
              Historical score evolution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentScores.length > 0 ? (
              <div className="flex items-end gap-1 h-24">
                {scoreHistory.slice(-30).map((snap, i) => {
                  const height = (snap.score / 1000) * 100
                  const color =
                    snap.score >= 700
                      ? "var(--score-green)"
                      : snap.score >= 400
                        ? "var(--score-yellow)"
                        : "var(--score-red)"
                  return (
                    <div
                      key={snap._id}
                      className="flex-1 rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        backgroundColor: color,
                        minWidth: 4,
                      }}
                      title={`${snap.score} (${snap.grade}) - ${new Date(snap.timestamp).toLocaleDateString()}`}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No score history available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Embeddable Badge */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Embeddable Badge</CardTitle>
            <CardDescription>
              Add this badge to your README or website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={badgeUrl}
                alt={`Qova Score: ${agent.score}`}
                className="h-5"
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-muted-foreground truncate">
                  {`![Qova Score](${typeof window !== "undefined" ? window.location.origin : ""}${badgeUrl})`}
                </p>
              </div>
              <button
                type="button"
                onClick={copyBadgeEmbed}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors cursor-pointer shrink-0"
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
