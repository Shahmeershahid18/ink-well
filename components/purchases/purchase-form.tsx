'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { formatKg, num, today } from '@/lib/format'
import { purchaseTotals } from '@/lib/calc/costing'
import { PAYMENT_METHODS } from '@/lib/constants'
import { useRawMaterials } from '@/lib/queries/materials'
import { useSuppliers } from '@/lib/queries/parties'
import { useNextDocumentNo, useRecordPurchase } from '@/lib/queries/purchases'
import { PartyForm } from '@/components/parties/party-form'
import { MaterialForm } from '@/components/materials/material-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Money, Rate } from '@/components/shared/money'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Line {
  key: string
  raw_material_id: string | null
  quantity_kg: string
  price_per_kg: string
}

let seq = 0
const newLine = (materialId: string | null = null): Line => ({
  key: `line-${++seq}`,
  raw_material_id: materialId,
  quantity_kg: '',
  price_per_kg: '',
})

export function PurchaseForm({
  defaultSupplierId,
  defaultMaterialId,
}: {
  defaultSupplierId?: string
  defaultMaterialId?: string
}) {
  const router = useRouter()
  const { data: suppliers } = useSuppliers(true)
  const { data: materials } = useRawMaterials(true)
  const { data: suggestedNo } = useNextDocumentNo('purchase')
  const record = useRecordPurchase()

  // Generated once on mount: a double-click must not create a second purchase.
  const idempotencyKey = React.useMemo(() => nanoid(), [])

  const [supplierId, setSupplierId] = React.useState<string | null>(defaultSupplierId ?? null)
  const [invoiceNo, setInvoiceNo] = React.useState('')
  const [purchaseDate, setPurchaseDate] = React.useState(today())
  const [lines, setLines] = React.useState<Line[]>([newLine(defaultMaterialId ?? null)])
  const [freight, setFreight] = React.useState('0')
  const [other, setOther] = React.useState('0')
  const [discount, setDiscount] = React.useState('0')
  const [paid, setPaid] = React.useState('0')
  const [method, setMethod] = React.useState('cash')
  const [notes, setNotes] = React.useState('')

  const [supplierFormOpen, setSupplierFormOpen] = React.useState(false)
  const [supplierSeed, setSupplierSeed] = React.useState('')
  const [materialFormOpen, setMaterialFormOpen] = React.useState(false)
  const [materialSeed, setMaterialSeed] = React.useState('')
  const [materialTargetLine, setMaterialTargetLine] = React.useState<string | null>(null)

  // Fill the number once, the moment the suggestion arrives; it stays editable.
  const [numberSeeded, setNumberSeeded] = React.useState(false)
  if (suggestedNo && !numberSeeded) {
    setNumberSeeded(true)
    setInvoiceNo(suggestedNo)
  }

  const validLines = lines.filter(
    (l) => l.raw_material_id && Number(l.quantity_kg) > 0 && Number(l.price_per_kg) >= 0,
  )

  const totals = purchaseTotals({
    lines: validLines.map((l) => ({
      quantity_kg: Number(l.quantity_kg),
      price_per_kg: Number(l.price_per_kg),
    })),
    freight_cost: Number(freight) || 0,
    other_cost: Number(other) || 0,
    discount: Number(discount) || 0,
    paid_amount: Number(paid) || 0,
  })

  /** Landed cost for a given editor row, matching the RPC's allocation exactly. */
  function landedFor(line: Line): number | null {
    const index = validLines.findIndex((l) => l.key === line.key)
    if (index < 0) return null
    return totals.lines[index]?.landed_cost_per_kg ?? null
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((ls) => [...ls, newLine()])
  }

  function removeLine(key: string) {
    setLines((ls) => (ls.length === 1 ? [newLine()] : ls.filter((l) => l.key !== key)))
  }

  const used = new Set(lines.map((l) => l.raw_material_id).filter(Boolean))
  const canSubmit = !!supplierId && validLines.length > 0 && !record.isPending

  async function submit() {
    if (!canSubmit) return
    try {
      const id = await record.mutateAsync({
        supplier_id: supplierId!,
        invoice_no: invoiceNo.trim() || null,
        purchase_date: purchaseDate,
        freight_cost: Number(freight) || 0,
        other_cost: Number(other) || 0,
        discount: Number(discount) || 0,
        paid_amount: Number(paid) || 0,
        payment_method: Number(paid) > 0 ? method : null,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
        items: validLines.map((l) => ({
          raw_material_id: l.raw_material_id!,
          quantity_kg: Number(l.quantity_kg),
          price_per_kg: Number(l.price_per_kg),
        })),
      })
      toast.success(
        `Purchase recorded — ${validLines.length} material${validLines.length === 1 ? '' : 's'} updated`,
      )
      router.push(`/purchases/${id}`)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Supplier and invoice</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Combobox
              options={(suppliers ?? []).map((s) => ({
                value: s.id,
                label: s.name,
                hint: s.city ?? undefined,
                keywords: s.company ?? '',
              }))}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Choose a supplier…"
              onCreate={(term) => {
                setSupplierSeed(term)
                setSupplierFormOpen(true)
              }}
              createLabel="Add supplier"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice">Invoice number</Label>
            <Input
              id="invoice"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="Supplier's bill number"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Purchase date</Label>
            <Input
              id="date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Materials received</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[220px]">Material</TableHead>
              <TableHead className="w-32 text-right">Quantity (kg)</TableHead>
              <TableHead className="w-32 text-right">Price / kg</TableHead>
              <TableHead className="w-32 text-right">Line total</TableHead>
              <TableHead className="w-32 text-right">Landed / kg</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const material = materials?.find((m) => m.id === line.raw_material_id)
              const qty = Number(line.quantity_kg) || 0
              const price = Number(line.price_per_kg) || 0
              const landed = landedFor(line)

              return (
                <TableRow key={line.key}>
                  <TableCell>
                    <Combobox
                      options={(materials ?? []).map((m) => ({
                        value: m.id,
                        label: m.name,
                        hint: `${formatKg(m.current_stock_kg)} kg${
                          m.last_price_per_kg ? ` · last ${num(m.last_price_per_kg).toFixed(0)}` : ''
                        }`,
                        keywords: m.code ?? '',
                        disabled: used.has(m.id) && m.id !== line.raw_material_id,
                      }))}
                      value={line.raw_material_id}
                      onChange={(v) => {
                        const picked = materials?.find((m) => m.id === v)
                        update(line.key, {
                          raw_material_id: v,
                          price_per_kg:
                            line.price_per_kg ||
                            (picked?.last_price_per_kg ? String(num(picked.last_price_per_kg)) : ''),
                        })
                      }}
                      placeholder="Choose a material…"
                      onCreate={(term) => {
                        setMaterialSeed(term)
                        setMaterialTargetLine(line.key)
                        setMaterialFormOpen(true)
                      }}
                      createLabel="Add material"
                    />
                    {material && (
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        In stock {formatKg(material.current_stock_kg)} kg · average{' '}
                        {num(material.avg_cost_per_kg).toFixed(2)}/kg
                      </div>
                    )}
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
                  <TableCell>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="h-9"
                      value={line.price_per_kg}
                      onChange={(e) => update(line.key, { price_per_kg: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addLine()
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="num text-right">
                    {qty > 0 && price >= 0 ? <Money value={qty * price} /> : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {landed == null ? (
                      '—'
                    ) : (
                      <span className={landed > price ? 'text-[var(--warn)]' : undefined}>
                        <Rate value={landed} />
                      </span>
                    )}
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
        </Table>

        <div className="border-t border-[var(--border)] p-3">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
          <span className="ml-3 text-xs text-[var(--muted-foreground)]">
            Enter in the price field adds another line.
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Extra costs</CardTitle>
          </CardHeader>
          <div className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="freight">Freight</Label>
                <Input
                  id="freight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={freight}
                  onChange={(e) => setFreight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="other">Other cost</Label>
                <Input
                  id="other"
                  type="number"
                  step="0.01"
                  min="0"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            {totals.extra > 0 && (
              <Alert>
                <AlertDescription>
                  Freight and other costs are allocated across lines by value, so each material&apos;s
                  average cost reflects what it truly cost to land.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <div className="space-y-2 px-4 pb-4 text-sm">
            <Row label="Subtotal" value={<Money value={totals.subtotal} />} />
            <Row label="Freight + other" value={<Money value={totals.extra} />} />
            <Row label="Discount" value={<Money value={-totals.discount} />} />
            <div className="border-t border-[var(--border)] pt-2">
              <Row
                label="Total"
                value={<Money value={totals.total} className="text-base font-semibold" />}
                bold
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="paid">Paid now</Label>
                <Input
                  id="paid"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod} disabled={!(Number(paid) > 0)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Row
              label="Balance owing"
              value={
                <Money
                  value={totals.balance}
                  className={totals.balance > 0.005 ? 'text-[var(--warn)]' : undefined}
                />
              }
            />

            {Number(paid) > totals.total + 0.005 && (
              <Alert variant="warn">
                <TriangleAlert />
                <AlertDescription>
                  Paid amount is more than the total. Check the figures before saving.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-3">
              <Button variant="outline" onClick={() => router.back()} disabled={record.isPending}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
                {record.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Record purchase
              </Button>
            </div>
            {!supplierId && (
              <p className="text-xs text-[var(--muted-foreground)]">Choose a supplier to continue.</p>
            )}
            {supplierId && validLines.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Add at least one line with a material and quantity.
              </p>
            )}
          </div>
        </Card>
      </div>

      <PartyForm
        kind="supplier"
        open={supplierFormOpen}
        onOpenChange={setSupplierFormOpen}
        initialName={supplierSeed}
        onSaved={(s) => setSupplierId(s.id)}
      />
      <MaterialForm
        open={materialFormOpen}
        onOpenChange={setMaterialFormOpen}
        initialName={materialSeed}
        onSaved={(m) => {
          if (materialTargetLine) update(materialTargetLine, { raw_material_id: m.id })
        }}
      />
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: React.ReactNode
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? 'font-medium' : 'text-[var(--muted-foreground)]'}>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
