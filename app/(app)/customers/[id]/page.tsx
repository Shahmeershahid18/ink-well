'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Banknote, Pencil, Plus } from 'lucide-react'
import { useCustomer, useCustomerSummary, usePartyPayments } from '@/lib/queries/parties'
import { useSales } from '@/lib/queries/sales'
import { formatDate } from '@/lib/format'
import type { Payment, SaleWithCustomer } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Percent, Weight } from '@/components/shared/money'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { PartyForm } from '@/components/parties/party-form'
import { PaymentDialog } from '@/components/parties/payment-dialog'
import { CustomerPrices } from '@/components/parties/customer-prices'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: customer, isLoading } = useCustomer(id)
  const { data: summaries } = useCustomerSummary()
  const { data: sales, isLoading: salesLoading } = useSales({ customerId: id })
  const { data: payments } = usePartyPayments('customer', id)

  const [editOpen, setEditOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)

  const summary = summaries?.find((s) => s.id === id)

  const saleColumns: Column<SaleWithCustomer>[] = [
    {
      key: 'sale_date',
      header: 'Date',
      sortValue: (r) => r.sale_date,
      cell: (r) => formatDate(r.sale_date),
    },
    {
      key: 'invoice_no',
      header: 'Invoice',
      sortValue: (r) => r.invoice_no ?? '',
      cell: (r) => <span className="num text-xs">{r.invoice_no ?? '—'}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      sortValue: (r) => Number(r.total),
      cell: (r) => <Money value={r.total} />,
    },
    {
      key: 'profit_total',
      header: 'Profit',
      numeric: true,
      hideBelow: 'sm',
      sortValue: (r) => Number(r.profit_total),
      cell: (r) => <Money value={r.profit_total} signed />,
    },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      sortValue: (r) => Number(r.total) - Number(r.paid_amount),
      cell: (r) => <Money value={Number(r.total) - Number(r.paid_amount)} />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'confirmed' && <PaymentBadge total={r.total} paid={r.paid_amount} />}
          <StatusBadge status={r.status} />
        </div>
      ),
    },
  ]

  const paymentColumns: Column<Payment>[] = [
    { key: 'paid_on', header: 'Date', sortValue: (r) => r.paid_on, cell: (r) => formatDate(r.paid_on) },
    { key: 'method', header: 'Method', cell: (r) => <span className="capitalize">{r.method ?? '—'}</span> },
    { key: 'reference', header: 'Reference', cell: (r) => r.reference ?? '—' },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      sortValue: (r) => Number(r.amount),
      cell: (r) => <Money value={r.amount} />,
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!customer) {
    return (
      <EmptyState
        title="Customer not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/customers')}>
            Back to customers
          </Button>
        }
      />
    )
  }

  const revenue = Number(summary?.revenue ?? 0)
  const profit = Number(summary?.profit ?? 0)

  return (
    <>
      <PageHeader
        back={
          <Link
            href="/customers"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Customers
          </Link>
        }
        title={customer.name}
        description={
          [customer.company, customer.city, customer.phone].filter(Boolean).join(' · ') || undefined
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              <Banknote className="h-4 w-4" />
              Record payment
            </Button>
            <Button asChild>
              <Link href={`/sales/new?customer=${customer.id}`}>
                <Plus className="h-4 w-4" />
                New sale
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={<Money value={revenue} dp={0} />}
          sub={`${summary?.orders ?? 0} orders`}
        />
        <StatCard
          label="Profit"
          value={<Money value={profit} dp={0} signed />}
          sub={revenue > 0 ? <Percent value={(profit / revenue) * 100} /> : 'No sales yet'}
        />
        <StatCard
          label="Volume"
          value={<Weight value={summary?.total_kg ?? 0} />}
          sub="Ink delivered"
        />
        <StatCard
          label="Receivable"
          value={<Money value={summary?.receivable ?? 0} dp={0} />}
          sub={
            Number(summary?.receivable ?? 0) > 0.005 ? 'Outstanding balance' : 'Fully settled'
          }
        />
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="prices">Agreed prices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <DataTable
            columns={saleColumns}
            rows={sales}
            loading={salesLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/sales/${r.id}`)}
            defaultSort={{ key: 'sale_date', dir: 'desc' }}
            empty={
              <EmptyState
                title="No orders from this customer yet"
                description="Record a sale to start tracking their revenue and profit."
                action={
                  <Button asChild>
                    <Link href={`/sales/new?customer=${customer.id}`}>New sale</Link>
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="prices">
          <CustomerPrices customerId={customer.id} />
        </TabsContent>

        <TabsContent value="payments">
          <DataTable
            columns={paymentColumns}
            rows={payments}
            rowKey={(r) => r.id}
            defaultSort={{ key: 'paid_on', dir: 'desc' }}
            empty={
              <EmptyState
                title="No payments recorded"
                description="Payments taken with a sale appear here automatically."
              />
            }
          />
        </TabsContent>
      </Tabs>

      <PartyForm kind="customer" open={editOpen} onOpenChange={setEditOpen} party={customer} />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        kind="customer"
        partyId={customer.id}
        partyName={customer.name}
        suggestedAmount={Number(summary?.receivable ?? 0)}
      />
    </>
  )
}
