'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TooltipProvider } from '@/components/ui/tooltip'

/* ─────────────── THEME ─────────────── */

/**
 * The theme lives on <html> as a class, applied by an inline script before paint
 * (see app/layout.tsx) so there is no flash and nothing to hydrate. React only owns
 * the toggle; which icon to show is decided in CSS, not from state.
 */
const ThemeContext = React.createContext<{ toggle: () => void }>({ toggle: () => {} })

export const useTheme = () => React.useContext(ThemeContext)

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const toggle = React.useCallback(() => {
    const isDark = document.documentElement.classList.toggle('dark')
    try {
      window.localStorage.setItem('ink-erp-theme', isDark ? 'dark' : 'light')
    } catch {
      // private mode or blocked storage — the toggle still works for this session
    }
  }, [])

  const value = React.useMemo(() => ({ toggle }), [toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/* ─────────────── QUERY ─────────────── */

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Realtime pushes the invalidation; polling on focus would just add noise.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
