import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { availabilityAfterToggle } from '@/features/catalog/helper/utils'
import {
  catalogQueryKeys,
  createMenuItem,
  deleteMenuItem,
  toggleAvailability,
  updateMenuItem,
} from '@/features/catalog/api'
import type {
  AdminMenuItemSummaryDTO,
  MenuItemFormBody,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'

const CATALOG_KEY = ['catalog'] as const

export function useToggleItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: AdminMenuItemSummaryDTO) =>
      toggleAvailability(item.id, !item.is_available, item.version, availabilityAfterToggle(item)),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['catalog', 'items'] })
      const snapshots = queryClient.getQueriesData<AdminMenuItemSummaryDTO[]>({
        queryKey: ['catalog', 'items'],
      })
      queryClient.setQueriesData<AdminMenuItemSummaryDTO[]>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          current?.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  is_available: !item.is_available,
                  availability_status: availabilityAfterToggle(item),
                  version: item.version + 1,
                }
              : candidate,
          ),
      )
      return { snapshots }
    },
    onSuccess: (result, item) => {
      queryClient.setQueriesData<AdminMenuItemSummaryDTO[]>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          current?.map((candidate) =>
            candidate.id === item.id ? { ...candidate, version: result.version } : candidate,
          ),
      )
    },
    onError: async (_error, _item, context) => {
      for (const [key, data] of context?.snapshots ?? [])
        queryClient.setQueryData(key, data)
      if (_error instanceof ApiError && _error.status === 409)
        await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
    },
  })
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: AdminMenuItemSummaryDTO) => deleteMenuItem(item.id, item.version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409)
        await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
    },
  })
}

export function useCreateItemMutation(onSuccess?: () => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: MenuItemFormBody) => createMenuItem(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
      await onSuccess?.()
    },
  })
}

export function useUpdateItemMutation(
  onSuccess?: () => Promise<void>,
  onError?: () => void,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateMenuItemRequest) => updateMenuItem(body),
    onSuccess: async (result) => {
      if (result?.id)
        await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.detail(result.id) })
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
      await onSuccess?.()
    },
    onError: async (error) => {
      onError?.()
      if (error instanceof ApiError && error.status === 409) {
        await queryClient.invalidateQueries({ queryKey: CATALOG_KEY })
      }
    },
  })
}
