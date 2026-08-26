'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookLock,
  Calculator,
  FlaskConical,
  Layers,
  Receipt,
  ScrollText,
  ShoppingCart,
} from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { useReveal } from '@/hooks/use-reveal'
import { LogoMark, Wordmark } from '@/components/brand/logo'
import { FlowDiagram } from './flow-diagram'
import { Button } from '@/components/ui/button'

const EVENTS = [
  {
    icon: ShoppingCart,
    title: 'Purchase',
    stock: 'Raw material +',
    body: 'Freight and duty are spread across the lines by value, so the average cost per kilo is what the material truly cost to land — not the sticker price.',
  },
  {
    icon: FlaskConical,
    title: 'Production',
    stock: 'Raw −, ink +',
    body: 'A batch pulls its recipe from the formula, then you enter the yield you actually got. Material, labour, overhead and packaging divide by real kilos.',
  },
  {
    icon: Receipt,
    title: 'Sale',
    stock: 'Ink −',
    body: 'Each line snapshots the ink’s cost at that moment, so the profit on an invoice never changes afterwards — however prices move later.',
  },
  {
    icon: Layers,
    title: 'Adjustment',
    stock: 'Either ±',
    body: 'A stock count that disagrees with the system is a movement too, with a reason attached. Nothing is edited quietly into place.',
  },
]

const PRINCIPLES = [
  {
    icon: ScrollText,
    title: 'One append-only ledger',
    body: 'Every gram that moves writes a row with the balance after it. Nothing is ever deleted — a mistake is cancelled and reversed, so the audit trail stays intact.',
  },
  {
    icon: Calculator,
    title: 'Costed to the kilo',
    body: 'Moving weighted average across purchases, batch cost across production. The numbers reconcile: the ledger always sums to the stock on hand.',
  },
  {
    icon: BookLock,
    title: 'Written in one transaction',
    body: 'Stock, cost and ledger move together inside the database or not at all. A double-clicked button cannot create a second invoice.',
  },
]

export function Landing({ signedIn }: { signedIn: boolean }) {
  const ref = useReveal<HTMLDivElement>()

  return (
    <div ref={ref} className="min-h-screen overflow-x-hidden">
      {/* ── nav ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark size={26} idPrefix="nav" />
          <Button asChild size="sm">
            <Link href={signedIn ? '/dashboard' : '/login'}>
              {signedIn ? 'Open dashboard' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative isolate overflow-hidden">
        <div className="ink-wash pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div className="grid-fade pointer-events-none absolute inset-0 -z-10 opacity-[0.35]" />

        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <div className="flex flex-col items-center text-center">
            <span
              className="animate-fade mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-3 py-1 text-xs text-[var(--muted-foreground)]"
              style={{ ['--reveal-delay' as string]: '80ms' }}
            >
              <LogoMark size={14} idPrefix="pill" />
              For ink manufacturers
            </span>

            <h1
              className="animate-rise max-w-3xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ ['--reveal-delay' as string]: '120ms' }}
            >
              Know what every kilo{' '}
              <span
                className="bg-gradient-to-r bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, var(--brand-from), var(--brand-to))',
                }}
              >
                actually costs
              </span>
              .
            </h1>

            <p
              className="animate-rise mt-5 max-w-xl text-pretty text-sm text-[var(--muted-foreground)] sm:text-base"
              style={{ ['--reveal-delay' as string]: '220ms' }}
            >
              {BRAND.name} follows pigment from the supplier&apos;s invoice to the customer&apos;s,
              costing it at every step — so your margin is a fact you can look up, not a figure you
              estimate at the end of the month.
            </p>

            <div
              className="animate-rise mt-8 flex flex-col items-center gap-3 sm:flex-row"
              style={{ ['--reveal-delay' as string]: '320ms' }}
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={signedIn ? '/dashboard' : '/login'}>
                  {signedIn ? 'Open dashboard' : 'Sign in to continue'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a
                href="#how"
                className="text-xs text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* the system, in one line */}
          <div className="mx-auto mt-16 w-full max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 p-5 shadow-sm backdrop-blur sm:mt-20 sm:p-8">
            <FlowDiagram />
          </div>
        </div>
      </section>

      {/* ── four money events ── */}
      <section id="how" className="border-t border-[var(--border)] scroll-mt-14">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="reveal max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Four events move money
            </h2>
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              That is the whole model. Each one is atomic, and each one writes to the same ledger —
              which is why the books reconcile.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {EVENTS.map((event, i) => {
              const Icon = event.icon
              return (
                <div
                  key={event.title}
                  className="reveal group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--brand-to)]/40"
                  style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)] transition-colors group-hover:bg-[var(--brand-to)]/10">
                      <Icon className="h-4 w-4" style={{ color: 'var(--brand-to)' }} />
                    </span>
                    <h3 className="text-sm font-semibold">{event.title}</h3>
                    <span className="num ml-auto rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {event.stock}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {event.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── principles ── */}
      <section className="border-t border-[var(--border)] bg-[var(--muted)]/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            {PRINCIPLES.map((principle, i) => {
              const Icon = principle.icon
              return (
                <div
                  key={principle.title}
                  className="reveal"
                  style={{ ['--reveal-delay' as string]: `${i * 110}ms` }}
                >
                  <Icon className="h-5 w-5" style={{ color: 'var(--brand-to)' }} />
                  <h3 className="mt-3 text-sm font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {principle.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── close ── */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <div className="reveal mx-auto max-w-lg">
            <LogoMark size={36} idPrefix="cta" className="mx-auto" />
            <h2 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
              {BRAND.tagline}
            </h2>
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Purchases, batches, sales and stock in one place — with the arithmetic done where it
              cannot drift.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href={signedIn ? '/dashboard' : '/login'}>
                {signedIn ? 'Open dashboard' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-[var(--muted-foreground)] sm:flex-row sm:px-6">
          <Wordmark size={20} idPrefix="foot" />
          <span>Weighted average costing · PKR · Asia/Karachi</span>
        </div>
      </footer>
    </div>
  )
}
