"use client"

import { useState, useEffect } from "react"
import {
  ChartBar,
  ArrowUp,
  ArrowDown,
  Clock,
  Warning,
  Lightning,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"

// ── Mock metrics data (production: fetch from /api/metrics) ─────────

interface MetricPoint {
  time: string
  requests: number
  errors: number
  avgLatency: number
  p95Latency: number
}

function generateMockMetrics(hours: number): MetricPoint[] {
  const points: MetricPoint[] = []
  const now = Date.now()
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now - i * 3600000).toISOString()
    const base = 50 + Math.floor(Math.random() * 200)
    points.push({
      time,
      requests: base,
      errors: Math.floor(base * (0.01 + Math.random() * 0.05)),
      avgLatency: 15 + Math.floor(Math.random() * 80),
      p95Latency: 80 + Math.floor(Math.random() * 200),
    })
  }
  return points
}

interface EndpointStat {
  path: string
  method: string
  count: number
  avgMs: number
  errorRate: number
}

const MOCK_ENDPOINT_STATS: EndpointStat[] = [
  { path: "/api/agents", method: "GET", count: 12847, avgMs: 23, errorRate: 0.4 },
  { path: "/api/agents/:address/score", method: "GET", count: 8932, avgMs: 45, errorRate: 0.7 },
  { path: "/api/scores/compute", method: "POST", count: 6241, avgMs: 89, errorRate: 1.2 },
  { path: "/api/verify/agent", method: "POST", count: 4820, avgMs: 120, errorRate: 2.1 },
  { path: "/api/transactions/record", method: "POST", count: 3156, avgMs: 156, errorRate: 3.8 },
  { path: "/api/budgets/:address", method: "GET", count: 2890, avgMs: 18, errorRate: 0.2 },
  { path: "/api/agents/register", method: "POST", count: 1243, avgMs: 890, errorRate: 5.2 },
  { path: "/api/keys", method: "GET", count: 421, avgMs: 12, errorRate: 0.0 },
]

export default function UsagePage() {
  const [timeRange, setTimeRange] = useState("24h")
  const [metrics, setMetrics] = useState<MetricPoint[]>([])

  useEffect(() => {
    const hours = timeRange === "1h" ? 1 : timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720
    setMetrics(generateMockMetrics(hours))
  }, [timeRange])

  const totalRequests = metrics.reduce((s, m) => s + m.requests, 0)
  const totalErrors = metrics.reduce((s, m) => s + m.errors, 0)
  const avgLatency = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.avgLatency, 0) / metrics.length)
    : 0
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : "0"
  const maxBar = Math.max(...metrics.map((m) => m.requests), 1)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="API Usage"
          subtitle="Request volume, latency, and error rates for your API keys"
        />
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Lightning className="h-4 w-4" />
              Total Requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">12.5%</span> vs previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Warning className="h-4 w-4" />
              Error Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorRate}%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowDown className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">0.3%</span> vs previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Avg Latency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLatency}ms</div>
            <p className="text-xs text-muted-foreground mt-1">p50 response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ChartBar className="h-4 w-4" />
              p95 Latency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.p95Latency, 0) / metrics.length) : 0}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">95th percentile</p>
          </CardContent>
        </Card>
      </div>

      {/* Request volume chart (simple bar chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request Volume</CardTitle>
          <CardDescription>Requests per hour over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-[200px]">
            {metrics.map((point, i) => {
              const height = Math.max(2, (point.requests / maxBar) * 180)
              const errorHeight = Math.max(0, (point.errors / maxBar) * 180)
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-popover border rounded-md px-2 py-1 text-xs shadow-md whitespace-nowrap">
                    <div>{new Date(point.time).toLocaleTimeString()}</div>
                    <div>{point.requests} requests</div>
                    <div>{point.errors} errors</div>
                    <div>{point.avgLatency}ms avg</div>
                  </div>
                  <div
                    className="w-full bg-rose-500/70 rounded-t-sm"
                    style={{ height: `${errorHeight}px` }}
                  />
                  <div
                    className="w-full bg-teal-500/80 rounded-t-sm"
                    style={{ height: `${height - errorHeight}px` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{metrics[0] ? new Date(metrics[0].time).toLocaleDateString() : ""}</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-teal-500" /> Success
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-500" /> Errors
              </span>
            </div>
            <span>Now</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-endpoint breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint Breakdown</CardTitle>
          <CardDescription>Request counts and performance per endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4 text-right">Requests</th>
                  <th className="pb-2 pr-4 text-right">Avg Latency</th>
                  <th className="pb-2 pr-4 text-right">Error Rate</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ENDPOINT_STATS.map((stat) => (
                  <tr key={`${stat.method}-${stat.path}`} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs">
                        <Badge variant="outline" className="mr-2 text-[10px]">
                          {stat.method}
                        </Badge>
                        {stat.path}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono">{stat.count.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{stat.avgMs}ms</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{stat.errorRate}%</td>
                    <td className="py-2.5">
                      {stat.errorRate < 1 ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                          Healthy
                        </Badge>
                      ) : stat.errorRate < 5 ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                          Warning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-200">
                          Degraded
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Metrics are updated in real-time from the <code className="text-[10px] px-1 py-0.5 bg-muted rounded">/api/metrics</code> Prometheus endpoint.
        Connect Grafana or Datadog for advanced dashboards.
      </p>
    </div>
  )
}
