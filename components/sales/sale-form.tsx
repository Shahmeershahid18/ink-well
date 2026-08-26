'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn, humanError } from '@/lib/utils'
import { formatKg, num, today } from '@/lib/format'
import { saleLineTotals, saleTotals } from '@/lib/calc/costing'
import { PAYMENT_METHODS } from '@/lib/constants'
import { useInks } from '@/lib/queries/inks'
import { useCustomerPrices, useCustomers } from '@/lib/queries/parties'
import { useRecordSale } from '@/lib/queries/sales'
import { useNextDocumentNo } from '@/lib/queries/purchases'
import { PartyForm } from '@/components/parties/party-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Money, Percent } from '@/components/shared/money'
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
  ink_id: string | null
  quantity_kg: string
  price_per_kg: string
}

let seq = 0
const newLine = (): Line => ({ key: `sl-${++seq}`, ink_id: null, quantity_kg: '', price_per_kg: '' })

export function SaleForm({ defaultCustomerId }: { defaultCustomerId?: string }) {
  const router = useRouter()
  const { data: customers } = useCustomers(true)
  const { data: inks } = useInks(true)
  const { data: suggestedNo } = useNextDocumentNo('invoice')
  const record = useRecordSale()

  const idempotencyKey = React.useMemo(() => nanoid(), [])

  const [customerId, setCustomerId] = React.useState<string | null>(defaultCustomerId ?? null)
  const [invoiceNo, setInvoiceNo] = React.useState('')
  const [saleDate, setSaleDate] = React.useState(today())
  const [lines, setLines] = React.useState<Line[]>([newLine()])
  const [discount, setDiscount] = React.useState('0')
  const [paid, setPaid] = React.useState('0')
  const [method, setMethod] = React.useState('cash')
  const [notes, setNotes] = React.useState('')
  const [customerFormOpen, setCustomerFormOpen] = React.useState(false)
  const [customerSeed, setCustomerSeed] = React.useState('')

  const { data: agreedPrices } = useCustomerPrices(customerId ?? undefined)

  // Fill the number once, the moment the suggestion arrives; it stays editable.
  const [numberSeeded, setNumberSeeded] = React.useState(false)
  if (suggestedNo && !numberSeeded) {
    setNumberSeeded(true)
    setInvoiceNo(suggestedNo)
  }

  /** Agreed price for this customer, then the ink's list price. */
  const priceFor = React.useCallback(
    (inkId: string): string => {
      const agreed = agreedPrices?.find((p) => p.ink_id === inkId)
      if (agreed) return String(num(agreed.price_per_kg))
      const ink = inks?.find((i) => i.id === inkId)
      return ink?.default_price_per_kg ? String(num(ink.default_price_per_kg)) : ''
    },
    [agreedPrices, inks],
  )

  /**
   * An untouched price field means "use the agreed or list price", resolved at render.
   * Switching customer therefore re-prices every line the operator has not typed into,
   * with no state to keep in sync.
   */
  const resolvedPrice = React.useCallback(
    (line: Line): string =>
      line.price_per_kg !== '' ? line.price_per_kg : line.ink_id ? priceFor(line.ink_id) : '',
    [priceFor],
  )

  const priced = lines
    .filter((l) => l.ink_id && Number(l.quantity_kg) > 0 && Number(resolvedPrice(l)) >= 0)
    .map((l) => {
      const ink = inks?.find((i) => i.id === l.ink_id)
      return {
        ...l,
        quantity_kg_n: Number(l.quantity_kg),
        price_per_kg_n: Number(resolvedPrice(l)),
        cost_per_kg: num(ink?.avg_cost_per_kg),
        available: num(ink?.current_stock_kg),
      }
    })

  const totals = saleTotals(
    priced.map((l) => ({
      quantity_kg: l.quantity_kg_n,
      price_per_kg: l.price_per_kg_n,
      cost_per_kg: l.cost_per_kg,
    })),
    Number(discount) || 0,
    Number(paid) || 0,
  )

  const shortfalls = priced.filter((l) => l.quantity_kg_n > l.available)
  const used = new Set(lines.map((l) => l.ink_id).filter(Boolean))
  const canSubmit =
    !!customerId && priced.length > 0 && shortfalls.length === 0 && !record.isPending

  function update(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((ls) => [...ls, newLine()])
  }

  function removeLine(key: string) {
    setLines((ls) => (ls.length === 1 ? [newLine()] : ls.filter((l) => l.key !== key)))
  }

  async function submit() {
    if (!canSubmit) return
    try {
      const id = await record.mutateAsync({
        customer_id: customerId!,
        invoice_no: invoiceNo.trim() || null,
        sale_date: saleDate,
        discount: Number(discount) || 0,
        paid_amount: Number(paid) || 0,
        payment_method: Number(paid) > 0 ? method : null,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
        items: priced.map((l) => ({
          ink_id: l.ink_id!,
          quantity_kg: l.quantity_kg_n,
          price_per_kg: l.price_per_kg_n,
        })),
      })
      toast.success('Sale recorded — profit locked in at today’s cost')
      router.push(`/sales/${id}`)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Customer and invoice</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Combobox
              options={(customers ?? []).map((c) => ({
                value: c.id,
                label: c.name,
                hint: c.city ?? undefined,
                keywords: c.company ?? '',
              }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Choose a customer…"
              onCreate={(term) => {
                setCustomerSeed(term)
                setCustomerFormOpen(true)
              }}
              createLabel="Add customer"
            />
            {customerId && agreedPrices && agreedPrices.length > 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {agreedPrices.length} agreed price{agreedPrices.length === 1 ? '' : 's'} on file —
                used automatically.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice">Invoice number</Label>
            <Input
              id="invoice"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-date">Sale date</Label>
            <Input
              id="sale-date"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Ink sold</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[220px]">Ink</TableHead>
              <TableHead className="w-32 text-right">Quantity (kg)</TableHead>
              <TableHead className="w-32 text-right">Price / kg</TableHead>
              <TableHead className="w-32 text-right">Line total</TableHead>
              <TableHead className="w-36 text-right">Profit</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const ink = inks?.find((i) => i.id === line.ink_id)
              const qty = Number(line.quantity_kg) || 0
              const priceText = resolvedPrice(line)
              const price = Number(priceText) || 0
              const cost = num(ink?.avg_cost_per_kg)
              const available = num(ink?.current_stock_kg)
              const short = ink ? qty > available : false
              const line_totals = saleLineTotals({
                quantity_kg: qty,
                price_per_kg: price,
                cost_per_kg: cost,
              })
              const belowCost = ink && qty > 0 && price > 0 && line_totals.belowCost

              return (
                <TableRow
                  key={line.key}
                  className={cn(belowCost && 'bg-[var(--danger-soft)]/40')}
                >
                  <TableCell>
                    <Combobox
                      options={(inks ?? []).map((i) => ({
                        value: i.id,
                        label: i.name,
                        color: i.color_hex,
                        hint: `${formatKg(i.current_stock_kg)} kg available`,
                        keywords: i.code ?? '',
                        disabled: used.has(i.id) && i.id !== line.ink_id,
                      }))}
                      value={line.ink_id}
                      onChange={(v) => update(line.key, { ink_id: v })}
                      placeholder="Choose an ink…"
                    />
                    {ink && (
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatKg(available)} kg available · cost {cost.toFixed(2)}/kg
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      className={cn('h-9', short && 'border-[var(--danger)]')}
                      value={line.quantity_kg}
                      onChange={(e) => update(line.key, { quantity_kg: e.target.value })}
                    />
                    {short && (
                      <div className="mt-1 text-xs text-[var(--danger)]">
                        short {formatKg(qty - available)} kg
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="h-9"
                      value={priceText}
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
                    {qty > 0 ? <Money value={line_totals.lineTotal} /> : '—'}
                  </TableCell>
                  <TableCell className="num text-right">
                    {ink && qty > 0 ? (
                      <div>
                        <Money value={line_totals.lineProfit} signed />
                        <div className="text-xs">
                          <Percent value={line_totals.marginPct} signed />
                        </div>
                      </div>
                    ) : (
                      '—'
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
        </div>
      </Card>

      {shortfalls.length > 0 && (
        <Alert variant="danger">
          <TriangleAlert />
          <AlertDescription>
            <div className="font-medium">Not enough ink in stock.</div>
            <ul className="mt-1 space-y-0.5">
              {shortfalls.map((l) => {
                const ink = inks?.find((i) => i.id === l.ink_id)
                return (
                  <li key={l.key} className="num">
                    {ink?.name}: selling {formatKg(l.quantity_kg_n)} kg but only{' '}
                    {formatKg(l.available)} kg on hand — short{' '}
                    {formatKg(l.quantity_kg_n - l.available)} kg.
                  </li>
                )
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {totals.belowCost && (
        <Alert variant="danger">
          <TriangleAlert />
          <AlertDescription>
            Selling below cost on at least one line. Check the price before recording — the profit
            on this sale is locked the moment you save it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            <Textarea
              rows={4}
              placeholder="Delivery instructions, PO reference…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <div className="space-y-2 px-4 pb-4 text-sm">
            <Row label="Subtotal" value={<Money value={totals.subtotal} />} />
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="discount" className="text-sm">
                Discount
              </Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                className="h-8 w-32"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="border-t border-[var(--border)] pt-2">
              <Row label="Total" value={<Money value={totals.total} />} bold />
              <Row label="Estimated cost of goods" value={<Money value={totals.cogs} />} />
              <Row
                label="Estimated profit"
                value={
                  <span>
                    <Money value={totals.profit} signed className="font-semibold" />
                    <span className="ml-1.5 text-xs">
                      <Percent value={totals.marginPct} signed />
                    </span>
                  </span>
                }
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
              label="Balance"
              value={
                <Money
                  value={totals.balance}
                  className={totals.balance > 0.005 ? 'text-[var(--warn)]' : undefined}
                />
              }
            />

            <div className="flex gap-2 pt-3">
              <Button variant="outline" onClick={() => router.back()} disabled={record.isPending}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
                {record.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Record sale
              </Button>
            </div>
            {!customerId && (
              <p className="text-xs text-[var(--muted-foreground)]">Choose a customer to continue.</p>
            )}
            {shortfalls.length > 0 && (
              <p className="text-xs text-[var(--danger)]">
                Reduce the quantities or produce more ink first.
              </p>
            )}
          </div>
        </Card>
      </div>

      <PartyForm
        kind="customer"
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        initialName={customerSeed}
        onSaved={(c) => setCustomerId(c.id)}
      />
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

