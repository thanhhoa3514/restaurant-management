import { useQuery } from '@tanstack/react-query'

import {
  getTakeawayMenuItem,
  listTakeawayCategories,
  listTakeawayMenuItems,
} from '@/features/cashier/api'

const takeawayMenuKeys = {
  categories: ['takeaway-menu', 'categories'] as const,
  items: (categoryId?: string) => ['takeaway-menu', 'items', categoryId] as const,
  detail: (itemId?: string) => ['takeaway-menu', 'detail', itemId] as const,
}

export function useTakeawayCategories(enabled: boolean) {
  return useQuery({
    queryKey: takeawayMenuKeys.categories,
    queryFn: listTakeawayCategories,
    enabled,
  })
}

export function useTakeawayMenuItems(categoryId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: takeawayMenuKeys.items(categoryId),
    queryFn: () => listTakeawayMenuItems(categoryId),
    enabled,
  })
}

export function useTakeawayMenuItem(itemId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: takeawayMenuKeys.detail(itemId),
    queryFn: () => getTakeawayMenuItem(itemId ?? ''),
    enabled: enabled && Boolean(itemId),
  })
}
