'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Package, Receipt, ShoppingCart, Truck, Users } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { ALL_NAV_ITEMS } from './nav-items'
import { useInks } from '@/lib/queries/inks'
import { useRawMaterials } from '@/lib/queries/materials'
import { useCustomers, useSuppliers } from '@/lib/queries/parties'
import { InkSwatch } from '@/components/shared/badges'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  // Only render the jump-to lists once the palette has been opened; latched during
  // render so the first open already shows them.
  const [primed, setPrimed] = React.useState(false)
  if (open && !primed) setPrimed(true)

  const { data: inks } = useInks(true)
  const { data: materials } = useRawMaterials(true)
  const { data: customers } = useCustomers(true)
  const { data: suppliers } = useSuppliers(true)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a screen, ink, material or contact…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        <CommandGroup heading="Create">
          <CommandItem value="new purchase buy" onSelect={() => go('/purchases/new')}>
            <ShoppingCart className="h-4 w-4" />
            New purchase
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
          <CommandItem value="new sale invoice" onSelect={() => go('/sales/new')}>
            <Receipt className="h-4 w-4" />
            New sale
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem value="new production batch" onSelect={() => go('/production/new')}>
            <FileText className="h-4 w-4" />
            New production batch
            <CommandShortcut>B</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords ?? ''}`}
                onSelect={() => go(item.href)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>

        {primed && inks && inks.length > 0 && (
          <CommandGroup heading="Inks">
            {inks.slice(0, 30).map((ink) => (
              <CommandItem
                key={ink.id}
                value={`ink ${ink.name} ${ink.code ?? ''}`}
                onSelect={() => go(`/inks/${ink.id}`)}
              >
                <InkSwatch color={ink.color_hex} />
                {ink.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {primed && materials && materials.length > 0 && (
          <CommandGroup heading="Raw materials">
            {materials.slice(0, 30).map((m) => (
              <CommandItem
                key={m.id}
                value={`material ${m.name} ${m.code ?? ''}`}
                onSelect={() => go(`/raw-materials/${m.id}`)}
              >
                <Package className="h-4 w-4" />
                {m.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {primed && customers && customers.length > 0 && (
          <CommandGroup heading="Customers">
            {customers.slice(0, 20).map((c) => (
              <CommandItem
                key={c.id}
                value={`customer ${c.name} ${c.company ?? ''}`}
                onSelect={() => go(`/customers/${c.id}`)}
              >
                <Users className="h-4 w-4" />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {primed && suppliers && suppliers.length > 0 && (
          <CommandGroup heading="Suppliers">
            {suppliers.slice(0, 20).map((s) => (
              <CommandItem
                key={s.id}
                value={`supplier ${s.name} ${s.company ?? ''}`}
                onSelect={() => go(`/suppliers/${s.id}`)}
              >
                <Truck className="h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
