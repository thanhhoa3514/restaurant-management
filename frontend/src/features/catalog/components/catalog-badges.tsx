import { Badge } from '@/components/ui/badge'
import type { AdminT } from '@/i18n'
import type { AdminMenuItemSummaryDTO, MenuItemStatus } from '@/features/catalog/types'

export function StatusBadge({ status, t }: { status: MenuItemStatus; t: AdminT }) {
  if (status === 'PUBLISHED')
    return <Badge variant="success">{t('catalog_status_published')}</Badge>
  if (status === 'ARCHIVED') return <Badge variant="warning">{t('catalog_status_archived')}</Badge>
  return <Badge variant="secondary">{t('catalog_status_draft')}</Badge>
}

export function AvailabilityBadge({ item, t }: { item: AdminMenuItemSummaryDTO; t: AdminT }) {
  if (item.availability_status === 'HIDDEN')
    return <Badge variant="warning">{t('catalog_availability_hidden')}</Badge>
  if (!item.is_available || item.availability_status === 'OUT_OF_STOCK') {
    return <Badge variant="warning">{t('catalog_availability_sold_out')}</Badge>
  }
  if (item.availability_status === 'TEMPORARILY_UNAVAILABLE') {
    return <Badge variant="warning">{t('catalog_availability_temporarily_unavailable')}</Badge>
  }
  return <Badge variant="success">{t('catalog_availability_available')}</Badge>
}
