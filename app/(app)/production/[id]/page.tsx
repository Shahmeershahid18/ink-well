'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Ban, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { useBatch, useCancelBatch } from '@/lib/queries/production'
import { useInkFormula } from '@/lib/queries/inks'
import { computeInkCost, type FormulaLine } from '@/lib/calc/formula'
import { formatDate, formatKg, num } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { InkSwatch, StatusBadge } from '@/components/shared/badges'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CompleteBatchDialog } from '@/components/production/complete-batch-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: batch, isLoading } = useBatch(id)
  const { data: formula } = useInkFormula(batch?.ink_id)
  const cancel = useCancelBatch()

  const [completeOpen, setCompleteOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  const theoretical = React.useMemo(() => {
    if (!batch?.ink || !formula) return null
    const lines: FormulaLine[] = formula.map((f) => ({
      raw_material_id: f.raw_material_id,
      quantity_kg: num(f.quantity_kg),
      avg_cost_per_kg: num(f.raw_material?.avg_cost_per_kg),
      current_stock_kg: num(f.raw_material?.current_stock_kg),
    }))
    // Theoretical cost for THIS batch: the ink's recipe and rates, but the labor and
    // overhead actually booked against the batch, so the variance isolates yield and
    // material price rather than a stale default.
    return computeInkCost(lines, {
      batch_size_kg: num(batch.ink.batch_size_kg),
      labor_cost_per_batch: num(batch.labor_cost),
      overhead_cost_per_batch: num(batch.overhead_cost),
      packaging_cost_per_kg: num(batch.ink.packaging_cost_per_kg),
      expected_wastage_pct: num(batch.ink.expected_wastage_pct),
    })
  }, [batch, formula])

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!batch) {
    return (
      <EmptyState
        title="Batch not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/production')}>
            Back to production
          </Button>
        }
      />
    )
  }

  const isDraft = batch.status === 'draft'
  const isDone = batch.status === 'completed'
  const packagingCostPerKg = num(batch.ink?.packaging_cost_per_kg)
  const expectedWastagePct = num(batch.ink?.expected_wastage_pct)
  const produced = num(batch.produced_qty_kg)
  const planned = num(batch.planned_qty_kg)
  const wastageKg = isDone ? planned - produced : 0
  const wastagePct = planned > 0 ? (wastageKg / planned) * 100 : 0

  // Draft lines are priced at today's average; completed lines carry their locked cost.
  const draftMaterialCost = batch.production_consumption.reduce(
    (s, l) => s + num(l.quantity_kg) * num(l.raw_material?.avg_cost_per_kg),
    0,
  )

  const variance =
    isDone && theoretical && theoretical.baseCostPerKg > 0
      ? ((num(batch.cost_per_kg) - theoretical.baseCostPerKg) / theoretical.baseCostPerKg) * 100
      : null

  async function doCancel(reason?: string) {
    try {
      await cancel.mutateAsync({ id, reason })
      toast.success('Batch cancelled')
      setCancelOpen(false)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <>
      <PageHeader
        back={
          <Link
            href="/production"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Production
          </Link>
        }
        title={batch.batch_no || 'Batch'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InkSwatch color={batch.ink?.color_hex} />
            <Link href={`/inks/${batch.ink_id}`} className="hover:underline">
              {batch.ink?.name}
            </Link>
            · {formatDate(batch.production_date)}
            <StatusBadge status={batch.status} />
          </span>
        }
        actions={
          <>
            {isDraft && (
              <>
                <Button onClick={() => setCompleteOpen(true)}>
                  <CircleCheck className="h-4 w-4" />
                  Complete batch
                </Button>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
            {isDone && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Cancel batch
              </Button>
            )}
          </>
        }
      />

      {isDraft && (
        <Alert className="mb-4">
          <AlertDescription>
            This batch is a draft: no raw material has been consumed and no ink has been added to
            stock. Complete it with the actual produced quantity to lock in the cost.
          </AlertDescription>
        </Alert>
      )}

      {batch.status === 'cancelled' && (
        <Alert variant="danger" className="mb-4">
          <AlertDescription>
            This batch was cancelled. If it had been completed, the ink was taken back out of stock
            and the raw material returned — through the ledger, not by deletion.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Planned"
          value={<Weight value={planned} />}
          sub={`Standard batch ${formatKg(batch.ink?.batch_size_kg)} kg`}
        />
        <StatCard
          label="Produced"
          value={batch.produced_qty_kg == null ? '—' : <Weight value={produced} />}
          sub={isDone ? `Wastage ${formatKg(wastageKg)} kg` : 'Not completed yet'}
        />
        <StatCard
          label="Wastage"
          value={
            isDone ? (
              <span className={wastagePct > expectedWastagePct ? 'text-[var(--warn)]' : undefined}>
                <Percent value={wastagePct} />
              </span>
            ) : (
              '—'
            )
          }
          sub={`Expected ${expectedWastagePct}% for this ink`}
        />
        <StatCard
          label="Total cost"
          value={<Money value={isDone ? batch.total_cost : draftMaterialCost + num(batch.labor_cost) + num(batch.overhead_cost)} dp={0} />}
          sub={isDone ? 'Locked at completion' : 'Estimated at today’s prices'}
        />
        <StatCard
          label="Cost per kg"
          value={batch.cost_per_kg == null ? '—' : <Rate value={batch.cost_per_kg} />}
          sub={
            variance != null ? (
              <span className={variance > 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}>
                {variance > 0 ? '+' : ''}
                {variance.toFixed(1)}% vs theoretical
              </span>
            ) : (
              'Set when completed'
            )
          }
        />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Material consumption</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Cost/kg</TableHead>
              <TableHead className="text-right">Line cost</TableHead>
              <TableHead className="text-right">Stock now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.production_consumption.map((line) => {
              const cost = isDone
                ? num(line.cost_per_kg)
                : num(line.raw_material?.avg_cost_per_kg)
              const short =
                isDraft && num(line.raw_material?.current_stock_kg) < num(line.quantity_kg)
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    <Link
                      href={`/raw-materials/${line.raw_material_id}`}
                      className="font-medium hover:underline"
                    >
                      {line.raw_material?.name ?? 'Unknown material'}
                    </Link>
                  </TableCell>
                  <TableCell className="num text-right">
                    <Weight value={line.quantity_kg} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <Rate value={cost} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <Money value={isDone ? line.line_cost : num(line.quantity_kg) * cost} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <span className={short ? 'text-[var(--danger)]' : undefined}>
                      {formatKg(line.raw_material?.current_stock_kg)}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-medium">Material</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="num text-right font-medium">
                <Money value={isDone ? batch.material_cost : draftMaterialCost} />
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-[var(--muted-foreground)]">Labor</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="num text-right">
                <Money value={batch.labor_cost} />
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-[var(--muted-foreground)]">Overhead</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="num text-right">
                <Money value={batch.overhead_cost} />
              </TableCell>
              <TableCell />
            </TableRow>
            {isDone && (
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-[var(--muted-foreground)]">
                  Packaging ({formatKg(produced)} kg)
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell className="num text-right">
                  <Money value={batch.packaging_cost} />
                </TableCell>
                <TableCell />
              </TableRow>
            )}
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="num text-right font-semibold">
                <Money
                  value={
                    isDone
                      ? batch.total_cost
                      : draftMaterialCost + num(batch.labor_cost) + num(batch.overhead_cost)
                  }
                />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      {batch.notes && <p className="text-xs text-[var(--muted-foreground)]">{batch.notes}</p>}

      {isDraft && (
        <CompleteBatchDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          batch={batch}
          packagingCostPerKg={packagingCostPerKg}
          expectedWastagePct={expectedWastagePct}
          theoreticalCostPerKg={theoretical?.baseCostPerKg}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={isDone ? 'Cancel this completed batch?' : 'Cancel this draft?'}
        description={
          isDone
            ? 'The produced ink will be taken back out of stock and the consumed raw material returned. Both are written as reversing movements.'
            : 'The draft will be marked cancelled. Nothing was consumed, so no stock changes.'
        }
        confirmLabel="Cancel batch"
        cancelLabel="Keep it"
        destructive
        reasonLabel="Reason"
        reasonRequired
        pending={cancel.isPending}
        onConfirm={doCancel}
      />
    </>
  )
}
