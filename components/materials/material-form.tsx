'use client'

import * as React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { MATERIAL_CATEGORIES } from '@/lib/constants'
import { useSaveMaterial } from '@/lib/queries/materials'
import { useSuppliers } from '@/lib/queries/parties'
import type { RawMaterial } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  category: string
  unit: string
  reorder_level_kg: string
  default_supplier_id: string | null
  is_active: boolean
  opening_stock_kg: string
  opening_cost_per_kg: string
}

const EMPTY: Values = {
  name: '',
  code: '',
  category: 'pigment',
  unit: 'kg',
  reorder_level_kg: '0',
  default_supplier_id: null,
  is_active: true,
  opening_stock_kg: '',
  opening_cost_per_kg: '',
}

interface MaterialFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  material?: RawMaterial | null
  initialName?: string
  onSaved?: (material: RawMaterial) => void
}

export function MaterialForm({
  open,
  onOpenChange,
  material,
  initialName,
  onSaved,
}: MaterialFormProps) {
  const save = useSaveMaterial()
  const { data: suppliers } = useSuppliers(true)
  const isEdit = !!material

  const form = useForm<Values>({ defaultValues: EMPTY })

  // useWatch rather than form.watch: the subscription belongs in a hook, not in render.
  const control = form.control
  const category = useWatch({ control, name: 'category' })
  const defaultSupplierId = useWatch({ control, name: 'default_supplier_id' })
  const isActive = useWatch({ control, name: 'is_active' })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      ...EMPTY,
      name: material?.name ?? initialName ?? '',
      code: material?.code ?? '',
      category: material?.category ?? 'pigment',
      unit: material?.unit ?? 'kg',
      reorder_level_kg: String(material?.reorder_level_kg ?? 0),
      default_supplier_id: material?.default_supplier_id ?? null,
      is_active: material?.is_active ?? true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material?.id, initialName])

  async function onSubmit(values: Values) {
    if (!values.name.trim()) {
      form.setError('name', { message: 'A name is required' })
      return
    }
    try {
      const saved = await save.mutateAsync({
        id: material?.id,
        name: values.name.trim(),
        code: values.code.trim() || null,
        category: values.category || null,
        unit: values.unit || 'kg',
        reorder_level_kg: Number(values.reorder_level_kg) || 0,
        default_supplier_id: values.default_supplier_id,
        is_active: values.is_active,
        opening_stock_kg: isEdit ? undefined : Number(values.opening_stock_kg) || 0,
        opening_cost_per_kg: isEdit ? undefined : Number(values.opening_cost_per_kg) || 0,
      })
      toast.success(`Material ${isEdit ? 'updated' : 'added'}`)
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
            <SheetTitle>{isEdit ? 'Edit material' : 'New raw material'}</SheetTitle>
            <SheetDescription>
              Stock and cost are maintained by purchases and production — not edited here.
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" autoFocus {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-[var(--danger)]">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="PIG-BLU" {...form.register('code')} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => form.setValue('category', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" {...form.register('unit')} />
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

            <div className="space-y-1.5">
              <Label>Default supplier</Label>
              <Combobox
                options={(suppliers ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: s.company ?? undefined,
                }))}
                value={defaultSupplierId}
                onChange={(v) => form.setValue('default_supplier_id', v)}
                placeholder="None"
              />
            </div>

            {!isEdit && (
              <div className="space-y-3 rounded-md border border-[var(--border)] p-3">
                <div className="text-sm font-medium">Opening stock</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="opening-qty">Quantity (kg)</Label>
                    <Input
                      id="opening-qty"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0"
                      {...form.register('opening_stock_kg')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="opening-cost">Cost per kg</Label>
                    <Input
                      id="opening-cost"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0"
                      {...form.register('opening_cost_per_kg')}
                    />
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    Opening stock is written as an adjustment in the ledger, so the running balance
                    stays provable from day one.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-[var(--border)] p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Inactive materials drop out of formula and purchase pickers.
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
              {isEdit ? 'Save changes' : 'Add material'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
