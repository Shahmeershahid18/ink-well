/**
 * One place for the product's identity, so renaming it later is a single edit.
 * "Inkwell" reads on sight — no explanation needed for staff or customers.
 */
export const BRAND = {
  name: 'Inkwell',
  tagline: 'Ink works, costed.',
  description:
    'Purchasing, production, stock and profit for an ink manufacturer — one ledger, costed to the kilo.',
  /** The mark's gradient stops, reused by the favicon and the logo component. */
  gradientFrom: '#4338ca',
  gradientTo: '#7c3aed',
} as const
