"use client"

import Link from "next/link"
import {
	Robot,
	Lightning,
	Trophy,
	Wallet,
} from "@phosphor-icons/react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const actions = [
	{
		step: 1,
		label: "Register Agent",
		href: "/agents?register=true",
		icon: Robot,
		description: "Add your AI agent's wallet address to start tracking",
	},
	{
		step: 2,
		label: "Run Scoring",
		href: "/cre",
		icon: Lightning,
		description: "Execute CRE workflows to compute reputation scores",
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
		description: "Configure spending limits to improve compliance scores",
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
						<Button
							key={action.href}
							variant="outline"
							className="h-auto flex-col items-start gap-1.5 p-3 text-left"
							asChild
						>
							<Link href={action.href}>
								<div className="flex w-full items-center gap-2">
									<span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold text-muted-foreground">
										{action.step}
									</span>
									<action.icon className="size-4" weight="duotone" />
									<span className="text-xs font-medium">{action.label}</span>
								</div>
								<span className="text-[11px] text-muted-foreground leading-tight pl-7">
									{action.description}
								</span>
							</Link>
						</Button>
					))}
				</div>
			</CardContent>
		</Card>
	)
}
