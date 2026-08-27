import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { availabilityAfterToggle } from '@/features/catalog/helper/utils'
import {
  catalogQueryKeys,
  createMenuItem,
  deleteMenuItem,
  presignUpload,
  toggleAvailability,
  updateMenuItem,
} from '@/features/catalog/api'
import type {
  AdminMenuItemListResponse,
  AdminMenuItemSummaryDTO,
  MenuItemFormBody,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'

const CATALOG_KEY = ['catalog'] as const

// The ['catalog','items',...] key space now holds paginated list responses
// ({items, pagination}) as well as single-item detail objects. Only rewrite
// entries that are actually list responses; leave everything else untouched.
function patchListItem(
  current: AdminMenuItemListResponse | undefined,
  id: string,
  patch: (candidate: AdminMenuItemSummaryDTO) => AdminMenuItemSummaryDTO,
): AdminMenuItemListResponse | undefined {
  if (!current || !Array.isArray(current.items)) return current
  return {
    ...current,
    items: current.items.map((candidate) => (candidate.id === id ? patch(candidate) : candidate)),
  }
}

export function useToggleItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: AdminMenuItemSummaryDTO) =>
      toggleAvailability(item.id, !item.is_available, item.version, availabilityAfterToggle(item)),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['catalog', 'items'] })
      const snapshots = queryClient.getQueriesData<AdminMenuItemListResponse>({
        queryKey: ['catalog', 'items'],
      })
      queryClient.setQueriesData<AdminMenuItemListResponse>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          patchListItem(current, item.id, (candidate) => ({
            ...candidate,
            is_available: !item.is_available,
            availability_status: availabilityAfterToggle(item),
            version: item.version + 1,
          })),
      )
      return { snapshots }
    },
    onSuccess: (result, item) => {
      queryClient.setQueriesData<AdminMenuItemListResponse>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          patchListItem(current, item.id, (candidate) => ({
            ...candidate,
            version: result.version,
          })),
      )
    },
    onError: async (_error, _item, context) => {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data)
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

export function useUpdateItemMutation(onSuccess?: () => Promise<void>, onError?: () => void) {
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

export function useImageUploadMutation() {
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.jpg'
      const result = await presignUpload(ext, file.type)
      const resp = await fetch(result.presigned_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!resp.ok) throw new Error('Upload failed')
      return result.public_url
    },
  })
}
