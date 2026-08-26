'use client'

import * as React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { INK_TYPES, DEFAULT_INK_COLOR } from '@/lib/constants'
import { useSaveInk } from '@/lib/queries/inks'
import type { Ink } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface Values {
  name: string
  code: string
  color_hex: string
  ink_type: string
  batch_size_kg: string
  labor_cost_per_batch: string
  overhead_cost_per_batch: string
  packaging_cost_per_kg: string
  expected_wastage_pct: string
  default_price_per_kg: string
  reorder_level_kg: string
  is_active: boolean
}

const EMPTY: Values = {
  name: '',
  code: '',
  color_hex: DEFAULT_INK_COLOR,
  ink_type: 'offset',
  batch_size_kg: '100',
  labor_cost_per_batch: '0',
  overhead_cost_per_batch: '0',
  packaging_cost_per_kg: '0',
  expected_wastage_pct: '0',
  default_price_per_kg: '',
  reorder_level_kg: '0',
  is_active: true,
}

export function InkForm({
  open,
  onOpenChange,
  ink,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ink?: Ink | null
  onSaved?: (ink: Ink) => void
}) {
  const save = useSaveInk()
  const form = useForm<Values>({ defaultValues: EMPTY })

  // useWatch rather than form.watch: the subscription belongs in a hook, not in render.
  const control = form.control
  const inkType = useWatch({ control, name: 'ink_type' })
  const colorHex = useWatch({ control, name: 'color_hex' })
  const isActive = useWatch({ control, name: 'is_active' })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      ...EMPTY,
      name: ink?.name ?? '',
      code: ink?.code ?? '',
      color_hex: ink?.color_hex ?? DEFAULT_INK_COLOR,
      ink_type: ink?.ink_type ?? 'offset',
      batch_size_kg: String(ink?.batch_size_kg ?? 100),
      labor_cost_per_batch: String(ink?.labor_cost_per_batch ?? 0),
      overhead_cost_per_batch: String(ink?.overhead_cost_per_batch ?? 0),
      packaging_cost_per_kg: String(ink?.packaging_cost_per_kg ?? 0),
      expected_wastage_pct: String(ink?.expected_wastage_pct ?? 0),
      default_price_per_kg: ink?.default_price_per_kg ? String(ink.default_price_per_kg) : '',
      reorder_level_kg: String(ink?.reorder_level_kg ?? 0),
      is_active: ink?.is_active ?? true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ink?.id])

  async function onSubmit(values: Values) {
    if (!values.name.trim()) {
      form.setError('name', { message: 'A name is required' })
      return
    }
    if (!(Number(values.batch_size_kg) > 0)) {
      form.setError('batch_size_kg', { message: 'Batch size must be more than zero' })
      return
    }
    try {
      const saved = await save.mutateAsync({
        id: ink?.id,
        name: values.name.trim(),
        code: values.code.trim() || null,
        color_hex: values.color_hex || null,
        ink_type: values.ink_type || null,
        batch_size_kg: Number(values.batch_size_kg),
        labor_cost_per_batch: Number(values.labor_cost_per_batch) || 0,
        overhead_cost_per_batch: Number(values.overhead_cost_per_batch) || 0,
        packaging_cost_per_kg: Number(values.packaging_cost_per_kg) || 0,
        expected_wastage_pct: Number(values.expected_wastage_pct) || 0,
        default_price_per_kg: values.default_price_per_kg
          ? Number(values.default_price_per_kg)
          : null,
        reorder_level_kg: Number(values.reorder_level_kg) || 0,
        is_active: values.is_active,
      })
      toast.success(`Ink ${ink ? 'updated' : 'created'}`)
      onOpenChange(false)
      onSaved?.(saved)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{ink ? 'Edit ink' : 'New ink'}</SheetTitle>
            <SheetDescription>
              These figures drive the theoretical cost. The formula itself is edited on the ink&apos;s
              own page.
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" autoFocus placeholder="Process Blue" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-[var(--danger)]">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="INK-PB" {...form.register('code')} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={inkType}
                  onValueChange={(v) => form.setValue('ink_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color">Colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="color"
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded-md border border-[var(--input)] bg-[var(--background)] p-1"
                  value={colorHex}
                  onChange={(e) => form.setValue('color_hex', e.target.value)}
                />
                <Input
                  className="max-w-32"
                  value={colorHex}
                  onChange={(e) => form.setValue('color_hex', e.target.value)}
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  Shown as a swatch everywhere this ink appears.
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-[var(--border)] p-3">
              <div className="text-sm font-medium">Standard batch</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="batch-size">Batch size (kg) *</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    step="0.001"
                    min="0.001"
                    {...form.register('batch_size_kg')}
                  />
                  {form.formState.errors.batch_size_kg && (
                    <p className="text-xs text-[var(--danger)]">
                      {form.formState.errors.batch_size_kg.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wastage">Expected wastage (%)</Label>
                  <Input
                    id="wastage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="99"
                    {...form.register('expected_wastage_pct')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="labor">Labor per batch</Label>
                  <Input
                    id="labor"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('labor_cost_per_batch')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="overhead">Overhead per batch</Label>
                  <Input
                    id="overhead"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('overhead_cost_per_batch')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="packaging">Packaging per kg</Label>
                <Input
                  id="packaging"
                  type="number"
                  step="0.0001"
                  min="0"
                  {...form.register('packaging_cost_per_kg')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">List price per kg</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="Not set"
                  {...form.register('default_price_per_kg')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reorder">Reorder level (kg)</Label>
                <Input
                  id="reorder"
                  type="number"
                  step="0.001"
                  min="0"
                  {...form.register('reorder_level_kg')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-[var(--border)] p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Inactive inks drop out of the production and sale pickers.
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(v) => form.setValue('is_active', v)}
              />
            </div>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {ink ? 'Save changes' : 'Create ink'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
