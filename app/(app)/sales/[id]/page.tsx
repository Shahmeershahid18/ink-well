'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Banknote, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { useCancelSale, useSale } from '@/lib/queries/sales'
import { formatDate, num } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Rate, Weight } from '@/components/shared/money'
import { InkName, PaymentBadge, StatusBadge } from '@/components/shared/badges'
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

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: sale, isLoading } = useSale(id)
  const cancel = useCancelSale()

  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!sale) {
    return (
      <EmptyState
        title="Sale not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/sales')}>
            Back to sales
          </Button>
        }
      />
    )
  }

  const balance = num(sale.total) - num(sale.paid_amount)
  const marginPct = num(sale.total) > 0 ? (num(sale.profit_total) / num(sale.total)) * 100 : 0
  const totalKg = sale.sale_items.reduce((s, i) => s + num(i.quantity_kg), 0)

  async function doCancel(reason?: string) {
    try {
      await cancel.mutateAsync({ id, reason })
      toast.success('Sale cancelled and ink returned to stock')
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
            href="/sales"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Sales
          </Link>
        }
        title={sale.invoice_no || 'Sale'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDate(sale.sale_date)} ·{' '}
            <Link href={`/customers/${sale.customer_id}`} className="hover:underline">
              {sale.customer?.name}
            </Link>
            <StatusBadge status={sale.status} />
            {sale.status === 'confirmed' && (
              <PaymentBadge total={sale.total} paid={sale.paid_amount} />
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/sales/${sale.id}/print`}>
                <Printer className="h-4 w-4" />
                Invoice
              </Link>
            </Button>
            {sale.status === 'confirmed' && (
              <>
                {balance > 0.005 && (
                  <Button variant="outline" onClick={() => setPayOpen(true)}>
                    <Banknote className="h-4 w-4" />
                    Record payment
                  </Button>
                )}
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" />
                  Cancel sale
                </Button>
              </>
            )}
          </>
        }
      />

      {sale.status === 'cancelled' && (
        <Alert variant="danger" className="mb-4">
          <AlertDescription>
            This sale was cancelled{sale.cancelled_at ? ` on ${formatDate(sale.cancelled_at)}` : ''}.
            The ink went back into stock at its snapshot cost; the sale stays on record.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={<Money value={sale.total} dp={0} />} sub={`${sale.sale_items.length} lines`} />
        <StatCard label="Volume" value={<Weight value={totalKg} />} sub="Ink delivered" />
        <StatCard
          label="Cost of goods"
          value={<Money value={sale.cogs_total} dp={0} />}
          sub="Snapshotted at sale time"
        />
        <StatCard
          label="Profit"
          value={<Money value={sale.profit_total} dp={0} signed />}
          sub={<Percent value={marginPct} />}
        />
        <StatCard
          label="Balance"
          value={<Money value={balance} dp={0} />}
          sub={balance > 0.005 ? 'Still owing' : 'Settled'}
        />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ink</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price/kg</TableHead>
              <TableHead className="text-right">Cost/kg</TableHead>
              <TableHead className="text-right">Line total</TableHead>
              <TableHead className="text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.sale_items.map((item) => {
              const lineMargin =
                num(item.line_total) > 0 ? (num(item.line_profit) / num(item.line_total)) * 100 : 0
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/inks/${item.ink_id}`} className="hover:underline">
                      <InkName
                        name={item.ink?.name ?? 'Unknown ink'}
                        color={item.ink?.color_hex}
                        code={item.ink?.code}
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="num text-right">
                    <Weight value={item.quantity_kg} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <Rate value={item.price_per_kg} />
                  </TableCell>
                  <TableCell className="num text-right text-[var(--muted-foreground)]">
                    <Rate value={item.cost_per_kg_snapshot} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <Money value={item.line_total} />
                  </TableCell>
                  <TableCell className="num text-right">
                    <Money value={item.line_profit} signed />
                    <div className="text-xs text-[var(--muted-foreground)]">
                      <Percent value={lineMargin} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right text-[var(--muted-foreground)]">
                Subtotal
              </TableCell>
              <TableCell className="num text-right">
                <Money value={sale.subtotal} />
              </TableCell>
              <TableCell />
            </TableRow>
            {num(sale.discount) > 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-right text-[var(--muted-foreground)]">
                  Discount
                </TableCell>
                <TableCell className="num text-right">
                  <Money value={-num(sale.discount)} />
                </TableCell>
                <TableCell />
              </TableRow>
            )}
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="num text-right font-semibold">
                <Money value={sale.total} />
              </TableCell>
              <TableCell className="num text-right font-semibold">
                <Money value={sale.profit_total} signed />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      {sale.notes && <p className="text-xs text-[var(--muted-foreground)]">{sale.notes}</p>}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this sale?"
        description="The ink goes back into stock at the cost snapshotted on each line, and the profit is reversed. The invoice stays on record as cancelled."
        confirmLabel="Cancel sale"
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
        kind="customer"
        partyId={sale.customer_id}
        partyName={sale.customer?.name ?? 'Customer'}
        refTable="sales"
        refId={sale.id}
        suggestedAmount={balance}
      />
    </>
  )
}
