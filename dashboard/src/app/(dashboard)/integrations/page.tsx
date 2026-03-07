"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
	Plugs,
	CheckCircle,
	ArrowRight,
	ArrowSquareOut,
	MagnifyingGlass,
	Power,
	Lightning,
	SpinnerGap,
	Clock,
	ShieldCheck,
	Warning,
} from "@phosphor-icons/react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type IntegrationCategory =
	| "blockchain"
	| "payment"
	| "notification"
	| "ai-framework"
	| "analytics"
	| "identity";

interface ConfigField {
	label: string;
	placeholder: string;
	key: string;
	type?: "text" | "password" | "url";
	helpText?: string;
}

interface IntegrationDef {
	id: string;
	name: string;
	description: string;
	category: IntegrationCategory;
	logo: string;
	docsUrl?: string;
	configFields?: ConfigField[];
	/** Core integrations are always active - they're built into the platform. */
	core?: boolean;
	/** What this integration is actively doing in the platform. */
	activeLabel?: string;
}

const CATEGORY_CONFIG: Record<
	IntegrationCategory,
	{ label: string; color: string }
> = {
	blockchain: { label: "Blockchain", color: "text-blue-400" },
	payment: { label: "Payment", color: "text-score-green" },
	notification: { label: "Notification", color: "text-purple-400" },
	"ai-framework": { label: "AI Framework", color: "text-score-yellow" },
	analytics: { label: "Analytics", color: "text-orange-400" },
	identity: { label: "Identity", color: "text-cyan-400" },
};

const INTEGRATIONS: IntegrationDef[] = [
	// ── Blockchain ──
	{
		id: "base-rpc",
		name: "Base",
		description:
			"Primary L2 network for Qova smart contracts. All agent scores, transactions, and budget enforcement run on Base.",
		category: "blockchain",
		logo: "/integrations/base.png",
		docsUrl: "https://docs.base.org",
		core: true,
		activeLabel: "4 contracts deployed on Base Sepolia",
		configFields: [
			{
				label: "Custom RPC URL (optional)",
				placeholder: "https://mainnet.base.org",
				key: "rpcUrl",
				type: "url",
				helpText: "Override the default public RPC. Leave blank to use Qova's default.",
			},
		],
	},
	{
		id: "chainlink-cre",
		name: "Chainlink CRE",
		description:
			"Compute Runtime Environment powers Qova's decentralized scoring. Workflows run across Chainlink oracle nodes to compute agent credit scores.",
		category: "blockchain",
		logo: "/integrations/chainlink.png",
		docsUrl: "https://docs.chain.link",
		core: true,
		activeLabel: "5 scoring workflows active",
	},
	{
		id: "skale-base",
		name: "SKALE Base",
		description:
			"SKALE L3 on Base with zero gas fees, instant finality, and encrypted transactions. Pre-paid compute credits replace variable gas costs.",
		category: "blockchain",
		logo: "/integrations/skale.png",
		docsUrl: "https://docs.skale.space",
		core: true,
		activeLabel: "CREDIT-powered, zero gas",
	},
	// ── Payment ──
	{
		id: "x402",
		name: "x402 Protocol",
		description:
			"HTTP-native micropayment protocol for agent-to-agent transactions. Every x402 payment is automatically recorded and scored by Qova.",
		category: "payment",
		logo: "/integrations/x402.svg",
		docsUrl: "https://www.x402.org",
		core: true,
		activeLabel: "Recording agent payment flows",
		configFields: [
			{
				label: "Facilitator Address (optional override)",
				placeholder: "0x...",
				key: "facilitator",
				helpText: "Override the default x402 facilitator contract address.",
			},
		],
	},
	{
		id: "coinbase-wallet",
		name: "Coinbase",
		description:
			"Agent wallet infrastructure via Coinbase Developer Platform. Wallet creation, USDC flows, and balance monitoring are built into Qova.",
		category: "payment",
		logo: "/integrations/coinbase.png",
		docsUrl: "https://docs.cdp.coinbase.com",
		core: true,
		activeLabel: "CDP wallet management active",
		configFields: [
			{
				label: "CDP API Key (optional override)",
				placeholder: "organizations/xxx/apiKeys/xxx",
				key: "apiKey",
				type: "password",
				helpText: "Provide your own CDP key to use your Coinbase organization. Leave blank to use Qova's managed key.",
			},
		],
	},
	// ── Notification ──
	{
		id: "slack",
		name: "Slack",
		description:
			"Real-time alerts to Slack channels: score changes, budget warnings, CRE execution results, and verification events.",
		category: "notification",
		logo: "/integrations/slack.png",
		docsUrl: "https://api.slack.com/messaging/webhooks",
		configFields: [
			{
				label: "Webhook URL",
				placeholder: "https://hooks.slack.com/services/T.../B.../xxx",
				key: "webhookUrl",
				type: "url",
				helpText: "Create an Incoming Webhook in your Slack workspace settings.",
			},
			{
				label: "Channel",
				placeholder: "#qova-alerts",
				key: "channel",
			},
		],
	},
	{
		id: "telegram",
		name: "Telegram",
		description:
			"Receive instant notifications via Telegram bot. Query agent scores, get budget alerts, and monitor CRE executions on mobile.",
		category: "notification",
		logo: "/integrations/telegram.png",
		docsUrl: "https://core.telegram.org/bots/api",
		configFields: [
			{
				label: "Bot Token",
				placeholder: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ",
				key: "botToken",
				type: "password",
				helpText: "Get a token from @BotFather on Telegram.",
			},
			{
				label: "Chat ID",
				placeholder: "-1001234567890",
				key: "chatId",
				helpText: "Group or channel ID. Use @userinfobot to find yours.",
			},
		],
	},
	{
		id: "discord",
		name: "Discord",
		description:
			"Push score updates, budget alerts, and system notifications to Discord channels via webhooks.",
		category: "notification",
		logo: "/integrations/discord.png",
		docsUrl: "https://discord.com/developers/docs/resources/webhook",
		configFields: [
			{
				label: "Webhook URL",
				placeholder: "https://discord.com/api/webhooks/...",
				key: "webhookUrl",
				type: "url",
			},
		],
	},
	// ── AI Frameworks ──
	{
		id: "openai-agents",
		name: "OpenAI Agents SDK",
		description:
			"Embed Qova trust checks into OpenAI agent pipelines. Gate tool calls, validate counterparties, and log trust decisions.",
		category: "ai-framework",
		logo: "/integrations/openai.png",
		docsUrl: "https://platform.openai.com/docs",
		configFields: [
			{
				label: "API Key",
				placeholder: "sk-proj-xxxxx",
				key: "apiKey",
				type: "password",
				helpText: "OpenAI API key. Used to validate connectivity only.",
			},
		],
	},
	{
		id: "langchain",
		name: "LangChain",
		description:
			"Use Qova as a LangChain tool for trust-gated operations. Agents check counterparty scores before executing transactions.",
		category: "ai-framework",
		logo: "/integrations/langchain.png",
		docsUrl: "https://docs.langchain.com",
	},
	{
		id: "vercel-ai-sdk",
		name: "Vercel AI SDK",
		description:
			"Add Qova credit checks as tool calls in Vercel AI SDK agent workflows. Verify trust inline during conversations.",
		category: "ai-framework",
		logo: "/integrations/vercel.png",
		docsUrl: "https://sdk.vercel.ai/docs",
	},
	// ── Analytics ──
	{
		id: "dune-analytics",
		name: "Dune Analytics",
		description:
			"Export on-chain score data, CRE execution metrics, and transaction volumes to custom Dune dashboards.",
		category: "analytics",
		logo: "/integrations/dune.png",
		docsUrl: "https://docs.dune.com",
	},
	// ── Identity ──
	{
		id: "world-id",
		name: "World ID",
		description:
			"Verify agent operators are unique humans via World ID proof of personhood. Boost trust scores for verified identities.",
		category: "identity",
		logo: "/integrations/worldid.png",
		docsUrl: "https://docs.world.org",
	},
];

type DisplayStatus = "core" | "connected" | "available" | "coming_soon";

const STATUS_CONFIG: Record<
	DisplayStatus,
	{ label: string; class: string }
> = {
	core: {
		label: "Active",
		class: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	},
	connected: {
		label: "Connected",
		class: "bg-score-green/10 text-score-green border-score-green/20",
	},
	available: {
		label: "Available",
		class: "bg-chart-2/10 text-chart-2 border-chart-2/20",
	},
	coming_soon: {
		label: "Coming Soon",
		class: "bg-muted text-muted-foreground",
	},
};

function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export default function IntegrationsPage(): React.ReactElement {
	const connectedIntegrations = useQuery(api.integrationConfigs.list);
	const connectMutation = useMutation(api.integrationConfigs.connect);
	const disconnectMutation = useMutation(api.integrationConfigs.disconnect);

	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [configOpen, setConfigOpen] = useState<string | null>(null);
	const [configValues, setConfigValues] = useState<Record<string, string>>({});
	const [connecting, setConnecting] = useState(false);
	const [testing, setTesting] = useState(false);

	const testSlack = useAction(api.actions.integrationTest.testSlack);
	const testTelegram = useAction(api.actions.integrationTest.testTelegram);
	const testX402 = useAction(api.actions.integrationTest.testX402);
	const testCoinbase = useAction(api.actions.integrationTest.testCoinbase);
	const testOpenAI = useAction(api.actions.integrationTest.testOpenAI);

	const TEST_ACTIONS: Record<string, (args: { integrationId: string }) => Promise<{ success: boolean; message: string; duration: number }>> = {
		slack: testSlack,
		telegram: testTelegram,
		x402: testX402,
		"coinbase-wallet": testCoinbase,
		"openai-agents": testOpenAI,
	};

	async function handleTest(): Promise<void> {
		if (!selectedIntegration) return;
		const testFn = TEST_ACTIONS[selectedIntegration.id];
		if (!testFn) return;
		setTesting(true);
		try {
			const result = await testFn({ integrationId: selectedIntegration.id });
			if (result.success) {
				toast.success(result.message, { description: `Completed in ${result.duration}ms` });
			} else {
				toast.error(result.message, { description: `Failed after ${result.duration}ms` });
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Test failed");
		} finally {
			setTesting(false);
		}
	}

	const connectedMap = useMemo(() => {
		const map = new Map<string, { isActive: boolean; lastSyncAt?: number; createdAt: number }>();
		if (connectedIntegrations) {
			for (const ci of connectedIntegrations) {
				if (ci.isActive) map.set(ci.type, { isActive: ci.isActive, lastSyncAt: ci.lastSyncAt, createdAt: ci.createdAt });
			}
		}
		return map;
	}, [connectedIntegrations]);

	function getStatus(def: IntegrationDef): DisplayStatus {
		if (def.core) return "core";
		if (connectedMap.has(def.id)) return "connected";
		if (def.configFields) return "available";
		return "coming_soon";
	}

	const coreCount = INTEGRATIONS.filter((i) => i.core).length;
	const connectedCount = INTEGRATIONS.filter(
		(i) => getStatus(i) === "connected",
	).length;
	const availableCount = INTEGRATIONS.filter(
		(i) => getStatus(i) === "available",
	).length;

	const filtered = INTEGRATIONS.filter((i) => {
		const matchesSearch =
			search.length === 0 ||
			i.name.toLowerCase().includes(search.toLowerCase()) ||
			i.description.toLowerCase().includes(search.toLowerCase());
		const matchesCategory =
			categoryFilter === "all" || i.category === categoryFilter;
		return matchesSearch && matchesCategory;
	});

	const selectedIntegration = configOpen
		? INTEGRATIONS.find((i) => i.id === configOpen)
		: null;
	const selectedIsConnected = selectedIntegration
		? connectedMap.has(selectedIntegration.id)
		: false;
	const selectedConnInfo = selectedIntegration
		? connectedMap.get(selectedIntegration.id)
		: undefined;

	async function handleConnect(): Promise<void> {
		if (!selectedIntegration) return;

		// Validate required fields
		if (selectedIntegration.configFields) {
			const missing = selectedIntegration.configFields.filter(
				(f) => !configValues[f.key]?.trim(),
			);
			if (missing.length > 0) {
				toast.error(`Missing required field: ${missing[0].label}`);
				return;
			}
		}

		setConnecting(true);
		try {
			await connectMutation({
				integrationId: selectedIntegration.id,
				name: selectedIntegration.name,
				config: JSON.stringify(configValues),
			});
			toast.success(`${selectedIntegration.name} connected successfully`);
			setConfigOpen(null);
			setConfigValues({});
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to connect",
			);
		} finally {
			setConnecting(false);
		}
	}

	async function handleDisconnect(): Promise<void> {
		if (!selectedIntegration) return;
		setConnecting(true);
		try {
			await disconnectMutation({
				integrationId: selectedIntegration.id,
			});
			toast.success(`${selectedIntegration.name} disconnected`);
			setConfigOpen(null);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to disconnect",
			);
		} finally {
			setConnecting(false);
		}
	}

	const categories = [
		{ key: "all", label: "All" },
		{ key: "blockchain", label: "Blockchain" },
		{ key: "payment", label: "Payment" },
		{ key: "notification", label: "Notification" },
		{ key: "ai-framework", label: "AI Framework" },
		{ key: "analytics", label: "Analytics" },
		{ key: "identity", label: "Identity" },
	];

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex flex-col gap-4 sm:gap-6 py-4 md:py-6">
				<div className="px-4 lg:px-6">
					<PageHeader
						breadcrumb="Operations"
						title="Integrations"
						subtitle={`${coreCount} core active, ${connectedCount} connected, ${availableCount} available`}
					info={{
						description: "Connect third-party services to enhance your Qova experience. Core integrations are built into the platform and always active. Optional integrations can be connected with your own credentials.",
						sections: [
							{ title: "Core Integrations", description: "Base, Chainlink CRE, SKALE, x402, and Coinbase are built into Qova. They power scoring, payments, and wallet management automatically." },
							{ title: "Optional Integrations", description: "Connect notification channels (Slack, Telegram, Discord), AI frameworks, and analytics tools with your own API keys." },
							{ title: "Test Connection", description: "After connecting, use the Test button to verify your credentials are working correctly." },
						],
					}}
					/>
				</div>

				{/* Stats Row */}
				<div className="px-4 lg:px-6 flex gap-2 sm:gap-3 flex-wrap">
					<div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border bg-card px-2.5 sm:px-3 py-1.5 sm:py-2">
						<ShieldCheck className="size-3.5 sm:size-4 text-blue-400" weight="fill" />
						<span className="text-[11px] sm:text-xs font-medium">{coreCount} Core</span>
					</div>
					{connectedCount > 0 && (
						<div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border bg-card px-2.5 sm:px-3 py-1.5 sm:py-2">
							<CheckCircle className="size-3.5 sm:size-4 text-score-green" weight="fill" />
							<span className="text-[11px] sm:text-xs font-medium">{connectedCount} Connected</span>
						</div>
					)}
					<div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border bg-card px-2.5 sm:px-3 py-1.5 sm:py-2">
						<Plugs className="size-3.5 sm:size-4 text-muted-foreground" />
						<span className="text-[11px] sm:text-xs font-medium">{availableCount} Available</span>
					</div>
				</div>

				{/* Search + Filters */}
				<div className="px-4 lg:px-6 space-y-3">
					<div className="relative w-full sm:max-w-sm">
						<MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="Search integrations..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<div className="flex gap-1.5 sm:gap-2 flex-wrap">
						{categories.map((f) => {
							const count = f.key === "all"
								? INTEGRATIONS.length
								: INTEGRATIONS.filter((i) => i.category === f.key).length;
							return (
								<button
									key={f.key}
									type="button"
									onClick={() => setCategoryFilter(f.key)}
									className={`rounded-full border px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer ${
										categoryFilter === f.key
											? "bg-foreground text-background"
											: "hover:bg-accent text-muted-foreground"
									}`}
								>
									{f.label}
									<span className="ml-1 sm:ml-1.5 opacity-60">{count}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Integration Grid */}
				<div className="px-4 lg:px-6">
					<div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{filtered.map((integration) => {
							const status = getStatus(integration);
							const statusCfg = STATUS_CONFIG[status];
							const catCfg = CATEGORY_CONFIG[integration.category];
							const connInfo = connectedMap.get(integration.id);
							const hasTest = !!TEST_ACTIONS[integration.id];
							return (
								<Card key={integration.id} className="group relative flex flex-col overflow-hidden">
									<CardHeader className="pb-3 px-3 sm:px-4 pt-3 sm:pt-4">
										<div className="flex items-start gap-2.5 sm:gap-3">
											<div className="rounded-lg border p-1 sm:p-1.5 bg-muted overflow-hidden shrink-0">
												<Image
													src={integration.logo}
													alt={integration.name}
													width={28}
													height={28}
													className="size-6 sm:size-7 rounded object-contain"
												/>
											</div>
											<div className="min-w-0 flex-1">
												<CardTitle className="text-sm flex items-center gap-1.5">
													<span className="truncate">{integration.name}</span>
													{integration.docsUrl && (
														<Tooltip>
															<TooltipTrigger asChild>
																<a
																	href={integration.docsUrl}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 shrink-0"
																	onClick={(e) => e.stopPropagation()}
																>
																	<ArrowSquareOut size={12} />
																</a>
															</TooltipTrigger>
															<TooltipContent>View docs</TooltipContent>
														</Tooltip>
													)}
												</CardTitle>
												<div className="flex items-center gap-1.5 mt-1 flex-wrap">
													<Badge
														variant="outline"
														className={`text-[10px] ${statusCfg.class}`}
													>
														{(status === "connected" || status === "core") && (
															<CheckCircle
																className="size-3 mr-0.5"
																weight="fill"
															/>
														)}
														{status === "core" ? "Core" : statusCfg.label}
													</Badge>
													{hasTest && status === "connected" && (
														<Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/20 bg-blue-400/10">
															<Lightning className="size-3 mr-0.5" weight="fill" />
															Testable
														</Badge>
													)}
												</div>
											</div>
										</div>
									</CardHeader>
									<CardContent className="pb-3 sm:pb-4 px-3 sm:px-4 flex flex-col flex-1">
										<CardDescription className="text-xs line-clamp-2 mb-3 flex-1">
											{integration.description}
										</CardDescription>
										{status === "core" && integration.activeLabel && (
											<div className="flex items-center gap-1.5 mb-3 rounded-md bg-blue-500/5 border border-blue-500/10 px-2 sm:px-2.5 py-1.5 min-w-0">
												<div className="size-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
												<span className="text-[10px] sm:text-[11px] text-blue-400 font-medium truncate">{integration.activeLabel}</span>
											</div>
										)}
										<div className="flex items-center justify-between gap-2 mt-auto">
											<span
												className={`text-[10px] font-medium shrink-0 ${catCfg.color}`}
											>
												{catCfg.label}
											</span>
											<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
												{connInfo?.lastSyncAt && (
													<Tooltip>
														<TooltipTrigger asChild>
															<span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
																<Clock size={10} />
																{timeAgo(connInfo.lastSyncAt)}
															</span>
														</TooltipTrigger>
														<TooltipContent>
															Last synced: {new Date(connInfo.lastSyncAt).toLocaleString()}
														</TooltipContent>
													</Tooltip>
												)}
												{status === "core" && integration.configFields ? (
													<Button
														variant="ghost"
														size="sm"
														className="h-6 sm:h-7 text-[11px] sm:text-xs px-2 sm:px-3"
														onClick={() => setConfigOpen(integration.id)}
													>
														Override
														<ArrowRight className="size-3 ml-0.5 sm:ml-1" />
													</Button>
												) : status === "core" ? (
													<span className="text-[10px] text-blue-400 font-medium">Built-in</span>
												) : status === "connected" ? (
													<Button
														variant="ghost"
														size="sm"
														className="h-6 sm:h-7 text-[11px] sm:text-xs px-2 sm:px-3"
														onClick={() => setConfigOpen(integration.id)}
													>
														Configure
														<ArrowRight className="size-3 ml-0.5 sm:ml-1" />
													</Button>
												) : status === "available" ? (
													<Button
														variant="outline"
														size="sm"
														className="h-6 sm:h-7 text-[11px] sm:text-xs px-2 sm:px-3"
														onClick={() => setConfigOpen(integration.id)}
													>
														Connect
													</Button>
												) : (
													<span className="text-[10px] text-muted-foreground">
														Coming soon
													</span>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>

					{filtered.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<Plugs className="size-8 text-muted-foreground mb-2" />
							<p className="text-sm font-medium">No integrations found</p>
							<p className="text-xs text-muted-foreground">
								Try adjusting your search or filter.
							</p>
						</div>
					)}
				</div>

				{/* Config Dialog */}
				<Dialog
					open={!!configOpen}
					onOpenChange={(v) => {
						if (!v) {
							setConfigOpen(null);
							setConfigValues({});
						}
					}}
				>
					{selectedIntegration && (
						<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2.5 sm:gap-3">
									<div className="rounded-lg border p-1.5 bg-muted overflow-hidden shrink-0">
										<Image
											src={selectedIntegration.logo}
											alt={selectedIntegration.name}
											width={24}
											height={24}
											className="size-6 rounded object-contain"
										/>
									</div>
									<div className="min-w-0">
										<span className="truncate">{selectedIntegration.name}</span>
										{selectedIsConnected && (
											<Badge variant="outline" className="ml-2 text-[10px] bg-score-green/10 text-score-green border-score-green/20">
												Connected
											</Badge>
										)}
									</div>
								</DialogTitle>
								<DialogDescription className="text-xs sm:text-sm">
									{selectedIntegration.description}
								</DialogDescription>
							</DialogHeader>

							{/* Connection info */}
							{selectedConnInfo && (
								<div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:justify-between">
									<span className="flex items-center gap-1.5">
										<Clock size={12} className="shrink-0" />
										Connected {timeAgo(selectedConnInfo.createdAt)}
									</span>
									{selectedConnInfo.lastSyncAt && (
										<span>Last sync: {timeAgo(selectedConnInfo.lastSyncAt)}</span>
									)}
								</div>
							)}

							{selectedIntegration.configFields ? (
								<div className="space-y-4 py-2">
									{selectedIntegration.configFields.map((field) => (
										<div key={field.key} className="space-y-1.5">
											<Label className="text-xs">{field.label}</Label>
											<Input
												type={field.type ?? "text"}
												placeholder={field.placeholder}
												value={configValues[field.key] ?? ""}
												onChange={(e) =>
													setConfigValues((prev) => ({
														...prev,
														[field.key]: e.target.value,
													}))
												}
											/>
											{field.helpText && (
												<p className="text-[11px] text-muted-foreground">{field.helpText}</p>
											)}
										</div>
									))}
								</div>
							) : (
								<div className="py-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
									<Warning className="size-5" />
									This integration does not require configuration yet.
									{selectedIntegration.docsUrl && (
										<a
											href={selectedIntegration.docsUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs underline hover:text-foreground transition-colors"
										>
											View documentation
										</a>
									)}
								</div>
							)}
							<DialogFooter className="flex-col sm:flex-row gap-2">
								{selectedIsConnected && TEST_ACTIONS[selectedIntegration.id] && (
									<Button
										variant="outline"
										onClick={handleTest}
										disabled={testing}
										className="w-full sm:w-auto"
									>
										{testing ? (
											<SpinnerGap className="size-4 mr-1.5 animate-spin" />
										) : (
											<Lightning className="size-4 mr-1.5" weight="fill" />
										)}
										{testing ? "Testing..." : "Test Connection"}
									</Button>
								)}
								{selectedIsConnected && (
									<Button
										variant="outline"
										onClick={handleDisconnect}
										disabled={connecting}
										className="text-destructive hover:text-destructive w-full sm:w-auto"
									>
										<Power className="size-4 mr-1.5" />
										Disconnect
									</Button>
								)}
								<div className="flex-1" />
								<Button
									variant="outline"
									onClick={() => {
										setConfigOpen(null);
										setConfigValues({});
									}}
								>
									Cancel
								</Button>
								{!selectedIsConnected && selectedIntegration.configFields && (
									<Button
										onClick={handleConnect}
										disabled={connecting}
									>
										{connecting ? (
											<>
												<SpinnerGap className="size-4 mr-1.5 animate-spin" />
												Connecting...
											</>
										) : (
											"Connect"
										)}
									</Button>
								)}
								{selectedIsConnected &&
									selectedIntegration.configFields && (
										<Button
											onClick={handleConnect}
											disabled={connecting}
										>
											{connecting ? (
												<>
													<SpinnerGap className="size-4 mr-1.5 animate-spin" />
													Saving...
												</>
											) : (
												"Save Changes"
											)}
										</Button>
									)}
							</DialogFooter>
						</DialogContent>
					)}
				</Dialog>
			</div>
		</TooltipProvider>
	);
}
