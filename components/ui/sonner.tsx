'use client'

import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-lg text-sm',
          description: 'text-[var(--muted-foreground)]',
          actionButton: 'bg-[var(--primary)] text-[var(--primary-foreground)]',
          cancelButton: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
          error: 'text-[var(--danger)]',
          success: 'text-[var(--ok)]',
          warning: 'text-[var(--warn)]',
        },
      }}
    />
  )
}
