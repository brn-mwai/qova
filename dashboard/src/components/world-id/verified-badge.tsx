"use client";

import { Globe, ShieldCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VerifiedHumanBadgeProps {
	/** Size variant */
	size?: "xs" | "sm" | "md";
	/** Show the globe icon instead of shield */
	variant?: "shield" | "globe";
	className?: string;
}

/**
 * Badge indicating an agent's owner has been verified via World ID.
 * Displayed on agent cards and detail pages.
 */
export function VerifiedHumanBadge({
	size = "sm",
	variant = "globe",
	className,
}: VerifiedHumanBadgeProps): React.ReactElement {
	const Icon = variant === "globe" ? Globe : ShieldCheck;

	const sizeClasses = {
		xs: "text-[10px] px-1.5 py-0.5 gap-1",
		sm: "text-xs px-2 py-0.5 gap-1.5",
		md: "text-sm px-2.5 py-1 gap-1.5",
	};

	const iconSizes = {
		xs: 10,
		sm: 12,
		md: 14,
	};

	return (
		<Badge
			variant="outline"
			className={cn(
				"border-score-green-border bg-score-green-bg text-score-green font-medium",
				sizeClasses[size],
				className,
			)}
		>
			<Icon size={iconSizes[size]} weight="fill" />
			Verified Human
		</Badge>
	);
}
