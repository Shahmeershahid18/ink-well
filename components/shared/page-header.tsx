import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  back?: React.ReactNode
}

export function PageHeader({ title, description, actions, className, back }: PageHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
