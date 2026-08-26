'use client'

import * as React from 'react'
import { CircleCheck, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { num } from '@/lib/format'
import { useReconciliation, useSaveSettings, useSettings } from '@/lib/queries/dashboard'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const { data: reconciliation } = useReconciliation()
  const save = useSaveSettings()

  const [values, setValues] = React.useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    currency: 'PKR',
    low_stock_email: '',
    default_labor_rate: '0',
    invoice_prefix: 'INV-',
    batch_prefix: 'B-',
    purchase_prefix: 'PUR-',
  })

  // Seed the form from the saved row, and re-seed only when the row actually
  // changes — done during render so the inputs are never briefly empty.
  const [seededFrom, setSeededFrom] = React.useState<string | null>(null)
  if (settings && seededFrom !== settings.updated_at) {
    setSeededFrom(settings.updated_at)
    setValues({
      company_name: settings.company_name ?? '',
      company_address: settings.company_address ?? '',
      company_phone: settings.company_phone ?? '',
      currency: settings.currency ?? 'PKR',
      low_stock_email: settings.low_stock_email ?? '',
      default_labor_rate: String(num(settings.default_labor_rate)),
      invoice_prefix: settings.invoice_prefix ?? 'INV-',
      batch_prefix: settings.batch_prefix ?? 'B-',
      purchase_prefix: settings.purchase_prefix ?? 'PUR-',
    })
  }

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function submit() {
    try {
      await save.mutateAsync({
        company_name: values.company_name || null,
        company_address: values.company_address || null,
        company_phone: values.company_phone || null,
        currency: values.currency || 'PKR',
        low_stock_email: values.low_stock_email || null,
        default_labor_rate: Number(values.default_labor_rate) || 0,
        invoice_prefix: values.invoice_prefix || 'INV-',
        batch_prefix: values.batch_prefix || 'B-',
        purchase_prefix: values.purchase_prefix || 'PUR-',
      })
      toast.success('Settings saved')
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details print on every invoice; prefixes drive the auto-numbering."
        actions={
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Shown at the top of printed invoices.</CardDescription>
          </CardHeader>
          <div className="space-y-3 px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name</Label>
              <Input
                id="company"
                value={values.company_name}
                onChange={(e) => set('company_name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={3}
                value={values.company_address}
                onChange={(e) => set('company_address', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={values.company_phone}
                  onChange={(e) => set('company_phone', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={values.currency}
                  onChange={(e) => set('currency', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document numbering</CardTitle>
            <CardDescription>
              New documents get the next number in sequence; the field stays editable.
            </CardDescription>
          </CardHeader>
          <div className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-prefix">Invoice prefix</Label>
                <Input
                  id="inv-prefix"
                  value={values.invoice_prefix}
                  onChange={(e) => set('invoice_prefix', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pur-prefix">Purchase prefix</Label>
                <Input
                  id="pur-prefix"
                  value={values.purchase_prefix}
                  onChange={(e) => set('purchase_prefix', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-prefix">Batch prefix</Label>
                <Input
                  id="batch-prefix"
                  value={values.batch_prefix}
                  onChange={(e) => set('batch_prefix', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Numbers look like {values.invoice_prefix}
              {new Date().getFullYear()}-0001.
            </p>

            <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="labor-rate">Default labor rate</Label>
                <Input
                  id="labor-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.default_labor_rate}
                  onChange={(e) => set('default_labor_rate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alert-email">Low-stock email</Label>
                <Input
                  id="alert-email"
                  type="email"
                  placeholder="Not set"
                  value={values.low_stock_email}
                  onChange={(e) => set('low_stock_email', e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data integrity</CardTitle>
            <CardDescription>
              For every item, the sum of its ledger movements must equal its stock figure.
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <Alert variant={reconciliation && reconciliation.length === 0 ? 'ok' : 'danger'}>
              {reconciliation && reconciliation.length === 0 ? <CircleCheck /> : <TriangleAlert />}
              <AlertTitle>
                {reconciliation && reconciliation.length === 0
                  ? 'Everything reconciles'
                  : `${reconciliation?.length ?? 0} item(s) out of balance`}
              </AlertTitle>
              <AlertDescription>
                {reconciliation && reconciliation.length === 0 ? (
                  'Stock figures and the append-only ledger agree exactly.'
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {reconciliation?.map((r) => (
                      <li key={r.id} className="num">
                        {r.name}: stock {num(r.current_stock_kg)} kg vs ledger {num(r.ledger_kg)} kg
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </Card>
      </div>
    </>
  )
}
