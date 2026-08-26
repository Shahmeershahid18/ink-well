'use client'

import * as React from 'react'
import { Loader2, Plus, TriangleAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { formatKg, num } from '@/lib/format'
import { computeInkCost, type FormulaLine } from '@/lib/calc/formula'
import { useRawMaterials } from '@/lib/queries/materials'
import { useSaveFormula } from '@/lib/queries/inks'
import type { FormulaItemWithMaterial, Ink } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { EmptyState } from '@/components/shared/empty-state'
import { CostBreakdownBar } from './cost-breakdown-bar'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Row {
  key: string
  raw_material_id: string | null
  quantity_kg: string
}

let seq = 0
const newRow = (): Row => ({ key: `row-${++seq}`, raw_material_id: null, quantity_kg: '' })

/**
 * The saved formula seeds the editor once. The parent keys this component by ink,
 * so switching inks remounts it rather than syncing state in an effect.
 */
export function FormulaBuilder({
  ink,
  formula,
}: {
  ink: Ink
  formula: FormulaItemWithMaterial[]
}) {
  const { data: materials } = useRawMaterials(true)
  const save = useSaveFormula()

  const [rows, setRows] = React.useState<Row[]>(() =>
    formula.length
      ? formula.map((f) => ({
          key: f.id,
          raw_material_id: f.raw_material_id,
          quantity_kg: String(num(f.quantity_kg)),
        }))
      : [newRow()],
  )
  const [dirty, setDirty] = React.useState(false)

  const lines: FormulaLine[] = React.useMemo(
    () =>
      rows
        .filter((r) => r.raw_material_id && Number(r.quantity_kg) > 0)
        .map((r) => {
          const material = materials?.find((m) => m.id === r.raw_material_id)
          return {
            raw_material_id: r.raw_material_id!,
            quantity_kg: Number(r.quantity_kg),
            name: material?.name,
            avg_cost_per_kg: num(material?.avg_cost_per_kg),
            current_stock_kg: num(material?.current_stock_kg),
          }
        }),
    [rows, materials],
  )

  const cost = React.useMemo(() => computeInkCost(lines, ink), [lines, ink])

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  function remove(key: string) {
    setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((r) => r.key !== key)))
    setDirty(true)
  }

  function add() {
    setRows((rs) => [...rs, newRow()])
    setDirty(true)
  }

  async function submit() {
    try {
      await save.mutateAsync({
        ink_id: ink.id,
        items: lines.map((l) => ({
          raw_material_id: l.raw_material_id,
          quantity_kg: l.quantity_kg,
        })),
      })
      setDirty(false)
      toast.success('Formula saved')
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  const used = new Set(rows.map((r) => r.raw_material_id).filter(Boolean))

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[200px]">Raw material</TableHead>
              <TableHead className="w-32 text-right">Quantity (kg)</TableHead>
              <TableHead className="w-20 text-right">% of mix</TableHead>
              <TableHead className="w-28 text-right">Cost/kg</TableHead>
              <TableHead className="w-32 text-right">Line cost</TableHead>
              <TableHead className="w-28 text-right">In stock</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const material = materials?.find((m) => m.id === row.raw_material_id)
              const qty = Number(row.quantity_kg) || 0
              const lineCost = qty * num(material?.avg_cost_per_kg)
              const totalWeight = lines.reduce((s, l) => s + l.quantity_kg, 0)
              const pct = totalWeight > 0 ? (qty / totalWeight) * 100 : 0
              const stock = num(material?.current_stock_kg)
              const short = material ? stock < qty : false

              return (
                <TableRow key={row.key}>
                  <TableCell>
                    <Combobox
                      options={(materials ?? []).map((m) => ({
                        value: m.id,
                        label: m.name,
                        hint: `${formatKg(m.current_stock_kg)} kg · ${num(m.avg_cost_per_kg).toFixed(0)}/kg`,
                        keywords: m.code ?? '',
                        disabled: used.has(m.id) && m.id !== row.raw_material_id,
                      }))}
                      value={row.raw_material_id}
                      onChange={(v) => update(row.key, { raw_material_id: v })}
                      placeholder="Choose a material…"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      className="h-9"
                      value={row.quantity_kg}
                      onChange={(e) => update(row.key, { quantity_kg: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          add()
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="num text-right text-[var(--muted-foreground)]">
                    {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {material ? <Rate value={material.avg_cost_per_kg} /> : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {lineCost > 0 ? <Money value={lineCost} /> : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {material ? (
                      <span className={short ? 'text-[var(--warn)]' : undefined}>
                        {formatKg(stock)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => remove(row.key)}
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
              <TableCell className="font-medium">
                Formula total for a {formatKg(ink.batch_size_kg)} kg batch
              </TableCell>
              <TableCell className="num text-right font-medium">
                <Weight value={cost.totalWeightKg} showUnit={false} />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="num text-right font-medium">
                <Money value={cost.materialCostPerBatch} />
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
          Add material
        </Button>
        <Button onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save formula
        </Button>
        {dirty && (
          <span className="text-xs text-[var(--warn)]">Unsaved changes</span>
        )}
      </div>

      {!cost.weightMatchesBatch && lines.length > 0 && (
        <Alert variant="warn">
          <TriangleAlert />
          <AlertDescription>
            Formula totals {formatKg(cost.totalWeightKg)} kg but the batch size is{' '}
            {formatKg(ink.batch_size_kg)} kg ({cost.weightDifferenceKg > 0 ? '+' : ''}
            {formatKg(cost.weightDifferenceKg)} kg). That can be legitimate — solvent flashes off —
            so this is a warning, not a block.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        {lines.length === 0 ? (
          <EmptyState
            title="No materials in the formula yet"
            description="Add the pigments, resins and solvents that go into one batch. The cost bar updates as you type."
          />
        ) : (
          <CostBreakdownBar cost={cost} />
        )}
      </Card>

      {cost.belowCost && (
        <Alert variant="danger">
          <TriangleAlert />
          <AlertDescription>
            At today&apos;s material prices this ink costs more to make than its list price of{' '}
            <Money value={cost.pricePerKg} />/kg. Margin is{' '}
            <Percent value={cost.marginPct} />.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
