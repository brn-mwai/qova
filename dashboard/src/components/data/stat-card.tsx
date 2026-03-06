import { Minus, TrendDown, TrendUp } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

interface StatCardProps {
	label: string;
	value: string | number;
	trend?: {
		value: number;
		direction: "up" | "down" | "flat";
	};
	icon?: React.ReactNode;
	accentColor?: string;
}

export function StatCard({
	label,
	value,
	trend,
	icon,
	accentColor,
}: StatCardProps): React.ReactElement {
	return (
		<div className="rounded-lg border bg-card p-5">
			<div className="flex items-start justify-between">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{label}
				</p>
				{icon && (
					<div
						className="flex size-8 items-center justify-center rounded-lg bg-muted"
						style={accentColor ? { color: accentColor } : undefined}
					>
						{icon}
					</div>
				)}
			</div>
			<p className="mt-2 font-heading text-2xl font-semibold text-card-foreground tabular-nums">
				{value}
			</p>
			{trend && (
				<div className="mt-1.5 flex items-center gap-1">
					{trend.direction === "up" && (
						<TrendUp size={14} className="text-score-green" weight="bold" />
					)}
					{trend.direction === "down" && (
						<TrendDown size={14} className="text-score-red" weight="bold" />
					)}
					{trend.direction === "flat" && (
						<Minus size={14} className="text-muted-foreground" weight="bold" />
					)}
					<span
						className={cn(
							"text-xs font-medium",
							trend.direction === "up" && "text-score-green",
							trend.direction === "down" && "text-score-red",
							trend.direction === "flat" && "text-muted-foreground",
						)}
					>
						{trend.direction === "up" ? "+" : ""}
						{trend.value}%
					</span>
				</div>
			)}
		</div>
	);
}
