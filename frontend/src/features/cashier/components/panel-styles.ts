import type { SessionStatus } from '@/features/cashier/types'

/* Opaque surfaces — no translucent material, no blur. Pick by the column behind:
   PANEL_CARD on the white payment column, LIST_CARD on the grouped-grey list/invoice columns. */
export const PANEL_CARD = 'bg-[var(--surface-grouped)]'
export const LIST_CARD = 'bg-[var(--bg-elevated)]'

/* Semantic text tones — Tailwind ramps (same as Badge success/warning) so contrast holds on tints.
   The --system-* tokens are only safe as dots/fills; as text on white they land near 2:1. */
export const OK_TEXT = 'text-emerald-700 dark:text-emerald-400'
export const WARN_TEXT = 'text-amber-700 dark:text-amber-400'
export const BAD_TEXT = 'text-red-600 dark:text-red-400'
export const OK_CARD = 'border border-emerald-500/25 bg-emerald-500/8'
export const WARN_CARD = 'border border-amber-500/25 bg-amber-500/8'

/* All soft-weight variants on purpose: `default` is the one solid fill and made
   the pill jump in weight mid-lifecycle (bill_requested → in_payment → paid). */
export const STATUS_VARIANT: Record<
  SessionStatus,
  'ghost' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  dining: 'outline',
  bill_requested: 'warning',
  in_payment: 'secondary',
  paid: 'success',
  closed: 'ghost',
  voided: 'destructive',
}
