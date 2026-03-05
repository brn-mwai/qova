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
		label: "Register Agent",
		href: "/agents?register=true",
		icon: Robot,
		description: "Add a new AI agent",
	},
	{
		label: "Run CRE Workflow",
		href: "/cre",
		icon: Lightning,
		description: "Execute scoring workflow",
	},
	{
		label: "View Leaderboard",
		href: "/scores",
		icon: Trophy,
		description: "See top-ranked agents",
	},
	{
		label: "Manage Budgets",
		href: "/budgets",
		icon: Wallet,
		description: "Set spending limits",
	},
] as const

export function QuickActions(): React.ReactElement {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
				<CardDescription className="text-xs">
					Jump into common workflows
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{actions.map((action) => (
						<Button
							key={action.href}
							variant="outline"
							className="h-auto flex-col gap-1 py-3 text-xs"
							asChild
						>
							<Link href={action.href}>
								<action.icon className="size-4" weight="duotone" />
								<span>{action.label}</span>
							</Link>
						</Button>
					))}
				</div>
			</CardContent>
		</Card>
	)
}
