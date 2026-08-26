'use client'

import * as React from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { useMovements, useReconciliation } from '@/lib/queries/dashboard'
import { useRawMaterials } from '@/lib/queries/materials'
import { useInks } from '@/lib/queries/inks'
import { addDays, formatDateTime, num, toDateInput } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { PageHeader } from '@/components/shared/page-header'
import { MovementLedger } from '@/components/materials/movement-ledger'
import { Weight } from '@/components/shared/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function InventoryPage() {
  const { data: materials } = useRawMaterials()
  const { data: inks } = useInks()
  const { data: reconciliation } = useReconciliation()

  const [itemType, setItemType] = React.useState('all')
  const [itemId, setItemId] = React.useState<string | null>(null)
  const [movementType, setMovementType] = React.useState('all')
  const [from, setFrom] = React.useState(toDateInput(addDays(new Date(), -30)))
  const [to, setTo] = React.useState(toDateInput(new Date()))

  const { data: movements, isLoading } = useMovements({
    itemType: itemType === 'all' ? undefined : (itemType as 'raw' | 'ink'),
    itemId: itemId ?? undefined,
    movementType: movementType === 'all' ? undefined : movementType,
    from,
    to,
    limit: 500,
  })

  const itemNames = React.useMemo(() => {
    const map: Record<string, { name: string; type: 'raw' | 'ink' }> = {}
    materials?.forEach((m) => (map[m.id] = { name: m.name, type: 'raw' }))
    inks?.forEach((i) => (map[i.id] = { name: i.name, type: 'ink' }))
    return map
  }, [materials, inks])

  const itemOptions = React.useMemo(() => {
    const options: { value: string; label: string; hint?: string; color?: string | null }[] = [
      { value: '', label: 'All items' },
    ]
    if (itemType !== 'ink') {
      materials?.forEach((m) => options.push({ value: m.id, label: m.name, hint: 'material' }))
    }
    if (itemType !== 'raw') {
      inks?.forEach((i) => options.push({ value: i.id, label: i.name, hint: 'ink', color: i.color_hex }))
    }
    return options
  }, [materials, inks, itemType])

  const rows = movements ?? []
  const inKg = rows.filter((m) => num(m.quantity_kg) > 0).reduce((s, m) => s + num(m.quantity_kg), 0)
  const outKg = rows
    .filter((m) => num(m.quantity_kg) < 0)
    .reduce((s, m) => s + Math.abs(num(m.quantity_kg)), 0)

  return (
    <>
      <PageHeader
        title="Inventory ledger"
        description="Every movement, in order. This is the audit trail when a number looks wrong."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(`inventory-ledger-${from}-to-${to}`, rows, [
                { header: 'When', value: (r) => formatDateTime(r.created_at) },
                { header: 'Item', value: (r) => itemNames[r.item_id]?.name ?? r.item_id },
                { header: 'Item type', value: (r) => r.item_type },
                { header: 'Movement', value: (r) => MOVEMENT_LABELS[r.movement_type] ?? r.movement_type },
                { header: 'Quantity kg', value: (r) => num(r.quantity_kg) },
                { header: 'Cost/kg', value: (r) => r.cost_per_kg },
                { header: 'Balance after', value: (r) => num(r.balance_after) },
                { header: 'Reference', value: (r) => r.ref_table },
                { header: 'Notes', value: (r) => r.notes },
              ])
            }
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        }
      />

      {/* Silent while the books balance — this only speaks up when they don't. */}
      {reconciliation && reconciliation.length > 0 && (
        <Alert variant="danger" className="mb-4">
          <TriangleAlert />
          <AlertTitle>{reconciliation.length} item(s) out of balance</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5">
              {reconciliation.map((r) => (
                <li key={r.id} className="num">
                  {r.name}: stock says {num(r.current_stock_kg)} kg, ledger says{' '}
                  {num(r.ledger_kg)} kg (difference {num(r.difference_kg)} kg)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-36 space-y-1.5">
          <Label>Item type</Label>
          <Select
            value={itemType}
            onValueChange={(v) => {
              setItemType(v)
              setItemId(null)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="raw">Raw materials</SelectItem>
              <SelectItem value="ink">Inks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-56 space-y-1.5">
          <Label>Item</Label>
          <Combobox
            options={itemOptions}
            value={itemId ?? ''}
            onChange={(v) => setItemId(v || null)}
            placeholder="All items"
          />
        </div>

        <div className="w-40 space-y-1.5">
          <Label>Movement</Label>
          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All movements</SelectItem>
              {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <div className="text-xs text-[var(--muted-foreground)]">Movements shown</div>
          <div className="num text-lg font-semibold">{rows.length}</div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-xs text-[var(--muted-foreground)]">Total in</div>
          <div className="num text-lg font-semibold text-[var(--ok)]">
            <Weight value={inKg} />
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-xs text-[var(--muted-foreground)]">Total out</div>
          <div className="num text-lg font-semibold text-[var(--danger)]">
            <Weight value={outKg} />
          </div>
        </Card>
      </div>

      <MovementLedger movements={rows} loading={isLoading} showItem itemNames={itemNames} />
    </>
  )
}
