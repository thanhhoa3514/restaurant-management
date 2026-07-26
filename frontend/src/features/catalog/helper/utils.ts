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
