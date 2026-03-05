"use client"

import Link from "next/link"
import { TrendUp, TrendDown, Minus } from "@phosphor-icons/react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { ScoreBadge } from "@/components/scores/score-badge"
import { useAgentList } from "@/hooks/use-convex-data"
import { SCORE_GRADES } from "@/lib/constants"

function getGradeForScore(score: number): string {
	for (const { grade, min } of SCORE_GRADES) {
		if (score >= min) return grade
	}
	return "D"
}

interface AgentDelta {
	address: string
	addressShort: string
	name?: string
	currentScore: number
	grade: string
	delta: number
	crossedThreshold: boolean
}

export function ScoreAlerts(): React.ReactElement {
	const agents = useAgentList()

	const deltas: AgentDelta[] = agents
		.filter((a) => a.previousScore !== undefined && a.previousScore !== a.score)
		.map((a) => {
			const delta = a.score - (a.previousScore ?? a.score)
			const previousGrade = a.previousGrade ?? getGradeForScore(a.previousScore ?? a.score)
			return {
				address: a.address,
				addressShort: a.addressShort,
				name: a.name,
				currentScore: a.score,
				grade: a.grade,
				delta,
				crossedThreshold: previousGrade !== a.grade,
			}
		})
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
		.slice(0, 5)

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Score Alerts</CardTitle>
				<CardDescription className="text-xs">
					Notable score movements
				</CardDescription>
			</CardHeader>
			<CardContent>
				{agents.length === 0 ? (
					<p className="text-sm text-muted-foreground py-6 text-center">
						No agents scored yet
					</p>
				) : deltas.length === 0 ? (
					<p className="text-sm text-muted-foreground py-6 text-center">
						All agents stable -- no recent changes
					</p>
				) : (
					<div className="flex flex-col gap-2.5">
						{deltas.map((d) => (
							<Link
								key={d.address}
								href={`/agents/${d.address}`}
								className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
							>
								<div className="flex items-center gap-2">
									<ScoreBadge grade={d.grade} size="xs" />
									<div className="flex flex-col">
										<span className="font-mono text-xs text-muted-foreground">
											{d.name ?? d.addressShort}
										</span>
										{d.crossedThreshold && (
											<span className="text-[10px] text-score-yellow">
												Grade changed
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
									<span>{d.currentScore}</span>
									{d.delta > 0 ? (
										<span className="flex items-center text-score-green">
											<TrendUp className="size-3" weight="bold" />
											+{d.delta}
										</span>
									) : d.delta < 0 ? (
										<span className="flex items-center text-score-red">
											<TrendDown className="size-3" weight="bold" />
											{d.delta}
										</span>
									) : (
										<span className="flex items-center text-muted-foreground">
											<Minus className="size-3" />
										</span>
									)}
								</div>
							</Link>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
