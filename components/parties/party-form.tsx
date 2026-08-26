'use client'

import * as React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { useSaveParty, type PartyKind } from '@/lib/queries/parties'
import type { Party } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const schema = z.object({
  name: z.string().min(1, 'A name is required'),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('That does not look like an email address').or(z.literal('')).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  opening_balance: z.coerce.number().default(0),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
})

type Values = z.input<typeof schema>

interface PartyFormProps {
  kind: PartyKind
  open: boolean
  onOpenChange: (open: boolean) => void
  party?: Party | null
  /** Prefills the name when opened from a combobox's "Add new". */
  initialName?: string
  onSaved?: (party: Party) => void
}

export function PartyForm({
  kind,
  open,
  onOpenChange,
  party,
  initialName,
  onSaved,
}: PartyFormProps) {
  const save = useSaveParty(kind)
  const noun = kind === 'supplier' ? 'Supplier' : 'Customer'

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      company: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      opening_balance: 0,
      notes: '',
      is_active: true,
    },
  })

  // useWatch rather than form.watch: the subscription belongs in a hook, not in render.
  const isActive = useWatch({ control: form.control, name: 'is_active' })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      name: party?.name ?? initialName ?? '',
      company: party?.company ?? '',
      phone: party?.phone ?? '',
      email: party?.email ?? '',
      address: party?.address ?? '',
      city: party?.city ?? '',
      opening_balance: party?.opening_balance ?? 0,
      notes: party?.notes ?? '',
      is_active: party?.is_active ?? true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party?.id, initialName])

  async function onSubmit(values: Values) {
    try {
      const parsed = schema.parse(values)
      const saved = await save.mutateAsync({ id: party?.id, ...parsed })
      toast.success(`${noun} ${party ? 'updated' : 'added'}`)
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
            <SheetTitle>{party ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}</SheetTitle>
            <SheetDescription>
              {kind === 'supplier'
                ? 'Who you buy raw material from.'
                : 'Who you sell finished ink to.'}
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

            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...form.register('company')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" inputMode="tel" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...form.register('city')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-[var(--danger)]">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" rows={2} {...form.register('address')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opening_balance">
                Opening balance {kind === 'supplier' ? '(you owe them)' : '(they owe you)'}
              </Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                {...form.register('opening_balance')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} {...form.register('notes')} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-[var(--border)] p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Inactive records stay in history but drop out of the pickers.
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
              {party ? 'Save changes' : `Add ${noun.toLowerCase()}`}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
