'use client'

import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { MONEY_EVENT_KEYS } from './keys'

export function db() {
  return createClient()
}

/** Throw the Postgres error so `humanError` can turn it into a sentence. */
export function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

/** After a purchase, production run or sale, everything downstream is stale. */
export function useInvalidateMoneyEvent() {
  const qc = useQueryClient()
  return () => {
    MONEY_EVENT_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key as unknown as string[] }))
  }
}

/** Supabase counts come back on the response, not in the rows. */
export async function countOf(promise: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await promise
  if (error) throw error
  return count ?? 0
}
