import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  /** Say what to do next, not that there is nothing here. */
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && <div className="mb-1 text-[var(--muted-foreground)] [&_svg]:size-7">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
