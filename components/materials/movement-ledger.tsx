'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, formatKg, num } from '@/lib/format'
import { MOVEMENT_LABELS } from '@/lib/constants'
import type { InventoryMovement } from '@/types/database'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Rate } from '@/components/shared/money'
import { Badge } from '@/components/ui/badge'

function refHref(movement: InventoryMovement): string | null {
  if (!movement.ref_id) return null
  switch (movement.ref_table) {
    case 'purchases':
      return `/purchases/${movement.ref_id}`
    case 'sales':
      return `/sales/${movement.ref_id}`
    case 'production_batches':
      return `/production/${movement.ref_id}`
    default:
      return null
  }
}

export function MovementLedger({
  movements,
  loading,
  showItem,
  itemNames,
}: {
  movements: InventoryMovement[] | undefined
  loading?: boolean
  /** The global ledger names the item; a detail page already knows it. */
  showItem?: boolean
  itemNames?: Record<string, { name: string; type: 'raw' | 'ink' }>
}) {
  const columns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: 'When',
      sortValue: (r) => r.created_at,
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    ...(showItem
      ? [
          {
            key: 'item',
            header: 'Item',
            sortValue: (r: InventoryMovement) => itemNames?.[r.item_id]?.name ?? '',
            cell: (r: InventoryMovement) => {
              const item = itemNames?.[r.item_id]
              if (!item) return <span className="text-[var(--muted-foreground)]">Unknown</span>
              return (
                <Link
                  href={item.type === 'raw' ? `/raw-materials/${r.item_id}` : `/inks/${r.item_id}`}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </Link>
              )
            },
          } as Column<InventoryMovement>,
        ]
      : []),
    {
      key: 'movement_type',
      header: 'Type',
      sortValue: (r) => r.movement_type,
      cell: (r) => (
        <Badge variant={r.movement_type === 'adjustment' ? 'warn' : 'outline'}>
          {MOVEMENT_LABELS[r.movement_type] ?? r.movement_type}
        </Badge>
      ),
    },
    {
      key: 'quantity_kg',
      header: 'Change',
      numeric: true,
      sortValue: (r) => num(r.quantity_kg),
      cell: (r) => {
        const qty = num(r.quantity_kg)
        return (
          <span
            className={cn(
              'num inline-flex items-center gap-1',
              qty > 0 ? 'text-[var(--ok)]' : qty < 0 ? 'text-[var(--danger)]' : undefined,
            )}
          >
            {qty > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : qty < 0 ? (
              <ArrowDownLeft className="h-3 w-3" />
            ) : (
              <Scale className="h-3 w-3" />
            )}
            {qty > 0 ? '+' : ''}
            {formatKg(qty)}
          </span>
        )
      },
    },
    {
      key: 'cost_per_kg',
      header: 'Cost/kg',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => num(r.cost_per_kg),
      cell: (r) => (r.cost_per_kg == null ? '—' : <Rate value={r.cost_per_kg} />),
    },
    {
      key: 'balance_after',
      header: 'Balance',
      numeric: true,
      sortValue: (r) => num(r.balance_after),
      cell: (r) => <span className="num font-medium">{formatKg(r.balance_after)}</span>,
    },
    {
      key: 'ref',
      header: 'Reference',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => {
        const href = refHref(r)
        if (href) {
          return (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View
              <ExternalLink className="h-3 w-3" />
            </Link>
          )
        }
        return (
          <span className="text-xs text-[var(--muted-foreground)]">{r.notes ?? '—'}</span>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={movements}
      loading={loading}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'created_at', dir: 'desc' }}
      empty={
        <EmptyState
          title="No movements yet"
          description="Every purchase, production run, sale and adjustment lands here — this is the audit trail when a number looks wrong."
        />
      }
    />
  )
}
