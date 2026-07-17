import { ApiError } from '@/lib/api'
import type { AdminMenuItemSummaryDTO } from '@/features/catalog/types'

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export const money = (value: number) => moneyFormatter.format(value)

export const availabilityAfterToggle = (item: AdminMenuItemSummaryDTO) =>
  !item.is_available
    ? ('AVAILABLE' as const)
    : item.availability_status === 'HIDDEN'
      ? ('HIDDEN' as const)
      : ('OUT_OF_STOCK' as const)

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}
