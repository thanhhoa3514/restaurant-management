import { apiRequest } from '@/lib/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemSummaryDTO,
  CreateMenuItemRequest,
  MenuItemAvailabilityStatus,
  MenuItemMutationResult,
  PresignResult,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'

export const catalogQueryKeys = {
  categories: ['catalog', 'categories'] as const,
  items: (categoryId?: string) => ['catalog', 'items', categoryId] as const,
  detail: (id: string) => ['catalog', 'items', 'detail', id] as const,
}

export function listAdminCategories(): Promise<AdminCategoryDTO[]> {
  return apiRequest<AdminCategoryDTO[]>('/api/v1/restaurant/menu/categories')
}

export function listAdminMenuItems(categoryId?: string): Promise<AdminMenuItemSummaryDTO[]> {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''
  return apiRequest<AdminMenuItemSummaryDTO[]>(`/api/v1/restaurant/menu/items${query}`)
}

export function getAdminMenuItem(id: string): Promise<AdminMenuItemDetailDTO> {
  return apiRequest<AdminMenuItemDetailDTO>(
    `/api/v1/restaurant/menu/items/${encodeURIComponent(id)}`,
  )
}

export function createMenuItem(body: CreateMenuItemRequest): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>('/api/v1/restaurant/menu/items', {
    method: 'POST',
    body,
  })
}

export function updateMenuItem(body: UpdateMenuItemRequest): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>(
    `/api/v1/restaurant/menu/items/${encodeURIComponent(body.id)}`,
    {
      method: 'PUT',
      body: { ...body, id: undefined },
    },
  )
}

export function deleteMenuItem(id: string, version: number): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>(
    `/api/v1/restaurant/menu/items/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      body: { version },
    },
  )
}

export function presignUpload(extension: string, contentType: string): Promise<PresignResult> {
  return apiRequest<PresignResult>('/api/v1/restaurant/menu/upload/presign', {
    method: 'POST',
    body: { extension, content_type: contentType },
  })
}

export function toggleAvailability(
  id: string,
  isAvailable: boolean,
  version: number,
  availabilityStatus?: MenuItemAvailabilityStatus,
): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>(
    `/api/v1/restaurant/menu/items/${encodeURIComponent(id)}/availability`,
    {
      method: 'PATCH',
      body: { is_available: isAvailable, version, availability_status: availabilityStatus },
    },
  )
}
