import { useQuery } from '@tanstack/react-query'
import {
  catalogQueryKeys,
  getAdminMenuItem,
  listAdminCategories,
  listAdminMenuItems,
} from '@/features/catalog/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemSummaryDTO,
} from '@/features/catalog/types'

export function useCategoriesQuery() {
  return useQuery<AdminCategoryDTO[]>({
    queryKey: catalogQueryKeys.categories,
    queryFn: listAdminCategories,
  })
}

export function useMenuItemsQuery(categoryId?: string, options?: { enabled?: boolean }) {
  return useQuery<AdminMenuItemSummaryDTO[]>({
    queryKey: catalogQueryKeys.items(categoryId),
    queryFn: () => listAdminMenuItems(categoryId),
    enabled: options?.enabled ?? true,
  })
}

export function useMenuItemDetailQuery(id: string | undefined) {
  return useQuery<AdminMenuItemDetailDTO>({
    queryKey: id
      ? catalogQueryKeys.detail(id)
      : ['catalog', 'items', 'detail', 'new'],
    queryFn: () => getAdminMenuItem(id ?? ''),
    enabled: Boolean(id),
  })
}
