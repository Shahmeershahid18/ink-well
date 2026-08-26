'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { formatKg, num, today } from '@/lib/format'
import { consumptionCost, scaleFormula, type FormulaLine } from '@/lib/calc/formula'
import { batchCost } from '@/lib/calc/costing'
import { useInkFormula, useInks } from '@/lib/queries/inks'
import { useRawMaterials } from '@/lib/queries/materials'
import { useSaveBatch } from '@/lib/queries/production'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Money, Rate, Weight } from '@/components/shared/money'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Line {
  key: string
  raw_material_id: string | null
  quantity_kg: string
}

let seq = 0
const newLine = (): Line => ({ key: `bl-${++seq}`, raw_material_id: null, quantity_kg: '' })

/** Stable placeholder row for an ink with no formula — a fresh array each render
 *  would change the key and blur the input on every keystroke. */
const BLANK_LINES: Line[] = [{ key: 'bl-blank', raw_material_id: null, quantity_kg: '' }]

export function BatchForm({ defaultInkId }: { defaultInkId?: string }) {
  const router = useRouter()
  const { data: inks } = useInks(true)
  const { data: materials } = useRawMaterials(true)
  const save = useSaveBatch()

  const [inkId, setInkId] = React.useState<string | null>(defaultInkId ?? null)
  const [plannedQty, setPlannedQty] = React.useState('')
  const [productionDate, setProductionDate] = React.useState(today())
  const [labor, setLabor] = React.useState('0')
  const [overhead, setOverhead] = React.useState('0')
  const [notes, setNotes] = React.useState('')
  /** Null means "still following the formula"; any edit takes a copy and owns it. */
  const [manualLines, setManualLines] = React.useState<Line[] | null>(null)

  const ink = inks?.find((i) => i.id === inkId)
  const { data: formula } = useInkFormula(inkId ?? undefined)

  // Selecting an ink defaults the plan to its standard batch and its cost rates,
  // once per ink. Done during render so the first paint already has the defaults.
  const [seededInkId, setSeededInkId] = React.useState<string | null>(null)
  if (ink && seededInkId !== ink.id) {
    setSeededInkId(ink.id)
    setPlannedQty(String(num(ink.batch_size_kg)))
    setLabor(String(num(ink.labor_cost_per_batch)))
    setOverhead(String(num(ink.overhead_cost_per_batch)))
    setManualLines(null)
  }

  // Consumption is derived from the formula rather than copied into state, so
  // changing the planned quantity rescales it with nothing to keep in sync.
  const scaledLines = React.useMemo<Line[]>(() => {
    if (!ink || !formula?.length) return []
    const plannedKg = Number(plannedQty) || num(ink.batch_size_kg)
    return scaleFormula(
      formula.map((f) => ({
        raw_material_id: f.raw_material_id,
        quantity_kg: num(f.quantity_kg),
        avg_cost_per_kg: num(f.raw_material?.avg_cost_per_kg),
        current_stock_kg: num(f.raw_material?.current_stock_kg),
      })),
      plannedKg,
      num(ink.batch_size_kg),
    ).map((l) => ({
      key: `f-${l.raw_material_id}`,
      raw_material_id: l.raw_material_id,
      quantity_kg: String(l.quantity_kg),
    }))
  }, [formula, ink, plannedQty])

  const manual = manualLines !== null
  const lines = manualLines ?? (scaledLines.length ? scaledLines : BLANK_LINES)

  const consumption: FormulaLine[] = lines
    .filter((l) => l.raw_material_id && Number(l.quantity_kg) > 0)
    .map((l) => {
      const material = materials?.find((m) => m.id === l.raw_material_id)
      return {
        raw_material_id: l.raw_material_id!,
        quantity_kg: Number(l.quantity_kg),
        name: material?.name,
        avg_cost_per_kg: num(material?.avg_cost_per_kg),
        current_stock_kg: num(material?.current_stock_kg),
      }
    })

  const shortfalls = consumption.filter(
    (l) => (l.current_stock_kg ?? 0) < l.quantity_kg,
  )
  const materialCost = consumptionCost(consumption)
  const planned = Number(plannedQty) || 0

  const preview = batchCost({
    materialCost,
    laborCost: Number(labor) || 0,
    overheadCost: Number(overhead) || 0,
    packagingCostPerKg: num(ink?.packaging_cost_per_kg),
    producedKg: planned * (1 - num(ink?.expected_wastage_pct) / 100),
    plannedKg: planned,
  })

  function update(key: string, patch: Partial<Line>) {
    setManualLines((current) =>
      (current ?? lines).map((l) => (l.key === key ? { ...l, ...patch } : l)),
    )
  }

  function addLine() {
    setManualLines((current) => [...(current ?? lines), newLine()])
  }

  function removeLine(key: string) {
    setManualLines((current) => {
      const base = current ?? lines
      return base.length === 1 ? [newLine()] : base.filter((l) => l.key !== key)
    })
  }

  const used = new Set(lines.map((l) => l.raw_material_id).filter(Boolean))
  const canSubmit = !!inkId && planned > 0 && consumption.length > 0 && !save.isPending

  async function submit() {
    if (!canSubmit) return
    try {
      const id = await save.mutateAsync({
        ink_id: inkId!,
        production_date: productionDate,
        planned_qty_kg: planned,
        labor_cost: Number(labor) || 0,
        overhead_cost: Number(overhead) || 0,
        notes: notes.trim() || null,
        items: consumption.map((l) => ({
          raw_material_id: l.raw_material_id,
          quantity_kg: l.quantity_kg,
        })),
      })
      toast.success('Batch saved as draft — nothing consumed yet')
      router.push(`/production/${id}`)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>What are you making</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Ink *</Label>
            <Combobox
              options={(inks ?? []).map((i) => ({
                value: i.id,
                label: i.name,
                color: i.color_hex,
                hint: `batch ${formatKg(i.batch_size_kg)} kg`,
                keywords: i.code ?? '',
              }))}
              value={inkId}
              onChange={setInkId}
              placeholder="Choose an ink…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planned">Planned quantity (kg) *</Label>
            <Input
              id="planned"
              type="number"
              step="0.001"
              min="0.001"
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
            />
            {ink && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Standard batch is {formatKg(ink.batch_size_kg)} kg · expected wastage{' '}
                {num(ink.expected_wastage_pct)}%
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-date">Production date</Label>
            <Input
              id="prod-date"
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {ink && formula && formula.length === 0 && (
        <Alert variant="warn">
          <TriangleAlert />
          <AlertDescription>
            {ink.name} has no formula yet, so nothing was scaled in. Add the lines by hand below, or{' '}
            <Link href={`/inks/${ink.id}`} className="underline">
              set up its formula first
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>
            Materials to consume
            {!manual && formula && formula.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                scaled from the formula — edit any line, real production deviates
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[220px]">Material</TableHead>
              <TableHead className="w-32 text-right">Quantity (kg)</TableHead>
              <TableHead className="w-32 text-right">Available</TableHead>
              <TableHead className="w-28 text-right">Cost/kg</TableHead>
              <TableHead className="w-32 text-right">Line cost</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const material = materials?.find((m) => m.id === line.raw_material_id)
              const qty = Number(line.quantity_kg) || 0
              const stock = num(material?.current_stock_kg)
              const short = material ? stock < qty : false

              return (
                <TableRow key={line.key}>
                  <TableCell>
                    <Combobox
                      options={(materials ?? []).map((m) => ({
                        value: m.id,
                        label: m.name,
                        hint: `${formatKg(m.current_stock_kg)} kg`,
                        keywords: m.code ?? '',
                        disabled: used.has(m.id) && m.id !== line.raw_material_id,
                      }))}
                      value={line.raw_material_id}
                      onChange={(v) => update(line.key, { raw_material_id: v })}
                      placeholder="Choose a material…"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      className="h-9"
                      value={line.quantity_kg}
                      onChange={(e) => update(line.key, { quantity_kg: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="num text-right">
                    {material ? (
                      <div>
                        <span className={short ? 'text-[var(--danger)]' : undefined}>
                          {formatKg(stock)}
                        </span>
                        {short && (
                          <div className="text-xs text-[var(--danger)]">
                            short {formatKg(qty - stock)} kg
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="num text-right">
                    {material ? <Rate value={material.avg_cost_per_kg} /> : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {material && qty > 0 ? <Money value={qty * num(material.avg_cost_per_kg)} /> : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-medium">Material cost at today&apos;s average</TableCell>
              <TableCell className="num text-right font-medium">
                <Weight
                  value={consumption.reduce((s, l) => s + l.quantity_kg, 0)}
                  showUnit={false}
                />
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell className="num text-right font-medium">
                <Money value={materialCost} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
        <div className="border-t border-[var(--border)] p-3">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add material
          </Button>
        </div>
      </Card>

      {shortfalls.length > 0 && (
        <Alert variant="danger">
          <TriangleAlert />
          <AlertDescription>
            <div className="mb-1 font-medium">
              Not enough stock for {shortfalls.length} material
              {shortfalls.length === 1 ? '' : 's'} — completing this batch will fail.
            </div>
            <ul className="space-y-0.5">
              {shortfalls.map((s) => (
                <li key={s.raw_material_id} className="flex flex-wrap items-center gap-2">
                  <span className="num">
                    {s.name}: short {formatKg(s.quantity_kg - (s.current_stock_kg ?? 0))} kg
                  </span>
                  <Link
                    href={`/purchases/new?material=${s.raw_material_id}`}
                    className="inline-flex items-center gap-1 underline"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Purchase this
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-1">
              You can still save the draft and buy the material before completing.
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Conversion costs</CardTitle>
          </CardHeader>
          <div className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="labor">Labor for this batch</Label>
                <Input
                  id="labor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={labor}
                  onChange={(e) => setLabor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="overhead">Overhead for this batch</Label>
                <Input
                  id="overhead"
                  type="number"
                  step="0.01"
                  min="0"
                  value={overhead}
                  onChange={(e) => setOverhead(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Defaulted from the ink, editable per batch. Packaging is charged per kg produced at{' '}
              {num(ink?.packaging_cost_per_kg).toFixed(2)}/kg.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="batch-notes">Notes</Label>
              <Textarea
                id="batch-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Expected cost at planned yield</CardTitle>
          </CardHeader>
          <div className="space-y-2 px-4 pb-4 text-sm">
            <Row label="Material" value={<Money value={preview.materialCost} />} />
            <Row label="Labor" value={<Money value={preview.laborCost} />} />
            <Row label="Overhead" value={<Money value={preview.overheadCost} />} />
            <Row label="Packaging" value={<Money value={preview.packagingCost} />} />
            <div className="border-t border-[var(--border)] pt-2">
              <Row label="Total cost" value={<Money value={preview.totalCost} />} bold />
              <Row
                label={`Cost per kg at ${formatKg(
                  planned * (1 - num(ink?.expected_wastage_pct) / 100),
                )} kg yield`}
                value={<Rate value={preview.costPerKg} className="font-semibold" />}
              />
            </div>
            <p className="pt-1 text-xs text-[var(--muted-foreground)]">
              The real cost is fixed when you enter the actual produced quantity.
            </p>

            <div className="flex gap-2 pt-3">
              <Button variant="outline" onClick={() => router.back()} disabled={save.isPending}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save as draft
              </Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              A draft consumes nothing. You complete it after the batch is actually made.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? 'font-medium' : 'text-[var(--muted-foreground)]'}>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
