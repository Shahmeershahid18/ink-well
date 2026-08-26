import { createClient } from '@/lib/supabase/server'
import { Landing } from '@/components/landing/landing'

/**
 * Public. The only thing the session changes is whether the buttons say
 * "Sign in" or "Open dashboard".
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <Landing signedIn={!!user} />
}
