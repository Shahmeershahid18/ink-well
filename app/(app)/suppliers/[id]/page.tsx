'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Banknote, Pencil, Plus } from 'lucide-react'
import {
  usePartyPayments,
  useSupplier,
  useSupplierSummary,
} from '@/lib/queries/parties'
import { usePurchases } from '@/lib/queries/purchases'
import { formatDate } from '@/lib/format'
import type { Payment, PurchaseWithSupplier } from '@/types/database'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Money } from '@/components/shared/money'
import { PaymentBadge, StatusBadge } from '@/components/shared/badges'
import { PartyForm } from '@/components/parties/party-form'
import { PaymentDialog } from '@/components/parties/payment-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: supplier, isLoading } = useSupplier(id)
  const { data: summaries } = useSupplierSummary()
  const { data: purchases, isLoading: purchasesLoading } = usePurchases({ supplierId: id })
  const { data: payments } = usePartyPayments('supplier', id)

  const [editOpen, setEditOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)

  const summary = summaries?.find((s) => s.id === id)

  const purchaseColumns: Column<PurchaseWithSupplier>[] = [
    {
      key: 'purchase_date',
      header: 'Date',
      sortValue: (r) => r.purchase_date,
      cell: (r) => formatDate(r.purchase_date),
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
          {r.status === 'received' && <PaymentBadge total={r.total} paid={r.paid_amount} />}
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
  if (!supplier) {
    return (
      <EmptyState
        title="Supplier not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/suppliers')}>
            Back to suppliers
          </Button>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        back={
          <Link
            href="/suppliers"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Suppliers
          </Link>
        }
        title={supplier.name}
        description={
          [supplier.company, supplier.city, supplier.phone].filter(Boolean).join(' · ') || undefined
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
              <Link href={`/purchases/new?supplier=${supplier.id}`}>
                <Plus className="h-4 w-4" />
                New purchase
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total spend"
          value={<Money value={summary?.total_spend ?? 0} dp={0} />}
          sub={`${summary?.purchase_count ?? 0} purchases`}
        />
        <StatCard
          label="Payable"
          value={<Money value={summary?.payable ?? 0} dp={0} />}
          sub={
            Number(summary?.payable ?? 0) > 0.005 ? 'Outstanding balance' : 'Fully settled'
          }
        />
        <StatCard
          label="Last purchase"
          value={
            <span className="text-lg">
              {summary?.last_purchase_date ? formatDate(summary.last_purchase_date) : 'Never'}
            </span>
          }
          sub={supplier.email ?? undefined}
        />
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <DataTable
            columns={purchaseColumns}
            rows={purchases}
            loading={purchasesLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/purchases/${r.id}`)}
            defaultSort={{ key: 'purchase_date', dir: 'desc' }}
            empty={
              <EmptyState
                title="No purchases from this supplier yet"
                description="Record a purchase to build up their history and payable balance."
                action={
                  <Button asChild>
                    <Link href={`/purchases/new?supplier=${supplier.id}`}>New purchase</Link>
                  </Button>
                }
              />
            }
          />
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
                description="Payments made with a purchase appear here automatically."
              />
            }
          />
        </TabsContent>
      </Tabs>

      <PartyForm kind="supplier" open={editOpen} onOpenChange={setEditOpen} party={supplier} />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        kind="supplier"
        partyId={supplier.id}
        partyName={supplier.name}
        suggestedAmount={Number(summary?.payable ?? 0)}
      />
    </>
  )
}
