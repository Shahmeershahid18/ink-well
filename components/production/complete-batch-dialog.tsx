'use client'

import * as React from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { formatKg, num } from '@/lib/format'
import { batchCost } from '@/lib/calc/costing'
import { useCompleteBatch } from '@/lib/queries/production'
import type { BatchFull } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Money, Percent, Rate } from '@/components/shared/money'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function CompleteBatchDialog({
  open,
  onOpenChange,
  batch,
  packagingCostPerKg,
  expectedWastagePct,
  theoreticalCostPerKg,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: BatchFull
  packagingCostPerKg: number
  expectedWastagePct: number
  theoreticalCostPerKg?: number
}) {
  const complete = useCompleteBatch()
  const planned = num(batch.planned_qty_kg)
  const expectedYield = planned * (1 - expectedWastagePct / 100)

  const [produced, setProduced] = React.useState('')

  // Default to the expected yield on the closed->open edge — during render, so the
  // dialog never flashes an empty field.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setProduced(String(Number(expectedYield.toFixed(3))))
  }

  const producedQty = Number(produced) || 0

  // Material cost at today's average — the RPC locks in the same figures on save.
  const materialCost = batch.production_consumption.reduce(
    (sum, line) => sum + num(line.quantity_kg) * num(line.raw_material?.avg_cost_per_kg),
    0,
  )

  const result = batchCost({
    materialCost,
    laborCost: num(batch.labor_cost),
    overheadCost: num(batch.overhead_cost),
    packagingCostPerKg,
    producedKg: producedQty,
    plannedKg: planned,
  })

  const shortfalls = batch.production_consumption.filter(
    (line) => num(line.raw_material?.current_stock_kg) < num(line.quantity_kg),
  )

  const variance =
    theoreticalCostPerKg && theoreticalCostPerKg > 0
      ? ((result.costPerKg - theoreticalCostPerKg) / theoreticalCostPerKg) * 100
      : null

  const valid = producedQty > 0 && shortfalls.length === 0

  async function submit() {
    try {
      await complete.mutateAsync({ id: batch.id, producedQty })
      toast.success(`Batch completed — ${formatKg(producedQty)} kg into stock`)
      onOpenChange(false)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete batch {batch.batch_no}</DialogTitle>
          <DialogDescription>
            Enter what actually came out of the mixer. That number sets the cost per kg for every
            sale from this batch, so it has to be the real one.
          </DialogDescription>
        </DialogHeader>

        {shortfalls.length > 0 && (
          <Alert variant="danger">
            <TriangleAlert />
            <AlertDescription>
              <div className="font-medium">Not enough raw material to complete this batch.</div>
              <ul className="mt-1 space-y-0.5">
                {shortfalls.map((line) => (
                  <li key={line.id} className="num">
                    {line.raw_material?.name}: need {formatKg(line.quantity_kg)} kg, have{' '}
                    {formatKg(line.raw_material?.current_stock_kg)} kg
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Planned</Label>
            <div className="num flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 text-sm">
              {formatKg(planned)} kg
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="produced">Actually produced (kg) *</Label>
            <Input
              id="produced"
              type="number"
              step="0.001"
              min="0.001"
              autoFocus
              value={produced}
              onChange={(e) => setProduced(e.target.value)}
            />
          </div>
        </div>

        <p className="-mt-1 text-xs text-[var(--muted-foreground)]">
          At {expectedWastagePct}% expected wastage you would get {formatKg(expectedYield)} kg.
        </p>

        <div className="rounded-md border border-[var(--border)] p-3 text-sm">
          <div className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            Resulting batch cost
          </div>
          <Row label="Material" value={<Money value={result.materialCost} />} />
          <Row label="Labor" value={<Money value={result.laborCost} />} />
          <Row label="Overhead" value={<Money value={result.overheadCost} />} />
          <Row label="Packaging" value={<Money value={result.packagingCost} />} />
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <Row label="Total cost" value={<Money value={result.totalCost} />} bold />
            <Row
              label="Cost per kg"
              value={<Rate value={result.costPerKg} className="text-base font-semibold" />}
              bold
            />
          </div>
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <Row
              label="Wastage"
              value={
                <span className={result.wastagePct > expectedWastagePct ? 'text-[var(--warn)]' : ''}>
                  {formatKg(result.wastageKg)} kg · <Percent value={result.wastagePct} />
                </span>
              }
            />
            {variance != null && (
              <Row
                label="vs theoretical cost"
                value={
                  <span className={variance > 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}>
                    {variance > 0 ? '+' : ''}
                    {variance.toFixed(1)}%
                  </span>
                }
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || complete.isPending}>
            {complete.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Complete batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className={bold ? 'font-medium' : 'text-[var(--muted-foreground)]'}>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
