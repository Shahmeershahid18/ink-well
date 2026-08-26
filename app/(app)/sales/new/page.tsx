'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { Skeleton } from '@/components/ui/skeleton'

function NewSale() {
  const params = useSearchParams()
  return <SaleForm defaultCustomerId={params.get('customer') ?? undefined} />
}

export default function NewSalePage() {
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
        title="New sale"
        description="Profit is snapshotted per line, so later cost changes never rewrite this sale."
      />
      <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewSale />
      </React.Suspense>
    </>
  )
}
