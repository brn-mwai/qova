"use client"

import Link from "next/link"
import {
	Robot,
	Lightning,
	Trophy,
	Wallet,
	ArrowRight,
} from "@phosphor-icons/react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

const actions = [
	{
		step: 1,
		label: "Register Agent",
		href: "/agents?register=true",
		icon: Robot,
		description: "Add your agent's wallet address to start tracking",
	},
	{
		step: 2,
		label: "Run Scoring",
		href: "/cre",
		icon: Lightning,
		description: "Execute scoring workflows to compute trust scores",
	},
	{
		step: 3,
		label: "View Leaderboard",
		href: "/scores",
		icon: Trophy,
		description: "See how your agents rank against others",
	},
	{
		step: 4,
		label: "Set Budgets",
		href: "/budgets",
		icon: Wallet,
		description: "Set spending limits to improve compliance scores",
	},
] as const

export function QuickActions(): React.ReactElement {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Getting Started</CardTitle>
				<CardDescription className="text-xs">
					Follow these steps to set up your agent scoring
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{actions.map((action) => (
						<Link
							key={action.href}
							href={action.href}
							className="group flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
						>
							<div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
								<action.icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" weight="duotone" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<span className="flex size-4 items-center justify-center rounded-full bg-foreground/10 font-mono text-[9px] font-bold text-muted-foreground shrink-0">
										{action.step}
									</span>
									<span className="text-xs font-medium truncate">{action.label}</span>
									<ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
								</div>
								<p className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-2">
									{action.description}
								</p>
							</div>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	)
}
