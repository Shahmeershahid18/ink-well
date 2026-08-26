'use client'

import * as React from 'react'
import Link from 'next/link'
import { Bell, PackageX, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relativeDate } from '@/lib/format'
import { useAlerts, useMarkAlertsRead } from '@/lib/queries/dashboard'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function AlertBell() {
  const [open, setOpen] = React.useState(false)
  const { data: alerts } = useAlerts(true)
  const markRead = useMarkAlertsRead()

  const unread = (alerts ?? []).filter((a) => !a.is_read)

  React.useEffect(() => {
    if (open && unread.length) markRead.mutate(unread.map((a) => a.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Stock alerts">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-medium text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <span className="text-sm font-medium">Stock alerts</span>
          <span className="num text-xs text-[var(--muted-foreground)]">
            {alerts?.length ?? 0} open
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!alerts || alerts.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">
              All stock levels are healthy.
            </p>
          ) : (
            alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.item_type === 'raw' ? `/raw-materials/${alert.item_id}` : `/inks/${alert.item_id}`}
                onClick={() => setOpen(false)}
                className="flex gap-2.5 border-b border-[var(--border)] px-3 py-2.5 last:border-0 hover:bg-[var(--accent)]"
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0',
                    alert.level === 'critical' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
                  )}
                >
                  {alert.level === 'critical' ? (
                    <PackageX className="h-4 w-4" />
                  ) : (
                    <TriangleAlert className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs leading-snug">{alert.message}</span>
                  <span className="block text-[11px] text-[var(--muted-foreground)]">
                    {relativeDate(alert.created_at)}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
