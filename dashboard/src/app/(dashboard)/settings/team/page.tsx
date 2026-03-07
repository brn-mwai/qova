"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
	Users,
	UserPlus,
	Crown,
	ShieldCheck,
	Eye,
	Code,
	Trash,
	EnvelopeSimple,
	Warning,
	PencilSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
type Role = "admin" | "editor" | "viewer";

const ROLE_CONFIG: Record<
	Role,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
		color: string;
	}
> = {
	admin: { label: "Admin", icon: ShieldCheck, color: "text-chart-2" },
	editor: { label: "Editor", icon: Code, color: "text-muted-foreground" },
	viewer: { label: "Viewer", icon: Eye, color: "text-muted-foreground" },
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
	admin: "Full access. Can manage team, settings, and all data.",
	editor: "Can manage agents, scores, API keys, and webhooks.",
	viewer: "Read-only access to dashboards and reports.",
};

function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}

export default function TeamPage(): React.ReactElement {
	const { user } = useUser();

	const members = useQuery(api.team.list);
	const invite = useMutation(api.team.invite);
	const updateRole = useMutation(api.team.updateRole);
	const removeMember = useMutation(api.team.removeMember);

	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteName, setInviteName] = useState("");
	const [inviteRole, setInviteRole] = useState<Role>("viewer");
	const [inviting, setInviting] = useState(false);
	const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
	const [editingRole, setEditingRole] = useState<string | null>(null);

	async function handleInvite(): Promise<void> {
		if (!inviteEmail.includes("@") || !inviteName.trim()) return;
		setInviting(true);
		try {
			await invite({
				email: inviteEmail.trim(),
				name: inviteName.trim(),
				role: inviteRole,
			});
			toast.success(`${inviteName} added to team as ${inviteRole}`);
			setInviteOpen(false);
			setInviteEmail("");
			setInviteName("");
			setInviteRole("viewer");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to send invite",
			);
		} finally {
			setInviting(false);
		}
	}

	async function handleUpdateRole(id: string, role: string): Promise<void> {
		try {
			await updateRole({ id: id as Id<"teamMembers">, role });
			setEditingRole(null);
			toast.success("Role updated");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update role",
			);
		}
	}

	async function handleRemove(id: string): Promise<void> {
		try {
			await removeMember({ id: id as Id<"teamMembers"> });
			setConfirmRemove(null);
			toast.success("Team member removed");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to remove");
		}
	}

	return (
		<div className="px-4 lg:px-6">
			<div className="mx-auto max-w-3xl w-full space-y-6">
				{/* Team Members */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-sm flex items-center gap-2">
									<Users size={16} />
									Team Members
								</CardTitle>
								<CardDescription>
									{members === undefined
										? "Loading..."
										: `${members.length} member${members.length !== 1 ? "s" : ""} in your organization.`}
								</CardDescription>
							</div>
							<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
								<DialogTrigger asChild>
									<Button size="sm">
										<UserPlus className="size-4 mr-1" />
										Invite
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Invite Team Member</DialogTitle>
										<DialogDescription>
											Add a new member to your organization.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 py-2">
										<div className="space-y-2">
											<label className="text-sm font-medium">Name</label>
											<Input
												placeholder="Jane Smith"
												value={inviteName}
												onChange={(e) => setInviteName(e.target.value)}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-sm font-medium">
												Email Address
											</label>
											<Input
												placeholder="colleague@company.com"
												type="email"
												value={inviteEmail}
												onChange={(e) => setInviteEmail(e.target.value)}
											/>
										</div>
										<div className="space-y-2">
											<label className="text-sm font-medium">Role</label>
											<div className="grid gap-2">
												{(
													Object.entries(ROLE_CONFIG) as [
														Role,
														(typeof ROLE_CONFIG)[Role],
													][]
												).map(([role, cfg]) => {
													const RIcon = cfg.icon;
													return (
														<button
															key={role}
															type="button"
															onClick={() => setInviteRole(role)}
															className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer ${
																inviteRole === role
																	? "border-foreground bg-accent"
																	: "hover:bg-accent/50"
															}`}
														>
															<RIcon
																className={`size-4 shrink-0 ${cfg.color}`}
															/>
															<div>
																<span className="font-medium">
																	{cfg.label}
																</span>
																<p className="text-[10px] text-muted-foreground mt-0.5">
																	{ROLE_DESCRIPTIONS[role]}
																</p>
															</div>
														</button>
													);
												})}
											</div>
										</div>
									</div>
									<DialogFooter>
										<Button
											variant="outline"
											onClick={() => setInviteOpen(false)}
										>
											Cancel
										</Button>
										<Button
											disabled={
												!inviteEmail.includes("@") ||
												!inviteName.trim() ||
												inviting
											}
											onClick={handleInvite}
										>
											<EnvelopeSimple className="size-4 mr-1" />
											{inviting ? "Sending..." : "Send Invite"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
					</CardHeader>
					<CardContent>
						{/* Current user row */}
						<div className="flex items-center gap-3 py-3 border-b">
							<div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
								{user?.firstName?.[0] ?? "Y"}
								{user?.lastName?.[0] ?? ""}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium truncate">
										{user?.fullName ?? "You"}
									</span>
									<Crown
										className="size-3.5 text-score-yellow"
										weight="fill"
									/>
								</div>
								<span className="text-xs text-muted-foreground truncate block">
									{user?.primaryEmailAddress?.emailAddress ?? ""}
								</span>
							</div>
							<Badge variant="outline" className="gap-1 text-xs">
								<Crown className="size-3 text-score-yellow" />
								Owner
							</Badge>
						</div>

						{/* Team members from Convex */}
						{members === undefined ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								Loading...
							</p>
						) : members.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No team members yet. Invite someone to get started.
							</p>
						) : (
							members.map((member) => {
								const role = (member.role as Role) ?? "viewer";
								const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
								const Icon = config.icon;
								const initials = member.memberName
									.split(" ")
									.map((n: string) => n[0])
									.join("")
									.slice(0, 2)
									.toUpperCase();

								return (
									<div
										key={member._id}
										className="flex items-center gap-3 py-3 border-b last:border-b-0"
									>
										<div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
											{initials}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium truncate">
													{member.memberName}
												</span>
												<Badge
													variant="outline"
													className="text-[10px]"
												>
													{member.status}
												</Badge>
											</div>
											<span className="text-xs text-muted-foreground truncate block">
												{member.memberEmail}
											</span>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<span className="text-[10px] text-muted-foreground hidden sm:block">
												{timeAgo(member.invitedAt)}
											</span>

											{editingRole === member._id ? (
												<Select
													defaultValue={role}
													onValueChange={(v) =>
														handleUpdateRole(member._id, v)
													}
												>
													<SelectTrigger className="w-28 h-7 text-xs">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="admin">
															Admin
														</SelectItem>
														<SelectItem value="editor">
															Editor
														</SelectItem>
														<SelectItem value="viewer">
															Viewer
														</SelectItem>
													</SelectContent>
												</Select>
											) : (
												<Badge
													variant="outline"
													className="gap-1 text-xs cursor-pointer"
													onClick={() =>
														setEditingRole(member._id)
													}
												>
													<Icon
														className={`size-3 ${config.color}`}
													/>
													{config.label}
													<PencilSimple className="size-2.5 ml-0.5 text-muted-foreground" />
												</Badge>
											)}

											<Button
												variant="ghost"
												size="sm"
												className="size-7 p-0 text-muted-foreground hover:text-destructive"
												onClick={() =>
													setConfirmRemove(member._id)
												}
											>
												<Trash className="size-3.5" />
											</Button>
										</div>
									</div>
								);
							})
						)}
					</CardContent>
				</Card>

				{/* Role Permissions Reference */}
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Role Permissions</CardTitle>
						<CardDescription>
							Overview of what each role can access.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{(
								Object.entries(ROLE_CONFIG) as [
									Role,
									(typeof ROLE_CONFIG)[Role],
								][]
							).map(([role, cfg]) => {
								const RIcon = cfg.icon;
								return (
									<div
										key={role}
										className="flex items-start gap-3 border-b py-3 last:border-b-0"
									>
										<RIcon
											className={`size-4 mt-0.5 shrink-0 ${cfg.color}`}
										/>
										<div>
											<span className="text-sm font-medium">
												{cfg.label}
											</span>
											<p className="text-xs text-muted-foreground">
												{ROLE_DESCRIPTIONS[role]}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Remove confirmation */}
			<Dialog
				open={confirmRemove !== null}
				onOpenChange={(open) => !open && setConfirmRemove(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Warning className="size-5 text-destructive" />
							Remove Team Member
						</DialogTitle>
						<DialogDescription>
							This member will lose access to your organization immediately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConfirmRemove(null)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								confirmRemove && handleRemove(confirmRemove)
							}
						>
							Remove
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
