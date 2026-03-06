"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useFilteredRecentActivity } from "@/hooks/use-convex-data"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useIsMobile } from "@/hooks/use-mobile"

const chartConfig = {
  count: {
    label: "Transactions",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ActivityChart(): React.ReactElement {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")
  const activity = useFilteredRecentActivity(500)

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const { chartData, totalTx, avgPerDay } = React.useMemo(() => {
    if (activity.length === 0) return { chartData: [], totalTx: 0, avgPerDay: 0 }

    const now = Date.now()
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = now - days * 86400000
    const dayMap: Record<string, number> = {}

    let total = 0
    for (const item of activity) {
      if (item.timestamp < cutoff) continue
      const day = new Date(item.timestamp).toISOString().split("T")[0]
      dayMap[day] = (dayMap[day] ?? 0) + 1
      total++
    }

    const data = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    return {
      chartData: data,
      totalTx: total,
      avgPerDay: data.length > 0 ? Math.round(total / data.length) : 0,
    }
  }, [activity, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <div>
          <CardTitle>Activity Volume</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:inline">
              {totalTx} transactions total, ~{avgPerDay}/day avg
            </span>
            <span className="@[540px]/card:hidden">
              {totalTx} txns
            </span>
          </CardDescription>
        </div>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">90d</ToggleGroupItem>
            <ToggleGroupItem value="30d">30d</ToggleGroupItem>
            <ToggleGroupItem value="7d">7d</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-24 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select time range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">90 days</SelectItem>
              <SelectItem value="30d" className="rounded-lg">30 days</SelectItem>
              <SelectItem value="7d" className="rounded-lg">7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={30}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No activity in this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
