'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command'

export interface ComboboxOption {
  value: string
  label: string
  /** Right-aligned helper text — current stock, last price, available kg. */
  hint?: string
  /** Small colour dot, used for ink swatches. */
  color?: string | null
  disabled?: boolean
  keywords?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  /** Renders an "Add new" row at the bottom of the list. */
  onCreate?: (search: string) => void
  createLabel?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing found.',
  className,
  disabled,
  onCreate,
  createLabel = 'Add new',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between font-normal', className)}
        >
          <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-[var(--muted-foreground)]')}>
            {selected?.color && (
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
                style={{ background: selected.color }}
              />
            )}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, searchTerm) => {
            // the "Add new" row must survive the filter — that is when it matters most
            if (itemValue === '__create__') return 1
            const opt = options.find((o) => o.value === itemValue)
            if (!opt) return 0
            const haystack = `${opt.label} ${opt.keywords ?? ''} ${opt.hint ?? ''}`.toLowerCase()
            return haystack.includes(searchTerm.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  onSelect={(v) => {
                    onChange(v)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Check
                    className={cn('h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')}
                  />
                  {opt.color && (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
                      style={{ background: opt.color }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.hint && (
                    <span className="num ml-auto shrink-0 pl-3 text-xs text-[var(--muted-foreground)]">
                      {opt.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      onCreate(search)
                      setOpen(false)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {search ? `${createLabel}: "${search}"` : createLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
