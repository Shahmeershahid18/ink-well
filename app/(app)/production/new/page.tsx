'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { BatchForm } from '@/components/production/batch-form'
import { Skeleton } from '@/components/ui/skeleton'

function NewBatch() {
  const params = useSearchParams()
  return <BatchForm defaultInkId={params.get('ink') ?? undefined} />
}

export default function NewBatchPage() {
  return (
    <>
      <PageHeader
        back={
          <Link
            href="/production"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Production
          </Link>
        }
        title="New production batch"
        description="Plan the batch now, complete it with the real yield when it comes off the mill."
      />
      <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewBatch />
      </React.Suspense>
    </>
  )
}
