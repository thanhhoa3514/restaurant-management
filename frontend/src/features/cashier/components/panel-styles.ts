import type { SessionStatus } from '@/features/cashier/types'

export const PANEL_CARD = 'bg-[var(--surface-grouped)]'
export const LIST_CARD = 'bg-[var(--bg-elevated)]'

export const OK_TEXT = 'text-emerald-700 dark:text-emerald-400'
export const WARN_TEXT = 'text-amber-700 dark:text-amber-400'
export const BAD_TEXT = 'text-red-600 dark:text-red-400'
export const OK_CARD = 'border border-emerald-500/25 bg-emerald-500/8'
export const WARN_CARD = 'border border-amber-500/25 bg-amber-500/8'


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
