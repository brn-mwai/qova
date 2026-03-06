"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
	WebhooksLogo,
	Plus,
	Trash,
	CheckCircle,
	XCircle,
	PaperPlaneTilt,
	Copy,
	Eye,
	EyeSlash,
	ArrowsClockwise,
	Warning,
	Lightning,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";

const WEBHOOK_EVENTS = [
	"agent.registered",
	"agent.score_updated",
	"agent.verified",
	"budget.exceeded",
	"budget.warning",
	"transaction.completed",
];

function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatDateTime(ts: number): string {
	return new Date(ts).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Shows delivery log for a specific webhook */
function DeliveryLog({
	webhookId,
}: { webhookId: Id<"webhooks"> }): React.ReactElement {
	const deliveries = useQuery(api.queries.webhooks.deliveries, {
		webhookId,
		limit: 5,
	});

	if (!deliveries || deliveries.length === 0) {
		return (
			<p className="text-xs text-muted-foreground py-3">
				No deliveries yet.
			</p>
		);
	}

	return (
		<div className="space-y-2 py-2">
			{deliveries.map((d) => (
				<div
					key={d._id}
					className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0"
				>
					<div className="flex items-center gap-2">
						{d.success ? (
							<CheckCircle
								weight="fill"
								className="size-3.5 text-score-green shrink-0"
							/>
						) : (
							<XCircle
								weight="fill"
								className="size-3.5 text-destructive shrink-0"
							/>
						)}
						<Badge variant="outline" className="text-[10px] font-mono">
							{d.event}
						</Badge>
						{d.statusCode && (
							<span className="text-muted-foreground">{d.statusCode}</span>
						)}
					</div>
					<span className="text-muted-foreground">
						{formatDateTime(d.deliveredAt)}
					</span>
				</div>
			))}
		</div>
	);
}

export default function WebhooksPage(): React.ReactElement {
	const { user } = useUser();
	const userId = user?.id;

	const webhooks = useQuery(
		api.queries.webhooks.listByUser,
		userId ? { userId } : "skip",
	);
	const createWebhook = useMutation(api.mutations.webhooks.create);
	const toggleWebhook = useMutation(api.mutations.webhooks.toggle);
	const removeWebhook = useMutation(api.mutations.webhooks.remove);
	const testWebhook = useAction(api.actions.webhookTest.testWebhook);

	const [createOpen, setCreateOpen] = useState(false);
	const [newUrl, setNewUrl] = useState("");
	const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
	const [creating, setCreating] = useState(false);
	const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
	const [testing, setTesting] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

	function toggleEvent(event: string): void {
		setSelectedEvents((prev) =>
			prev.includes(event)
				? prev.filter((e) => e !== event)
				: [...prev, event],
		);
	}

	async function handleCreate(): Promise<void> {
		if (!newUrl.trim() || selectedEvents.length === 0 || !userId) return;
		setCreating(true);
		try {
			const result = await createWebhook({
				userId,
				url: newUrl.trim(),
				events: selectedEvents,
			});
			setRevealedSecret(result.secret);
			setCreateOpen(false);
			setNewUrl("");
			setSelectedEvents([]);
			toast.success("Webhook created. Copy the signing secret now.");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to create webhook",
			);
		} finally {
			setCreating(false);
		}
	}

	async function handleToggle(
		id: Id<"webhooks">,
		isActive: boolean,
	): Promise<void> {
		try {
			await toggleWebhook({ id, isActive });
			toast.success(isActive ? "Webhook enabled" : "Webhook disabled");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to toggle");
		}
	}

	async function handleTest(id: Id<"webhooks">): Promise<void> {
		setTesting(id);
		try {
			const result = await testWebhook({ webhookId: id });
			if (result.success) {
				toast.success(
					`Test delivered: ${result.statusCode} in ${result.duration}ms`,
				);
			} else {
				toast.error(
					`Test failed: ${result.responseBody ?? "No response"} (${result.duration}ms)`,
				);
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Test delivery failed",
			);
		} finally {
			setTesting(null);
		}
	}

	async function handleDelete(id: string): Promise<void> {
		try {
			await removeWebhook({ id: id as Id<"webhooks"> });
			setConfirmDelete(null);
			toast.success("Webhook deleted");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete");
		}
	}

	return (
		<div className="flex flex-col gap-6 py-4 md:py-6">
			<div className="px-4 lg:px-6">
				<PageHeader
					breadcrumb="Developers"
					title="Webhooks"
					subtitle="Real-time event notifications for your applications"
					info={{
						description: "Set up webhook endpoints to receive real-time notifications when events happen to your agents.",
						sections: [
							{ title: "Add Endpoint", description: "Configure a URL to receive event notifications, and choose which events to subscribe to." },
							{ title: "Endpoints List", description: "Manage your webhooks - test deliveries, toggle active/disabled, and view delivery history." },
						],
					}}
					actions={
						<Dialog open={createOpen} onOpenChange={setCreateOpen}>
							<DialogTrigger asChild>
								<Button size="sm">
									<Plus className="size-4 mr-1" />
									Add Endpoint
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Webhook Endpoint</DialogTitle>
									<DialogDescription>
										Configure an HTTPS URL to receive event notifications.
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-2">
									<div className="space-y-2">
										<Label>Endpoint URL</Label>
										<Input
											value={newUrl}
											onChange={(e) => setNewUrl(e.target.value)}
											placeholder="https://api.example.com/webhooks"
										/>
										<p className="text-[11px] text-muted-foreground">
											Must be a valid HTTPS URL.
										</p>
									</div>
									<div className="space-y-2">
										<Label>Events</Label>
										<div className="grid grid-cols-2 gap-2">
											{WEBHOOK_EVENTS.map((event) => (
												<button
													key={event}
													type="button"
													onClick={() => toggleEvent(event)}
													className={`rounded-md border px-3 py-2 text-left text-xs font-mono transition-colors cursor-pointer ${
														selectedEvents.includes(event)
															? "border-foreground bg-accent"
															: "hover:bg-accent/50"
													}`}
												>
													{event}
												</button>
											))}
										</div>
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setCreateOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreate}
										disabled={
											!newUrl.trim() ||
											selectedEvents.length === 0 ||
											creating
										}
									>
										{creating ? "Creating..." : "Create"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					}
				/>
			</div>

			{/* Signing secret banner */}
			{revealedSecret && (
				<div className="px-4 lg:px-6">
					<div className="rounded-lg border border-score-green-border bg-score-green-bg p-4">
						<div className="flex items-start justify-between">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<Lightning className="size-4 text-score-green" />
									<p className="text-sm font-medium">Webhook signing secret</p>
								</div>
								<p className="text-xs text-muted-foreground mb-2">
									Use this secret to verify webhook signatures. It won't be
									shown again.
								</p>
								<code className="font-mono text-sm bg-background px-2 py-1 rounded border break-all">
									{revealedSecret}
								</code>
							</div>
							<div className="flex gap-2 shrink-0 ml-4">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										navigator.clipboard.writeText(revealedSecret);
										toast.success("Copied to clipboard");
									}}
								>
									<Copy className="size-3.5 mr-1" />
									Copy
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setRevealedSecret(null)}
								>
									Dismiss
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Webhooks table */}
			<div className="px-4 lg:px-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Endpoints</CardTitle>
						<CardDescription>
							{webhooks === undefined
								? "Loading..."
								: `${webhooks.length} webhook${webhooks.length !== 1 ? "s" : ""} configured`}
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0 pb-0">
						{webhooks !== undefined && webhooks.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<WebhooksLogo className="size-8 text-muted-foreground mb-3" />
								<p className="text-sm text-muted-foreground">
									No webhooks configured. Add an endpoint to receive events.
								</p>
							</div>
						) : (
							<div className="divide-y">
								{webhooks?.map((wh) => (
									<div key={wh._id} className="px-6 py-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3 min-w-0 flex-1">
												<WebhooksLogo className="size-4 text-muted-foreground shrink-0" />
												<div className="min-w-0">
													<p className="font-mono text-xs truncate">
														{wh.url}
													</p>
													<div className="flex flex-wrap gap-1 mt-1">
														{wh.events.map((ev: string) => (
															<Badge
																key={ev}
																variant="outline"
																className="text-[10px]"
															>
																{ev}
															</Badge>
														))}
													</div>
												</div>
											</div>

											<div className="flex items-center gap-3 shrink-0 ml-4">
												<div className="flex items-center gap-2">
													<span className="text-[11px] text-muted-foreground">
														{wh.isActive ? "Active" : "Disabled"}
													</span>
													<Switch
														checked={wh.isActive}
														onCheckedChange={(checked) =>
															handleToggle(
																wh._id as Id<"webhooks">,
																checked,
															)
														}
													/>
												</div>

												<Button
													variant="outline"
													size="sm"
													disabled={testing === wh._id}
													onClick={() =>
														handleTest(wh._id as Id<"webhooks">)
													}
												>
													{testing === wh._id ? (
														<ArrowsClockwise className="size-3.5 mr-1 animate-spin" />
													) : (
														<PaperPlaneTilt className="size-3.5 mr-1" />
													)}
													Test
												</Button>

												<Button
													variant="ghost"
													size="sm"
													className="size-7 p-0 text-muted-foreground"
													onClick={() =>
														setExpandedWebhook(
															expandedWebhook === wh._id
																? null
																: wh._id,
														)
													}
												>
													{expandedWebhook === wh._id ? (
														<EyeSlash className="size-3.5" />
													) : (
														<Eye className="size-3.5" />
													)}
												</Button>

												<Button
													variant="ghost"
													size="sm"
													className="size-7 p-0 text-muted-foreground hover:text-destructive"
													onClick={() => setConfirmDelete(wh._id)}
												>
													<Trash className="size-3.5" />
												</Button>
											</div>
										</div>

										{/* Secret + delivery log */}
										{expandedWebhook === wh._id && (
											<div className="mt-3 pl-7 space-y-3">
												<div>
													<p className="text-[11px] text-muted-foreground mb-1">
														Signing Secret
													</p>
													<div className="flex items-center gap-2">
														<code className="font-mono text-xs text-muted-foreground">
															{wh.secretMasked}
														</code>
													</div>
												</div>
												<div>
													<p className="text-[11px] text-muted-foreground mb-1">
														Recent Deliveries
													</p>
													<DeliveryLog
														webhookId={wh._id as Id<"webhooks">}
													/>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Created {formatDate(wh.createdAt)}
												</p>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Delete confirmation */}
			<Dialog
				open={confirmDelete !== null}
				onOpenChange={(open) => !open && setConfirmDelete(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Warning className="size-5 text-destructive" />
							Delete Webhook
						</DialogTitle>
						<DialogDescription>
							This will permanently delete this webhook endpoint. Your
							application will stop receiving events. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => confirmDelete && handleDelete(confirmDelete)}
						>
							Delete Permanently
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
