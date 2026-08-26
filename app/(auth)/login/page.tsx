'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { LogoMark, Wordmark } from '@/components/brand/logo'
import { FlowTimeline } from '@/components/landing/flow-timeline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  email: z
    .string()
    .min(1, 'Enter your email address')
    .email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password'),
})

type Values = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const errors = form.formState.errors

  async function onSubmit(values: Values) {
    setPending(true)
    setError(null)

    const { error: authError } = await createClient().auth.signInWithPassword(values)

    if (authError) {
      setPending(false)
      const message = authError.message.toLowerCase()
      setError(
        message.includes('invalid')
          ? "That email and password don't match an account."
          : message.includes('confirm')
            ? 'That account has not been confirmed yet. Confirm it from the Supabase dashboard, then try again.'
            : authError.message,
      )
      return
    }

    const next = params.get('next')
    router.replace(next && next.startsWith('/') ? next : '/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[var(--foreground)]">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          placeholder="you@inkworks.pk"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={cn('h-11', errors.email && 'border-[var(--danger)]')}
          {...form.register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-[var(--danger)]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[var(--foreground)]">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={cn('h-11 pr-11', errors.password && 'border-[var(--danger)]')}
            {...form.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-[var(--danger)]">
            {errors.password.message}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="animate-rise flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2.5 text-xs text-[var(--danger)]"
        >
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        Accounts are created by the owner in Supabase — there is no public sign-up.
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── brand panel: the pitch, on wide screens only ── */}
      <aside className="relative isolate hidden overflow-hidden border-r border-[var(--border)] lg:flex lg:w-[40%] lg:flex-col lg:p-12 xl:w-[42%]">
        <div className="ink-wash pointer-events-none absolute inset-0 -z-10" />
        <div className="grid-fade pointer-events-none absolute inset-0 -z-10 opacity-40" />

        <Link href="/" className="animate-fade w-fit shrink-0">
          <Wordmark size={26} idPrefix="auth" />
        </Link>

        {/* One centred column: heading, the flow, then the closing line. */}
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-md">
            <h2
              className="animate-rise text-[28px] font-semibold leading-[1.15] tracking-tight xl:text-[32px]"
              style={{ ['--reveal-delay' as string]: '100ms' }}
            >
              Every kilo,
              <br />
              <span
                className="bg-gradient-to-r bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, var(--brand-from), var(--brand-to))',
                }}
              >
                accounted for
              </span>
              .
            </h2>

            <p
              className="animate-rise mt-3.5 text-sm leading-relaxed text-[var(--muted-foreground)]"
              style={{ ['--reveal-delay' as string]: '180ms' }}
            >
              Cost follows the material from the supplier&apos;s invoice all the way to yours.
            </p>

            <FlowTimeline className="mt-9" />

            <p
              className="animate-fade mt-9 border-t border-[var(--border)] pt-5 text-xs leading-relaxed text-[var(--muted-foreground)]"
              style={{ ['--reveal-delay' as string]: '620ms' }}
            >
              One append-only ledger · weighted average costing · profit snapshotted per sale
            </p>
          </div>
        </div>
      </aside>

      {/* ── form panel ── */}
      <section className="relative flex flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        <div className="ink-wash pointer-events-none absolute inset-0 -z-10 opacity-60 lg:hidden" />

        <div className="mx-auto w-full max-w-sm">
          {/* compact brand for narrow screens */}
          <Link href="/" className="animate-fade mb-8 flex w-fit items-center gap-2 lg:hidden">
            <LogoMark size={30} idPrefix="auth-sm" />
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>

          <div className="animate-rise" style={{ ['--reveal-delay' as string]: '60ms' }}>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              Sign in to open your books.
            </p>
          </div>

          <div className="animate-rise mt-8" style={{ ['--reveal-delay' as string]: '140ms' }}>
            <React.Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <LoginForm />
            </React.Suspense>
          </div>

          <Link
            href="/"
            className="animate-fade mt-8 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] lg:hidden"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to overview
          </Link>
        </div>
      </section>
    </main>
  )
}
