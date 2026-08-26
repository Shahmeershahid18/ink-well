'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, Moon, Plus, Search, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Wordmark } from '@/components/brand/logo'
import { SidebarNav } from './sidebar'
import { AlertBell } from './alert-bell'

export function Header({ email }: { email?: string | null }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { toggle } = useTheme()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  function openPalette() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    )
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]/95 px-3 backdrop-blur lg:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
            <Wordmark size={24} idPrefix="mobile-nav" />
          </SheetTitle>
          <div className="overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={openPalette}
        className="hidden h-8 w-64 items-center gap-2 rounded-md border border-[var(--border)] px-2.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search everything</span>
        <kbd className="ml-auto rounded border border-[var(--border)] px-1 py-px text-[10px]">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/purchases/new">Purchase</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/production/new">Production batch</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/sales/new">Sale</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertBell />

        {/* Which icon shows is decided in CSS from the html class, so there is
            nothing theme-dependent to hydrate. */}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          <Moon className="h-4 w-4 dark:hidden" />
          <Sun className="hidden h-4 w-4 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{(email ?? 'U').slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
