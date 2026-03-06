"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { useFilteredGradeDistribution } from "@/hooks/use-convex-data"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"

const GRADE_ORDER = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]

function gradeColor(grade: string): string {
  if (["AAA", "AA", "A", "BBB"].includes(grade)) return "var(--score-green)"
  if (["BB", "B", "CCC"].includes(grade)) return "var(--score-yellow)"
  return "var(--score-red)"
}

function gradeTier(grade: string): string {
  if (["AAA", "AA", "A", "BBB"].includes(grade)) return "Investment"
  if (["BB", "B", "CCC"].includes(grade)) return "Speculative"
  return "Distressed"
}

const chartConfig = {
  count: {
    label: "Agents",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ScoreDistribution(): React.ReactElement {
  const distribution = useFilteredGradeDistribution()

  const totalAgents = GRADE_ORDER.reduce((sum, g) => sum + (distribution[g] ?? 0), 0)

  const chartData = GRADE_ORDER.map((grade) => {
    const count = distribution[grade] ?? 0
    return {
      grade,
      count,
      fill: gradeColor(grade),
      percentage: totalAgents > 0 ? Math.round((count / totalAgents) * 100) : 0,
      tier: gradeTier(grade),
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade Distribution</CardTitle>
        <CardDescription>
          {totalAgents} agents across {GRADE_ORDER.length} credit grades
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalAgents > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="grade"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={30}
                allowDecimals={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const data = payload[0].payload as (typeof chartData)[number]
                  return (
                    <div className="rounded-md border bg-card px-3 py-2 text-xs">
                      <p className="font-semibold">{data.grade} - {data.tier}</p>
                      <p className="text-muted-foreground">
                        {data.count} agent{data.count !== 1 ? "s" : ""} ({data.percentage}%)
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry) => (
                  <Cell key={entry.grade} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="percentage"
                  position="top"
                  formatter={(val: number) => val > 0 ? `${val}%` : ""}
                  className="fill-muted-foreground text-[10px]"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No agents scored yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
