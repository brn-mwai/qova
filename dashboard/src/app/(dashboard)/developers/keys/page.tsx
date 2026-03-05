"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
	Key,
	Plus,
	Copy,
	Trash,
	ArrowCounterClockwise,
	ShieldCheck,
	Warning,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";

const AVAILABLE_SCOPES = [
	{ id: "agents:read", label: "Read agents" },
	{ id: "agents:write", label: "Write agents" },
	{ id: "scores:read", label: "Read scores" },
	{ id: "scores:write", label: "Write scores" },
	{ id: "verify", label: "Verify agents" },
	{ id: "transactions:read", label: "Read transactions" },
] as const;

function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function ApiKeysPage(): React.ReactElement {
	const { user } = useUser();
	const userId = user?.id;

	const keys = useQuery(
		api.queries.apiKeys.listByUser,
		userId ? { userId } : "skip",
	);
	const createKey = useMutation(api.mutations.apiKeys.create);
	const revokeKey = useMutation(api.mutations.apiKeys.revoke);
	const removeKey = useMutation(api.mutations.apiKeys.remove);

	const [createOpen, setCreateOpen] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<string[]>([
		"agents:read",
		"scores:read",
	]);
	const [expiryDays, setExpiryDays] = useState<string>("never");
	const [revealedKey, setRevealedKey] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

	async function handleCreate(): Promise<void> {
		if (!newKeyName.trim() || !userId || selectedScopes.length === 0) return;
		setCreating(true);
		try {
			const expiresAt =
				expiryDays === "never"
					? undefined
					: Date.now() + Number(expiryDays) * 86400000;

			const fullKey = await createKey({
				userId,
				name: newKeyName.trim(),
				scopes: selectedScopes,
				expiresAt,
			});
			setRevealedKey(fullKey);
			setCreateOpen(false);
			setNewKeyName("");
			setSelectedScopes(["agents:read", "scores:read"]);
			setExpiryDays("never");
			toast.success("API key created. Copy it now -- it won't be shown again.");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to create key",
			);
		} finally {
			setCreating(false);
		}
	}

	async function handleRevoke(id: string): Promise<void> {
		try {
			await revokeKey({ id: id as Id<"apiKeys"> });
			toast.success("API key revoked");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to revoke");
		}
	}

	async function handleDelete(id: string): Promise<void> {
		try {
			await removeKey({ id: id as Id<"apiKeys"> });
			setConfirmDelete(null);
			toast.success("API key deleted permanently");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete");
		}
	}

	function toggleScope(scope: string): void {
		setSelectedScopes((prev) =>
			prev.includes(scope)
				? prev.filter((s) => s !== scope)
				: [...prev, scope],
		);
	}

	const activeKeys = keys?.filter((k) => k.isActive) ?? [];
	const revokedKeys = keys?.filter((k) => !k.isActive) ?? [];

	return (
		<div className="flex flex-col gap-6 py-4 md:py-6">
			<div className="px-4 lg:px-6">
				<PageHeader
					breadcrumb="Developers"
					title="API Keys"
					subtitle="Programmatic access to the Qova protocol"
					actions={
						<Dialog open={createOpen} onOpenChange={setCreateOpen}>
							<DialogTrigger asChild>
								<Button size="sm">
									<Plus className="size-4 mr-1" />
									Create Key
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create API Key</DialogTitle>
									<DialogDescription>
										Configure your key name, scopes, and expiration.
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-2">
									<div className="space-y-2">
										<Label>Key Name</Label>
										<Input
											value={newKeyName}
											onChange={(e) => setNewKeyName(e.target.value)}
											placeholder="e.g., Production, CI/CD"
										/>
									</div>

									<div className="space-y-2">
										<Label>Scopes</Label>
										<div className="grid grid-cols-2 gap-2">
											{AVAILABLE_SCOPES.map((scope) => (
												<label
													key={scope.id}
													className="flex items-center gap-2 text-sm cursor-pointer"
												>
													<Checkbox
														checked={selectedScopes.includes(scope.id)}
														onCheckedChange={() => toggleScope(scope.id)}
													/>
													{scope.label}
												</label>
											))}
										</div>
									</div>

									<div className="space-y-2">
										<Label>Expiration</Label>
										<Select value={expiryDays} onValueChange={setExpiryDays}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="never">Never expires</SelectItem>
												<SelectItem value="30">30 days</SelectItem>
												<SelectItem value="90">90 days</SelectItem>
												<SelectItem value="365">1 year</SelectItem>
											</SelectContent>
										</Select>
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
											!newKeyName.trim() ||
											selectedScopes.length === 0 ||
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

			{/* Revealed key banner */}
			{revealedKey && (
				<div className="px-4 lg:px-6">
					<div className="rounded-lg border border-score-green-border bg-score-green-bg p-4">
						<div className="flex items-start justify-between">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<ShieldCheck className="size-4 text-score-green" />
									<p className="text-sm font-medium">Your new API key</p>
								</div>
								<p className="text-xs text-muted-foreground mb-2">
									Copy this key now. It will not be shown again.
								</p>
								<code className="font-mono text-sm bg-background px-2 py-1 rounded border break-all">
									{revealedKey}
								</code>
							</div>
							<div className="flex gap-2 shrink-0 ml-4">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										navigator.clipboard.writeText(revealedKey);
										toast.success("Copied to clipboard");
									}}
								>
									<Copy className="size-3.5 mr-1" />
									Copy
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setRevealedKey(null)}
								>
									Dismiss
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Keys table */}
			<div className="px-4 lg:px-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Active Keys</CardTitle>
						<CardDescription>
							{keys === undefined
								? "Loading..."
								: `${activeKeys.length} active key${activeKeys.length !== 1 ? "s" : ""}`}
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0 pb-0">
						{keys !== undefined && activeKeys.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<Key className="size-8 text-muted-foreground mb-3" />
								<p className="text-sm text-muted-foreground">
									No API keys yet. Create one to get started.
								</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="pl-6 text-xs">Name</TableHead>
										<TableHead className="text-xs">Key</TableHead>
										<TableHead className="text-xs">Scopes</TableHead>
										<TableHead className="text-xs">Created</TableHead>
										<TableHead className="text-xs">Expires</TableHead>
										<TableHead className="pr-6 text-xs text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{activeKeys.map((key) => (
										<TableRow key={key._id}>
											<TableCell className="pl-6">
												<div className="flex items-center gap-2">
													<Key className="size-4 text-muted-foreground" />
													<span className="text-sm font-medium">
														{key.name}
													</span>
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs text-muted-foreground">
												{key.keyPrefix}...
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1">
													{key.scopes.slice(0, 2).map((scope: string) => (
														<Badge
															key={scope}
															variant="outline"
															className="text-[10px]"
														>
															{scope}
														</Badge>
													))}
													{key.scopes.length > 2 && (
														<Badge variant="outline" className="text-[10px]">
															+{key.scopes.length - 2}
														</Badge>
													)}
												</div>
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{formatDate(key.createdAt)}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{key.expiresAt
													? formatDate(key.expiresAt)
													: "Never"}
											</TableCell>
											<TableCell className="pr-6 text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="sm"
														className="size-7 p-0 text-muted-foreground hover:text-yellow-500"
														title="Revoke"
														onClick={() => handleRevoke(key._id)}
													>
														<ArrowCounterClockwise className="size-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="size-7 p-0 text-muted-foreground hover:text-destructive"
														title="Delete"
														onClick={() => setConfirmDelete(key._id)}
													>
														<Trash className="size-3.5" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Revoked keys */}
			{revokedKeys.length > 0 && (
				<div className="px-4 lg:px-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Revoked Keys</CardTitle>
							<CardDescription>
								{revokedKeys.length} revoked key
								{revokedKeys.length !== 1 ? "s" : ""}
							</CardDescription>
						</CardHeader>
						<CardContent className="px-0 pb-0">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="pl-6 text-xs">Name</TableHead>
										<TableHead className="text-xs">Key</TableHead>
										<TableHead className="text-xs">Revoked</TableHead>
										<TableHead className="pr-6 text-xs text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{revokedKeys.map((key) => (
										<TableRow
											key={key._id}
											className="text-muted-foreground opacity-60"
										>
											<TableCell className="pl-6">
												<div className="flex items-center gap-2">
													<Key className="size-4" />
													<span className="text-sm">{key.name}</span>
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs">
												{key.keyPrefix}...
											</TableCell>
											<TableCell className="text-xs">
												{formatDate(key.createdAt)}
											</TableCell>
											<TableCell className="pr-6 text-right">
												<Button
													variant="ghost"
													size="sm"
													className="size-7 p-0 hover:text-destructive"
													title="Delete permanently"
													onClick={() => setConfirmDelete(key._id)}
												>
													<Trash className="size-3.5" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Delete confirmation dialog */}
			<Dialog
				open={confirmDelete !== null}
				onOpenChange={(open) => !open && setConfirmDelete(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Warning className="size-5 text-destructive" />
							Delete API Key
						</DialogTitle>
						<DialogDescription>
							This will permanently delete this API key. Any applications using
							it will lose access immediately. This cannot be undone.
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
