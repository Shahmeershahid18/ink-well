'use client'

import * as React from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { num } from '@/lib/format'
import { marginPct } from '@/lib/calc/costing'
import {
  useCustomerPrices,
  useDeleteCustomerPrice,
  useSaveCustomerPrice,
} from '@/lib/queries/parties'
import { useInks } from '@/lib/queries/inks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { InkName } from '@/components/shared/badges'
import { Money, Percent, Rate } from '@/components/shared/money'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function CustomerPrices({ customerId }: { customerId: string }) {
  const { data: prices } = useCustomerPrices(customerId)
  const { data: inks } = useInks(true)
  const savePrice = useSaveCustomerPrice()
  const deletePrice = useDeleteCustomerPrice()

  const [newInkId, setNewInkId] = React.useState<string | null>(null)
  const [newPrice, setNewPrice] = React.useState('')
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})

  const priced = React.useMemo(() => {
    return (prices ?? []).map((p) => ({
      ...p,
      ink: inks?.find((i) => i.id === p.ink_id),
    }))
  }, [prices, inks])

  const available = (inks ?? []).filter((i) => !prices?.some((p) => p.ink_id === i.id))

  async function add() {
    const value = Number(newPrice)
    if (!newInkId || !Number.isFinite(value) || value <= 0) return
    try {
      await savePrice.mutateAsync({
        customer_id: customerId,
        ink_id: newInkId,
        price_per_kg: value,
      })
      setNewInkId(null)
      setNewPrice('')
      toast.success('Agreed price saved')
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  async function update(inkId: string, raw: string) {
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return
    try {
      await savePrice.mutateAsync({ customer_id: customerId, ink_id: inkId, price_per_kg: value })
      setDrafts((d) => {
        const next = { ...d }
        delete next[inkId]
        return next
      })
      toast.success('Price updated')
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">Ink</div>
            <Combobox
              options={available.map((i) => ({
                value: i.id,
                label: i.name,
                color: i.color_hex,
                hint: i.default_price_per_kg ? `list ${num(i.default_price_per_kg).toFixed(0)}` : undefined,
              }))}
              value={newInkId}
              onChange={setNewInkId}
              placeholder="Choose an ink…"
              emptyText="Every ink already has an agreed price."
            />
          </div>
          <div className="w-36">
            <div className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              Agreed price / kg
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <Button onClick={add} disabled={!newInkId || !newPrice || savePrice.isPending}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </Card>

      {priced.length === 0 ? (
        <Card>
          <EmptyState
            title="No agreed prices"
            description="Set a price per ink and the sale form will use it instead of the list price for this customer."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ink</TableHead>
                <TableHead className="text-right">Current cost/kg</TableHead>
                <TableHead className="text-right">List price</TableHead>
                <TableHead className="text-right">Agreed price</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {priced.map((row) => {
                const cost = num(row.ink?.avg_cost_per_kg)
                const draft = drafts[row.ink_id]
                const price = draft !== undefined ? Number(draft) : num(row.price_per_kg)
                const margin = marginPct(price, cost)
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <InkName
                        name={row.ink?.name ?? 'Unknown ink'}
                        color={row.ink?.color_hex}
                        code={row.ink?.code}
                      />
                    </TableCell>
                    <TableCell className="num text-right">
                      <Rate value={cost} />
                    </TableCell>
                    <TableCell className="num text-right text-[var(--muted-foreground)]">
                      {row.ink?.default_price_per_kg ? (
                        <Rate value={row.ink.default_price_per_kg} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-28"
                          value={draft ?? String(num(row.price_per_kg))}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [row.ink_id]: e.target.value }))
                          }
                          onKeyDown={(e) =>
                            e.key === 'Enter' && update(row.ink_id, (e.target as HTMLInputElement).value)
                          }
                        />
                        {draft !== undefined && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => update(row.ink_id, draft)}
                            aria-label="Save price"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="num text-right">
                      <Percent value={margin} signed />
                      <div className="text-xs text-[var(--muted-foreground)]">
                        <Money value={price - cost} dp={0} signed />/kg
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove agreed price"
                        onClick={() =>
                          deletePrice.mutate({ id: row.id, customer_id: customerId })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
