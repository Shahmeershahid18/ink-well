'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { useCancelPurchase, usePurchase } from '@/lib/queries/purchases'
import { useMovements } from '@/lib/queries/dashboard'
import { formatDate, formatDateTime, formatKg, num } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Rate, Weight } from '@/components/shared/money'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PaymentDialog } from '@/components/parties/payment-dialog'
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

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: purchase, isLoading } = usePurchase(id)
  const { data: movements } = useMovements({ limit: 100 })
  const cancel = useCancelPurchase()

  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)

  const related = (movements ?? []).filter((m) => m.ref_table === 'purchases' && m.ref_id === id)

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!purchase) {
    return (
      <EmptyState
        title="Purchase not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/purchases')}>
            Back to purchases
          </Button>
        }
      />
    )
  }

  const balance = num(purchase.total) - num(purchase.paid_amount)

  async function doCancel(reason?: string) {
    try {
      await cancel.mutateAsync({ id, reason })
      toast.success('Purchase cancelled and stock reversed')
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
            href="/purchases"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Purchases
          </Link>
        }
        title={purchase.invoice_no || 'Purchase'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDate(purchase.purchase_date)} ·{' '}
            <Link href={`/suppliers/${purchase.supplier_id}`} className="hover:underline">
              {purchase.supplier?.name}
            </Link>
            <StatusBadge status={purchase.status} />
            {purchase.status === 'received' && (
              <PaymentBadge total={purchase.total} paid={purchase.paid_amount} />
            )}
          </span>
        }
        actions={
          purchase.status === 'received' ? (
            <>
              {balance > 0.005 && (
                <Button variant="outline" onClick={() => setPayOpen(true)}>
                  <Banknote className="h-4 w-4" />
                  Record payment
                </Button>
              )}
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Cancel purchase
              </Button>
            </>
          ) : undefined
        }
      />

      {purchase.status === 'cancelled' && (
        <Alert variant="danger" className="mb-4">
          <AlertDescription>
            This purchase was cancelled{purchase.cancelled_at ? ` on ${formatDate(purchase.cancelled_at)}` : ''}.
            Reversing movements were written to the ledger; nothing was deleted.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={<Money value={purchase.total} dp={0} />} sub={`${purchase.purchase_items.length} lines`} />
        <StatCard label="Paid" value={<Money value={purchase.paid_amount} dp={0} />} sub="Against this invoice" />
        <StatCard
          label="Balance"
          value={<Money value={balance} dp={0} />}
          sub={balance > 0.005 ? 'Still owing' : 'Settled'}
        />
        <StatCard
          label="Freight + other"
          value={<Money value={num(purchase.freight_cost) + num(purchase.other_cost)} dp={0} />}
          sub="Allocated into landed cost"
        />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price/kg</TableHead>
              <TableHead className="text-right">Landed/kg</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.purchase_items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    href={`/raw-materials/${item.raw_material_id}`}
                    className="font-medium hover:underline"
                  >
                    {item.raw_material?.name ?? 'Unknown material'}
                  </Link>
                  {item.raw_material?.code && (
                    <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                      {item.raw_material.code}
                    </span>
                  )}
                </TableCell>
                <TableCell className="num text-right">
                  <Weight value={item.quantity_kg} unit={item.raw_material?.unit ?? 'kg'} />
                </TableCell>
                <TableCell className="num text-right">
                  <Rate value={item.price_per_kg} />
                </TableCell>
                <TableCell className="num text-right">
                  <span
                    className={
                      num(item.landed_cost_per_kg) > num(item.price_per_kg)
                        ? 'text-[var(--warn)]'
                        : undefined
                    }
                  >
                    <Rate value={item.landed_cost_per_kg} dp={4} />
                  </span>
                </TableCell>
                <TableCell className="num text-right">
                  <Money value={item.line_total} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right text-[var(--muted-foreground)]">
                Subtotal
              </TableCell>
              <TableCell className="num text-right">
                <Money value={purchase.subtotal} />
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right text-[var(--muted-foreground)]">
                Freight + other
              </TableCell>
              <TableCell className="num text-right">
                <Money value={num(purchase.freight_cost) + num(purchase.other_cost)} />
              </TableCell>
            </TableRow>
            {num(purchase.discount) > 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-right text-[var(--muted-foreground)]">
                  Discount
                </TableCell>
                <TableCell className="num text-right">
                  <Money value={-num(purchase.discount)} />
                </TableCell>
              </TableRow>
            )}
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="num text-right font-semibold">
                <Money value={purchase.total} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      {related.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Stock movements written by this purchase</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Cost/kg</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {related.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-[var(--muted-foreground)]">
                    {formatDateTime(m.created_at)}
                  </TableCell>
                  <TableCell className="capitalize">{m.movement_type.replace('_', ' ')}</TableCell>
                  <TableCell className="num text-right">
                    {num(m.quantity_kg) > 0 ? '+' : ''}
                    {formatKg(m.quantity_kg)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {m.cost_per_kg == null ? '—' : <Rate value={m.cost_per_kg} />}
                  </TableCell>
                  <TableCell className="num text-right">{formatKg(m.balance_after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {purchase.notes && (
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">{purchase.notes}</p>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this purchase?"
        description="Stock will be reduced by the received quantities and the weighted average cost will be rolled back. The purchase stays on record as cancelled — nothing is deleted."
        confirmLabel="Cancel purchase"
        cancelLabel="Keep it"
        destructive
        reasonLabel="Reason"
        reasonRequired
        pending={cancel.isPending}
        onConfirm={doCancel}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        kind="supplier"
        partyId={purchase.supplier_id}
        partyName={purchase.supplier?.name ?? 'Supplier'}
        refTable="purchases"
        refId={purchase.id}
        suggestedAmount={balance}
      />
    </>
  )
}
