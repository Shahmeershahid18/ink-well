import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Postgres errors arrive as codes. Turn the two we deliberately raise into the
 * sentence the operator should read, and never show a raw stack.
 */
export function humanError(error: unknown): string {
  if (!error) return 'Something went wrong.'
  const e = error as { code?: string; message?: string; details?: string; hint?: string }

  if (e.code === 'P0001' && e.message) return e.message
  if (e.code === '23503') {
    return 'This record is referenced by other records, so it cannot be deleted. Deactivate it instead.'
  }
  if (e.code === '23505') {
    if (e.message?.includes('idempotency_key')) return 'This document has already been saved.'
    return 'That code is already used by another record.'
  }
  if (e.code === '23514') {
    if (e.message?.includes('stock_non_negative')) return 'That would push stock below zero.'
    return 'One of the values is outside the allowed range.'
  }
  if (e.code === '22P02') return 'One of the fields has an unexpected value.'
  if (e.code === 'PGRST301' || e.code === '42501') {
    return 'Your session has expired. Sign in again.'
  }
  return e.message || 'Something went wrong.'
}
