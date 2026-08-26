import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/layout/command-palette'
import { RealtimeProvider } from '@/hooks/use-realtime-sync'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <RealtimeProvider>
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-width)]">
        <Header email={user.email} />
        <main className="content-shell px-3 py-5 lg:px-6">{children}</main>
      </div>
      <CommandPalette />
    </RealtimeProvider>
  )
}
