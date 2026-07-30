import { Banknote, CreditCard, QrCode, type LucideIcon } from 'lucide-react'

import type { PaymentMethod, Provider } from '@/features/cashier/types'
import { cn } from '@/lib/utils'

export const PAYMENT_PRIMARY_BUTTON =
  'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 focus-visible:ring-[var(--ring)]'
export const PAYMENT_SECONDARY_BUTTON =
  'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80 focus-visible:ring-[var(--ring)]'
export const PAYMENT_OUTLINE_BUTTON =
  'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:ring-[var(--ring)]'
export const PAYMENT_GHOST_BUTTON =
  'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:ring-[var(--ring)]'
export const PAYMENT_DESTRUCTIVE_BUTTON =
  'bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90 focus-visible:ring-[var(--destructive)]'
export const PAYMENT_INPUT =
  'h-11 border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]/30 focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)]/30'
export const PAYMENT_METHOD_ROW = cn(
  PAYMENT_GHOST_BUTTON,
  'h-auto min-h-14 w-full justify-start rounded-xl border border-[var(--border)] p-3 text-left',
)

export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  ewallet: QrCode,
}

const baseProviders: Provider[] = [
  {
    id: 'sepay',
    name: 'SePay VietQR',
    dot: 'bg-emerald-500',
  },
]

export const paymentProviders: Provider[] = import.meta.env.DEV
  ? [
      ...baseProviders,
      {
        id: 'mock',
        name: 'Mock Wallet',
        dot: 'bg-muted-foreground',
      },
    ]
  : baseProviders
