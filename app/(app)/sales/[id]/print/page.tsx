'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { useSale } from '@/lib/queries/sales'
import { useSettings } from '@/lib/queries/dashboard'
import { formatDate, formatKg, formatMoney, num } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'

/**
 * The customer's copy. Profit, cost and margin never appear here — this document
 * leaves the building.
 */
export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>()
  const { data: sale, isLoading } = useSale(params.id)
  const { data: settings } = useSettings()

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!sale) return <EmptyState title="Sale not found" />

  const balance = num(sale.total) - num(sale.paid_amount)
  const totalKg = sale.sale_items.reduce((s, i) => s + num(i.quantity_kg), 0)

  return (
    <div className="print-page mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href={`/sales/${sale.id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to sale
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 print:border-0 print:p-0">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <h1 className="text-lg font-semibold">{settings?.company_name ?? 'My Ink Works'}</h1>
            {settings?.company_address && (
              <p className="mt-0.5 whitespace-pre-line text-xs text-[var(--muted-foreground)]">
                {settings.company_address}
              </p>
            )}
            {settings?.company_phone && (
              <p className="text-xs text-[var(--muted-foreground)]">{settings.company_phone}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              Invoice
            </div>
            <div className="num text-lg font-semibold">{sale.invoice_no ?? '—'}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {formatDate(sale.sale_date)}
            </div>
            {sale.status === 'cancelled' && (
              <div className="mt-1 text-xs font-semibold uppercase text-[var(--danger)]">
                Cancelled
              </div>
            )}
          </div>
        </header>

        <section className="mb-6">
          <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            Billed to
          </div>
          <div className="mt-1 font-medium">{sale.customer?.name}</div>
          {sale.customer?.company && (
            <div className="text-sm text-[var(--muted-foreground)]">{sale.customer.company}</div>
          )}
          {sale.customer?.address && (
            <div className="whitespace-pre-line text-xs text-[var(--muted-foreground)]">
              {sale.customer.address}
            </div>
          )}
          {(sale.customer?.city || sale.customer?.phone) && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {[sale.customer?.city, sale.customer?.phone].filter(Boolean).join(' · ')}
            </div>
          )}
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Quantity</th>
              <th className="py-2 text-right font-medium">Rate / kg</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.sale_items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)]">
                <td className="py-2">
                  {item.ink?.name}
                  {item.ink?.code && (
                    <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                      {item.ink.code}
                    </span>
                  )}
                </td>
                <td className="num py-2 text-right">{formatKg(item.quantity_kg)} kg</td>
                <td className="num py-2 text-right">{formatMoney(item.price_per_kg, 2)}</td>
                <td className="num py-2 text-right">{formatMoney(item.line_total, 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="num py-2 text-xs text-[var(--muted-foreground)]">
                {formatKg(totalKg)} kg total
              </td>
              <td colSpan={2} className="py-2 text-right text-[var(--muted-foreground)]">
                Subtotal
              </td>
              <td className="num py-2 text-right">{formatMoney(sale.subtotal, 2)}</td>
            </tr>
            {num(sale.discount) > 0 && (
              <tr>
                <td />
                <td colSpan={2} className="py-1 text-right text-[var(--muted-foreground)]">
                  Discount
                </td>
                <td className="num py-1 text-right">−{formatMoney(sale.discount, 2)}</td>
              </tr>
            )}
            <tr className="border-t border-[var(--border)]">
              <td />
              <td colSpan={2} className="py-2 text-right font-medium">
                Total ({settings?.currency ?? 'PKR'})
              </td>
              <td className="num py-2 text-right text-base font-semibold">
                {formatMoney(sale.total, 2)}
              </td>
            </tr>
            <tr>
              <td />
              <td colSpan={2} className="py-1 text-right text-[var(--muted-foreground)]">
                Paid
              </td>
              <td className="num py-1 text-right">{formatMoney(sale.paid_amount, 2)}</td>
            </tr>
            <tr>
              <td />
              <td colSpan={2} className="py-1 text-right font-medium">
                Balance due
              </td>
              <td className="num py-1 text-right font-semibold">{formatMoney(balance, 2)}</td>
            </tr>
          </tfoot>
        </table>

        {sale.notes && (
          <p className="mt-6 whitespace-pre-line text-xs text-[var(--muted-foreground)]">
            {sale.notes}
          </p>
        )}

        <footer className="mt-10 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
          Thank you for your business.
        </footer>
      </div>
    </div>
  )
}
