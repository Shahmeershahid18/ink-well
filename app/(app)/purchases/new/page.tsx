'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseForm } from '@/components/purchases/purchase-form'
import { Skeleton } from '@/components/ui/skeleton'

function NewPurchase() {
  const params = useSearchParams()
  return (
    <PurchaseForm
      defaultSupplierId={params.get('supplier') ?? undefined}
      defaultMaterialId={params.get('material') ?? undefined}
    />
  )
}

export default function NewPurchasePage() {
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
        title="New purchase"
        description="Raw material in, weighted average cost updated, ledger written — in one transaction."
      />
      <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewPurchase />
      </React.Suspense>
    </>
  )
}
