"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "outline" | "ghost"
  icon?: React.ReactNode
}

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  /** Legacy: pass arbitrary React node for backward compatibility */
  action?: React.ReactNode
  /** Structured primary CTA */
  primaryAction?: EmptyStateAction
  /** Structured secondary action */
  secondaryAction?: EmptyStateAction
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center text-center",
        compact ? "py-10" : "py-16",
        className,
      )}
    >
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="empty-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#empty-grid)" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-xl border border-border/50 bg-muted/50 text-muted-foreground">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-xs text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Legacy action slot */}
        {action && <div className="mt-5">{action}</div>}

        {/* Structured actions */}
        {(primaryAction || secondaryAction) && (
          <div className="mt-5 flex items-center gap-2">
            {primaryAction && (
              <ActionButton action={primaryAction} variant={primaryAction.variant ?? "default"} />
            )}
            {secondaryAction && (
              <ActionButton action={secondaryAction} variant={secondaryAction.variant ?? "outline"} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: "default" | "outline" | "ghost"
}): React.ReactElement {
  if (action.href) {
    return (
      <Button variant={variant} size="sm" asChild>
        <Link href={action.href}>
          {action.icon}
          {action.label}
        </Link>
      </Button>
    )
  }
  return (
    <Button variant={variant} size="sm" onClick={action.onClick}>
      {action.icon}
      {action.label}
    </Button>
  )
}
