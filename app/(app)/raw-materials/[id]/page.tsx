'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Scale, ShoppingCart } from 'lucide-react'
import {
  useItemMovements,
  useMaterialPriceHistory,
  useMaterialUsage,
  useRawMaterial,
} from '@/lib/queries/materials'
import { num } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Money, Rate, Weight } from '@/components/shared/money'
import { StockBadge } from '@/components/shared/badges'
import { MovementLedger } from '@/components/materials/movement-ledger'
import { MaterialForm } from '@/components/materials/material-form'
import { AdjustStockDialog } from '@/components/materials/adjust-stock-dialog'
import { PriceHistoryChart } from '@/components/materials/price-history-chart'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function RawMaterialDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: material, isLoading } = useRawMaterial(id)
  const { data: usageRows } = useMaterialUsage()
  const { data: movements, isLoading: movementsLoading } = useItemMovements('raw', id)
  const { data: priceHistory } = useMaterialPriceHistory(id)

  const [editOpen, setEditOpen] = React.useState(false)
  const [adjustOpen, setAdjustOpen] = React.useState(false)

  const usage = usageRows?.find((u) => u.id === id)

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!material) {
    return (
      <EmptyState
        title="Material not found"
        description="It may have been removed."
        action={
          <Button variant="outline" onClick={() => router.push('/raw-materials')}>
            Back to raw materials
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
            href="/raw-materials"
            className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Raw materials
          </Link>
        }
        title={material.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {[material.code, material.category].filter(Boolean).join(' · ') || 'Uncategorised'}
            <StockBadge
              stockKg={material.current_stock_kg}
              reorderKg={material.reorder_level_kg}
            />
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>
              <Scale className="h-4 w-4" />
              Adjust stock
            </Button>
            <Button asChild>
              <Link href={`/purchases/new?material=${material.id}`}>
                <ShoppingCart className="h-4 w-4" />
                Purchase
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="In stock"
          value={<Weight value={material.current_stock_kg} unit={material.unit} />}
          sub={
            num(material.reorder_level_kg) > 0
              ? `Reorder at ${num(material.reorder_level_kg)} ${material.unit}`
              : 'No reorder level set'
          }
        />
        <StatCard
          label="Average cost/kg"
          value={<Rate value={material.avg_cost_per_kg} />}
          sub={
            material.last_price_per_kg
              ? `Last landed ${num(material.last_price_per_kg).toFixed(2)}`
              : 'No purchases yet'
          }
        />
        <StatCard
          label="Stock value"
          value={
            <Money
              value={num(material.current_stock_kg) * num(material.avg_cost_per_kg)}
              dp={0}
            />
          }
          sub="At weighted average"
        />
        <StatCard
          label="Purchased to date"
          value={<Weight value={usage?.purchased_kg ?? 0} unit={material.unit} />}
          sub={<Money value={usage?.purchase_value ?? 0} dp={0} prefix="worth " />}
        />
        <StatCard
          label="Consumed to date"
          value={<Weight value={usage?.consumed_kg ?? 0} unit={material.unit} />}
          sub={
            usage?.days_of_cover != null
              ? `${num(usage.days_of_cover).toFixed(0)} days of cover left`
              : 'Not used in production yet'
          }
        />
      </div>

      {priceHistory && priceHistory.length > 1 && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle>Landed price history</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            <PriceHistoryChart data={priceHistory} />
          </div>
        </Card>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Movement ledger</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          Balance after every movement · last {movements?.length ?? 0} entries
        </span>
      </div>

      <MovementLedger movements={movements} loading={movementsLoading} />

      <MaterialForm open={editOpen} onOpenChange={setEditOpen} material={material} />
      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        itemType="raw"
        itemId={material.id}
        itemName={material.name}
        currentStockKg={num(material.current_stock_kg)}
      />
    </>
  )
}
