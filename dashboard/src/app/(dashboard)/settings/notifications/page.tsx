"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
	Bell,
	ChartLineUp,
	Wallet,
	ShieldCheck,
	Gear,
	EnvelopeSimple,
	DeviceMobile,
	FloppyDisk,
} from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface LocalPrefs {
	emailScoreAlerts: boolean;
	emailBudgetAlerts: boolean;
	emailSecurityAlerts: boolean;
	emailWeeklyDigest: boolean;
	pushScoreAlerts: boolean;
	pushBudgetAlerts: boolean;
	pushSecurityAlerts: boolean;
	defaultChartRange: string;
	compactView: boolean;
	timezone: string;
}

const DEFAULT_PREFS: LocalPrefs = {
	emailScoreAlerts: true,
	emailBudgetAlerts: true,
	emailSecurityAlerts: true,
	emailWeeklyDigest: true,
	pushScoreAlerts: true,
	pushBudgetAlerts: true,
	pushSecurityAlerts: false,
	defaultChartRange: "30d",
	compactView: false,
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export default function NotificationSettingsPage(): React.ReactElement {
	const { user } = useUser();

	const settings = useQuery(api.userSettings.get);
	const saveSettings = useMutation(api.userSettings.save);

	const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_PREFS);
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);

	// Hydrate from Convex when data loads
	useEffect(() => {
		if (settings) {
			setPrefs({
				emailScoreAlerts: settings.emailScoreAlerts,
				emailBudgetAlerts: settings.emailBudgetAlerts,
				emailSecurityAlerts: settings.emailSecurityAlerts,
				emailWeeklyDigest: settings.emailWeeklyDigest,
				pushScoreAlerts: settings.pushScoreAlerts,
				pushBudgetAlerts: settings.pushBudgetAlerts,
				pushSecurityAlerts: settings.pushSecurityAlerts,
				defaultChartRange: settings.defaultChartRange,
				compactView: settings.compactView,
				timezone: settings.timezone,
			});
		}
	}, [settings]);

	function update<K extends keyof LocalPrefs>(
		key: K,
		value: LocalPrefs[K],
	): void {
		setPrefs((prev) => ({ ...prev, [key]: value }));
		setDirty(true);
	}

	async function handleSave(): Promise<void> {
		setSaving(true);
		try {
			await saveSettings(prefs);
			setDirty(false);
			toast.success("Preferences saved");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save preferences",
			);
		} finally {
			setSaving(false);
		}
	}

	const NOTIF_ROWS = [
		{
			label: "Score Changes",
			description:
				"When an agent's trust score is upgraded or downgraded.",
			icon: ChartLineUp,
			iconColor: "text-chart-2",
			emailKey: "emailScoreAlerts" as const,
			pushKey: "pushScoreAlerts" as const,
		},
		{
			label: "Budget Alerts",
			description:
				"When an agent exceeds or approaches budget limits.",
			icon: Wallet,
			iconColor: "text-score-yellow",
			emailKey: "emailBudgetAlerts" as const,
			pushKey: "pushBudgetAlerts" as const,
		},
		{
			label: "Security Alerts",
			description: "Verification results, anomalies, and security events.",
			icon: ShieldCheck,
			iconColor: "text-score-green",
			emailKey: "emailSecurityAlerts" as const,
			pushKey: "pushSecurityAlerts" as const,
		},
	];

	return (
		<div className="px-4 lg:px-6">
			<div className="mx-auto max-w-3xl w-full space-y-6">
				{/* Notification Types */}
				<Card>
					<CardHeader>
						<CardTitle className="text-sm flex items-center gap-2">
							<Bell size={16} />
							Notification Preferences
						</CardTitle>
						<CardDescription>
							Choose which notifications you receive and how. Email delivery
							is active when configured. Push notifications coming soon.
							In-app notifications are always enabled.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{/* Channel headers */}
						<div className="flex items-center gap-4 pb-3 border-b mb-1">
							<div className="flex-1" />
							<div className="w-16 text-center">
								<div className="flex flex-col items-center gap-0.5">
									<EnvelopeSimple className="size-3.5 text-muted-foreground" />
									<span className="text-[10px] text-muted-foreground font-medium">
										Email
									</span>
								</div>
							</div>
							<div className="w-16 text-center">
								<div className="flex flex-col items-center gap-0.5">
									<DeviceMobile className="size-3.5 text-muted-foreground" />
									<span className="text-[10px] text-muted-foreground font-medium">
										Push
									</span>
								</div>
							</div>
						</div>

						{/* Notification rows */}
						{NOTIF_ROWS.map((row) => {
							const Icon = row.icon;
							return (
								<div
									key={row.emailKey}
									className="flex items-center gap-4 py-3 border-b last:border-b-0"
								>
									<div className="flex-1 flex items-start gap-3 min-w-0">
										<Icon
											className={`size-4 mt-0.5 shrink-0 ${row.iconColor}`}
										/>
										<div className="min-w-0">
											<p className="text-sm font-medium">{row.label}</p>
											<p className="text-xs text-muted-foreground">
												{row.description}
											</p>
										</div>
									</div>
									<div className="w-16 flex justify-center">
										<Switch
											checked={prefs[row.emailKey]}
											onCheckedChange={(v) => update(row.emailKey, v)}
										/>
									</div>
									<div className="w-16 flex justify-center">
										<Switch
											checked={prefs[row.pushKey]}
											onCheckedChange={(v) => update(row.pushKey, v)}
											disabled
											title="Push notifications coming soon"
										/>
									</div>
								</div>
							);
						})}
					</CardContent>
				</Card>

				{/* Weekly Digest */}
				<Card>
					<CardHeader>
						<CardTitle className="text-sm flex items-center gap-2">
							<EnvelopeSimple size={16} />
							Weekly Digest
						</CardTitle>
						<CardDescription>
							Receive a weekly summary of all activity in your dashboard.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label htmlFor="digest-toggle">
									Enable Weekly Digest
								</Label>
								<p className="text-xs text-muted-foreground">
									Sent every Monday morning with a summary of the past week.
								</p>
							</div>
							<Switch
								id="digest-toggle"
								checked={prefs.emailWeeklyDigest}
								onCheckedChange={(v) =>
									update("emailWeeklyDigest", v)
								}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Display Preferences */}
				<Card>
					<CardHeader>
						<CardTitle className="text-sm flex items-center gap-2">
							<Gear size={16} />
							Display Preferences
						</CardTitle>
						<CardDescription>
							Customize how data is displayed in your dashboard.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label>Default Chart Range</Label>
								<p className="text-xs text-muted-foreground">
									Default time range for all charts and graphs.
								</p>
							</div>
							<Select
								value={prefs.defaultChartRange}
								onValueChange={(v) =>
									update("defaultChartRange", v)
								}
							>
								<SelectTrigger className="w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="7d">7 days</SelectItem>
									<SelectItem value="30d">30 days</SelectItem>
									<SelectItem value="90d">90 days</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label htmlFor="compact-view">Compact View</Label>
								<p className="text-xs text-muted-foreground">
									Reduce spacing and show more data in tables.
								</p>
							</div>
							<Switch
								id="compact-view"
								checked={prefs.compactView}
								onCheckedChange={(v) => update("compactView", v)}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label>Timezone</Label>
								<p className="text-xs text-muted-foreground">
									Used for timestamps and scheduled digests.
								</p>
							</div>
							<Select
								value={prefs.timezone}
								onValueChange={(v) => update("timezone", v)}
							>
								<SelectTrigger className="w-52">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="America/New_York">
										Eastern (ET)
									</SelectItem>
									<SelectItem value="America/Chicago">
										Central (CT)
									</SelectItem>
									<SelectItem value="America/Denver">
										Mountain (MT)
									</SelectItem>
									<SelectItem value="America/Los_Angeles">
										Pacific (PT)
									</SelectItem>
									<SelectItem value="Europe/London">
										London (GMT)
									</SelectItem>
									<SelectItem value="Europe/Berlin">
										Berlin (CET)
									</SelectItem>
									<SelectItem value="Asia/Tokyo">
										Tokyo (JST)
									</SelectItem>
									<SelectItem value="Africa/Nairobi">
										Nairobi (EAT)
									</SelectItem>
									<SelectItem value="UTC">UTC</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardContent>
				</Card>

				{/* Save */}
				<div className="flex justify-end pb-6">
					<Button
						onClick={handleSave}
						disabled={!dirty || saving}
					>
						<FloppyDisk className="size-4 mr-1" />
						{saving ? "Saving..." : "Save Preferences"}
					</Button>
				</div>
			</div>
		</div>
	);
}
