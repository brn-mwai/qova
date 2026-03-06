"use client";

import {
	ArrowsLeftRight,
	ArrowUp,
	ArrowDown,
	Coins,
	Bridge,
	CheckCircle,
	Flame,
	PlusCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const TX_TYPE_CONFIG: Record<
	string,
	{ icon: React.ElementType; colorClass: string; bgClass: string }
> = {
	Swap: {
		icon: ArrowsLeftRight,
		colorClass: "text-blue-400",
		bgClass: "bg-blue-400/10 border-blue-400/20",
	},
	Transfer: {
		icon: ArrowUp,
		colorClass: "text-emerald-400",
		bgClass: "bg-emerald-400/10 border-emerald-400/20",
	},
	Stake: {
		icon: Coins,
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400/10 border-amber-400/20",
	},
	Unstake: {
		icon: ArrowDown,
		colorClass: "text-orange-400",
		bgClass: "bg-orange-400/10 border-orange-400/20",
	},
	Bridge: {
		icon: Bridge,
		colorClass: "text-violet-400",
		bgClass: "bg-violet-400/10 border-violet-400/20",
	},
	Approve: {
		icon: CheckCircle,
		colorClass: "text-cyan-400",
		bgClass: "bg-cyan-400/10 border-cyan-400/20",
	},
	Mint: {
		icon: PlusCircle,
		colorClass: "text-pink-400",
		bgClass: "bg-pink-400/10 border-pink-400/20",
	},
	Burn: {
		icon: Flame,
		colorClass: "text-red-400",
		bgClass: "bg-red-400/10 border-red-400/20",
	},
};

const DEFAULT_CONFIG = {
	icon: ArrowsLeftRight,
	colorClass: "text-muted-foreground",
	bgClass: "bg-muted border-border",
};

interface TxTypeBadgeProps {
	type: string;
	className?: string;
}

export function TxTypeBadge({ type, className }: TxTypeBadgeProps): React.ReactElement {
	const config = TX_TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
				config.bgClass,
				config.colorClass,
				className,
			)}
		>
			<Icon size={12} weight="bold" />
			{type}
		</span>
	);
}
