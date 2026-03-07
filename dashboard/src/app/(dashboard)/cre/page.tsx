"use client"

import Link from "next/link"
import {
  CurrencyCircleDollar,
  Timer,
  ShieldCheck,
  ChartLineUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  CircleNotch,
  Info,
  Lightning,
  SpinnerGap,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { AddressDisplay } from "@/components/shared/address-display"
import { useCreWorkflows, useRecentCreExecutions, useAgentList } from "@/hooks/use-convex-data"
import { useMutation } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { useConvexAvailable } from "@/components/providers/convex-provider"
import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"
import type { ComponentType } from "react"
import type { IconProps } from "@phosphor-icons/react"
const iconMap: Record<string, ComponentType<IconProps>> = {
  CurrencyCircleDollar,
  Timer,
  ShieldCheck,
  ChartLineUp,
}

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StatusIcon({ status }: { status: string }): React.ReactElement {
  if (status === "completed") {
    return <CheckCircle weight="fill" className="size-4 text-score-green" />
  }
  if (status === "failed") {
    return <XCircle weight="fill" className="size-4 text-destructive" />
  }
  return <CircleNotch className="size-4 text-muted-foreground animate-spin" />
}

function WorkflowStatusBadge({ status }: { status: string }): React.ReactElement {
  if (status === "active") {
    return (
      <Badge variant="outline" className="text-score-green border-score-green-border bg-score-green-bg">
        Active
      </Badge>
    )
  }
  if (status === "paused") {
    return (
      <Badge variant="outline" className="text-score-yellow border-score-yellow-border bg-score-yellow-bg">
        Paused
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-destructive border-score-red-border bg-score-red-bg">
      Error
    </Badge>
  )
}

function RunScoringPanel(): React.ReactElement {
  const agents = useAgentList()
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(async (): Promise<void> => {
    if (!selectedAgent) {
      toast.error("Select an agent to score")
      return
    }
    setRunning(true)
    try {
      const res = await fetch("/api/cre/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentAddress: selectedAgent, workflowId: "composite" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Scoring failed")
        return
      }
      toast.success(
        `Score computed: ${data.currentScore} -> ${data.newScore}${data.txHash ? " (written on-chain)" : " (no change)"}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setRunning(false)
    }
  }, [selectedAgent])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightning className="size-4 text-score-yellow" weight="fill" />
          <CardTitle className="text-sm">Run Scoring</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Execute the CRE scoring pipeline against an agent&apos;s on-chain data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="agent-select">
              Agent Address
            </label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger id="agent-select" className="w-full">
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 ? (
                  <SelectItem value="none" disabled>No agents registered</SelectItem>
                ) : (
                  agents.map((a) => (
                    <SelectItem key={a.address} value={a.address}>
                      <span className="flex items-center gap-2">
                        <span className="text-sm">{a.name ?? a.addressShort}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{a.addressShort}</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleRun}
            disabled={running || !selectedAgent}
            className="sm:w-auto"
          >
            {running ? (
              <SpinnerGap size={14} className="animate-spin" />
            ) : (
              <Lightning size={14} weight="bold" />
            )}
            {running ? "Scoring..." : "Run Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CrePage(): React.ReactElement {
  const workflows = useCreWorkflows()
  const recentExecutions = useRecentCreExecutions(15)
  const available = useConvexAvailable()
  const seedWorkflows = useMutation(api.mutations.cre.seedWorkflows)
  const seeded = useRef(false)

  // Auto-seed default workflows on first visit when empty
  useEffect(() => {
    if (available && workflows.length === 0 && !seeded.current) {
      seeded.current = true
      seedWorkflows({}).then((count) => {
        if (count > 0) toast.success(`Initialized ${count} scoring workflows`)
      }).catch(() => {
        seeded.current = false
      })
    }
  }, [available, workflows.length, seedWorkflows])

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <PageHeader
          breadcrumb="Intelligence"
          title="Scoring Engine"
          subtitle="How Qova computes reputation scores using Chainlink CRE"
          info={{
            description: "Understand how trust scores are computed and run the scoring pipeline manually. Qova uses Chainlink CRE to calculate scores from four independent workflows.",
            sections: [
              { title: "Run Scoring", description: "Manually trigger the scoring pipeline for any agent and see the result immediately." },
              { title: "Methodology", description: "How the composite trust score (0-1000) is built from four weighted scoring workflows." },
              { title: "Workflow Status", description: "Status, completion rate, and runtime for each scoring workflow." },
              { title: "Execution History", description: "A log of recent scoring runs showing input/output scores and duration." },
            ],
          }}
        />
      </div>

      {/* Run Scoring Panel */}
      <div className="px-4 lg:px-6">
        <RunScoringPanel />
      </div>

      {/* Methodology Explainer */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Scoring Methodology</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The composite CRE score (0-1000) is computed by running four independent
              Chainlink CRE workflows against on-chain data. Each workflow produces a
              sub-score weighted by its contribution factor. The final score determines
              the agent&apos;s grade (AAA to D) and creditworthiness rating.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {workflows.map((w) => {
                const Icon = iconMap[w.icon] ?? ChartLineUp
                return (
                  <div
                    key={w.workflowId}
                    className="flex items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{w.name.split(" ").slice(0, 2).join(" ")}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {(w.weight * 100).toFixed(0)}% weight
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Cards */}
      <div className="px-4 lg:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((workflow) => {
            const Icon = iconMap[workflow.icon] ?? ChartLineUp
            return (
              <Link
                key={workflow.workflowId}
                href={`/cre/${workflow.workflowId}`}
                className="group"
              >
                <Card className="transition-colors group-hover:border-foreground/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg border bg-muted">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{workflow.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {(workflow.weight * 100).toFixed(0)}% of composite score
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <WorkflowStatusBadge status={workflow.status} />
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                      {workflow.description}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Runs</p>
                        <p className="font-mono text-sm tabular-nums">
                          {workflow.totalRuns.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success</p>
                        <p className="font-mono text-sm tabular-nums">
                          {workflow.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Time</p>
                        <p className="font-mono text-sm tabular-nums">
                          {workflow.avgDurationMs ? formatDuration(workflow.avgDurationMs) : "--"}
                        </p>
                      </div>
                    </div>
                    {workflow.lastRunAt && (
                      <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t">
                        Last run {timeAgo(workflow.lastRunAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Execution Timeline */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Execution Timeline</CardTitle>
            <CardDescription>Recent workflow executions across all scoring pipelines</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentExecutions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs w-8">Status</TableHead>
                    <TableHead className="text-xs">Workflow</TableHead>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs text-right">Input</TableHead>
                    <TableHead className="text-xs text-right">Output</TableHead>
                    <TableHead className="text-xs text-right">Duration</TableHead>
                    <TableHead className="pr-6 text-xs text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExecutions.map((exec) => (
                    <TableRow key={exec._id}>
                      <TableCell className="pl-6">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <StatusIcon status={exec.status} />
                            </TooltipTrigger>
                            <TooltipContent>{exec.status}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/cre/${exec.workflowId}`}
                          className="text-sm hover:underline"
                        >
                          {exec.workflowId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {exec.agentAddress ? (
                          <AddressDisplay address={exec.agentAddress} className="text-xs" />
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {exec.inputScore ?? "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {exec.outputScore ?? "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {exec.durationMs ? formatDuration(exec.durationMs) : "--"}
                      </TableCell>
                      <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                        {timeAgo(exec.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No executions recorded yet. Workflows will appear here once agents are scored.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
