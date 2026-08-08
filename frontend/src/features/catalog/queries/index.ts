import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  catalogQueryKeys,
  getAdminMenuItem,
  listAdminCategories,
  listAdminMenuItems,
  listAdminCombos,
} from '@/features/catalog/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemListResponse,
  AdminMenuItemSummaryDTO,
} from '@/features/catalog/types'

export const CATALOG_PAGE_SIZE = 20

export function useCategoriesQuery() {
  return useQuery<AdminCategoryDTO[]>({
    queryKey: catalogQueryKeys.categories,
    queryFn: listAdminCategories,
  })
}

export function useMenuItemsQuery(categoryId?: string, page = 1, options?: { enabled?: boolean }) {
  return useQuery<AdminMenuItemListResponse>({
    queryKey: catalogQueryKeys.items(categoryId, page, CATALOG_PAGE_SIZE),
    queryFn: () => listAdminMenuItems(categoryId, page, CATALOG_PAGE_SIZE),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

// Fetch the full (unpaginated) menu for selection UIs such as the cashier
// takeaway panel, which searches/filters across every item. Uses the backend
// max page size; the per-category working set stays well within it.
const CATALOG_MAX_PAGE_SIZE = 100

export function useAllMenuItemsQuery(categoryId?: string, options?: { enabled?: boolean }) {
  return useQuery<AdminMenuItemListResponse, Error, AdminMenuItemSummaryDTO[]>({
    queryKey: catalogQueryKeys.items(categoryId, 1, CATALOG_MAX_PAGE_SIZE),
    queryFn: () => listAdminMenuItems(categoryId, 1, CATALOG_MAX_PAGE_SIZE),
    enabled: options?.enabled ?? true,
    select: (data) => data.items,
  })
}

export function useMenuItemDetailQuery(id: string | undefined) {
  return useQuery<AdminMenuItemDetailDTO>({
    queryKey: id ? catalogQueryKeys.detail(id) : ['catalog', 'items', 'detail', 'new'],
    queryFn: () => getAdminMenuItem(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useAdminCombosQuery() {
  return useQuery({ queryKey: ['catalog', 'combos'], queryFn: listAdminCombos })
}
