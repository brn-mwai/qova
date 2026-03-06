"use client"

import { useState } from "react"
import { Info, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface PageInfoSection {
  title: string
  description: string
}

export interface PageInfo {
  description: string
  sections: PageInfoSection[]
}

interface PageHeaderProps {
  breadcrumb?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  /** Optional info popup content explaining the page */
  info?: PageInfo
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  className,
  info,
}: PageHeaderProps): React.ReactElement {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <>
      <div className={cn("flex items-start justify-between gap-4", className)}>
        <div className="space-y-1 min-w-0">
          {breadcrumb && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {breadcrumb}
            </p>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {info && (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label={`About ${title}`}
            >
              <Info size={16} weight="regular" />
            </button>
          )}
        </div>
      </div>

      {info && (
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">About {title}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {info.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {info.sections.map((section) => (
                <div key={section.title} className="rounded-lg border bg-muted/30 px-3.5 py-2.5">
                  <p className="text-xs font-medium text-foreground mb-0.5">{section.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{section.description}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
