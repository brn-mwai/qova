"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	Bell,
	CheckCircle,
	Warning,
	ShieldCheck,
	ChartLineUp,
	Wallet,
	Checks,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";

const ICON_MAP: Record<
	string,
	React.ComponentType<{ className?: string; weight?: "fill" | "regular" }>
> = {
	score_change: ChartLineUp,
	budget_alert: Wallet,
	verification: ShieldCheck,
	system: Bell,
};

const TYPE_COLORS: Record<string, string> = {
	score_change: "text-chart-2",
	budget_alert: "text-score-yellow",
	verification: "text-score-green",
	system: "text-muted-foreground",
};

function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

export default function AlertsPage(): React.ReactElement {
	const { user } = useUser();
	const userId = user?.id;

	const notifications = useQuery(
		api.queries.notifications.listByUser,
		userId ? { userId, limit: 100 } : "skip",
	);
	const unreadCount = useQuery(
		api.queries.notifications.countUnread,
		userId ? { userId } : "skip",
	);
	const markRead = useMutation(api.mutations.notifications.markRead);
	const markAllRead = useMutation(api.mutations.notifications.markAllRead);

	const [filter, setFilter] = useState<string>("all");

	const filtered =
		notifications === undefined
			? []
			: filter === "all"
				? notifications
				: filter === "unread"
					? notifications.filter((n) => !n.read)
					: notifications.filter((n) => n.type === filter);

	async function handleMarkAllRead(): Promise<void> {
		if (!userId) return;
		try {
			await markAllRead({ userId });
			toast.success("All notifications marked as read");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to mark all read",
			);
		}
	}

	async function handleMarkRead(id: Id<"notifications">): Promise<void> {
		try {
			await markRead({ id });
		} catch {
			// Silently fail for individual reads
		}
	}

	return (
		<div className="flex flex-col gap-6 py-4 md:py-6">
			<div className="px-4 lg:px-6">
				<PageHeader
					breadcrumb="Alerts"
					title="Alerts"
					subtitle="Notifications about score changes, budget warnings, and anomalies"
					info={{
						description: "Stay informed with notifications about score changes, budget warnings, verification events, and system updates.",
						sections: [
							{ title: "Filters", description: "Filter alerts by type: Score, Budget, Verification, or System. Toggle between all and unread." },
							{ title: "Notification List", description: "Each alert shows what happened, when, and links to the relevant agent if applicable." },
						],
					}}
					actions={
						(unreadCount ?? 0) > 0 ? (
							<Button
								size="sm"
								variant="outline"
								onClick={handleMarkAllRead}
							>
								<Checks className="size-4 mr-1" />
								Mark all read
							</Button>
						) : undefined
					}
				/>
			</div>

			{/* Filters */}
			<div className="px-4 lg:px-6">
				<div className="flex gap-2 flex-wrap">
					{[
						{ key: "all", label: "All" },
						{
							key: "unread",
							label: `Unread (${unreadCount ?? 0})`,
						},
						{ key: "score_change", label: "Score" },
						{ key: "budget_alert", label: "Budget" },
						{ key: "verification", label: "Verification" },
						{ key: "system", label: "System" },
					].map((f) => (
						<button
							key={f.key}
							type="button"
							onClick={() => setFilter(f.key)}
							className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
								filter === f.key
									? "bg-foreground text-background"
									: "hover:bg-accent text-muted-foreground"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{/* Notification List */}
			<div className="px-4 lg:px-6">
				<Card>
					<CardContent className="p-0 divide-y">
						{notifications === undefined ? (
							<div className="divide-y">
								{Array.from({ length: 5 }).map((_, i) => (
									<div key={i} className="flex items-start gap-3 p-4">
										<div className="size-5 rounded bg-muted animate-pulse mt-0.5 shrink-0" />
										<div className="flex-1 space-y-2">
											<div className="h-4 w-48 rounded bg-muted animate-pulse" />
											<div className="h-3 w-72 rounded bg-muted animate-pulse" />
											<div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
										</div>
									</div>
								))}
							</div>
						) : filtered.length > 0 ? (
							filtered.map((notif) => {
								const Icon = ICON_MAP[notif.type] ?? Bell;
								return (
									<button
										key={notif._id}
										type="button"
										onClick={() =>
											!notif.read &&
											handleMarkRead(
												notif._id as Id<"notifications">,
											)
										}
										className={`w-full text-left flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/50 ${
											!notif.read ? "bg-accent/30" : ""
										}`}
									>
										<div
											className={`mt-0.5 shrink-0 ${TYPE_COLORS[notif.type]}`}
										>
											<Icon
												className="size-5"
												weight={notif.read ? "regular" : "fill"}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<span
													className={`text-sm font-medium ${!notif.read ? "" : "text-muted-foreground"}`}
												>
													{notif.title}
												</span>
												{!notif.read && (
													<span className="size-1.5 rounded-full bg-chart-2 shrink-0" />
												)}
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2">
												{notif.message}
											</p>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-[10px] text-muted-foreground">
													{timeAgo(notif.createdAt)}
												</span>
												{notif.agentAddress && (
													<Link
														href={`/agents/${notif.agentAddress}`}
														className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
														onClick={(e) => e.stopPropagation()}
													>
														{notif.agentAddress.slice(0, 6)}...
														{notif.agentAddress.slice(-4)}
													</Link>
												)}
											</div>
										</div>
									</button>
								);
							})
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<CheckCircle className="size-8 text-score-green mb-2" />
								<p className="text-sm font-medium">No notifications</p>
								<p className="text-xs text-muted-foreground">
									{filter === "all"
										? "You're all caught up"
										: "No notifications match this filter"}
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
