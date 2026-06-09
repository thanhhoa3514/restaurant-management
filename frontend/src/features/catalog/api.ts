import { apiRequest } from '@/lib/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemSummaryDTO,
  CreateMenuItemRequest,
  MenuItemAvailabilityStatus,
  MenuItemMutationResult,
  ToggleAvailabilityRequest,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'

export const catalogQueryKeys = {
  categories: ['catalog', 'categories'] as const,
  items: (categoryId?: string) => ['catalog', 'items', categoryId] as const,
  detail: (id: string) => ['catalog', 'items', 'detail', id] as const,
}

export function listAdminCategories(): Promise<AdminCategoryDTO[]> {
  return apiRequest<AdminCategoryDTO[]>('/api/v1/catalog/categories')
}

export function listAdminMenuItems(categoryId?: string): Promise<AdminMenuItemSummaryDTO[]> {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''
  return apiRequest<AdminMenuItemSummaryDTO[]>(`/api/v1/catalog/items${query}`)
}

export function getAdminMenuItem(id: string): Promise<AdminMenuItemDetailDTO> {
  return apiRequest<AdminMenuItemDetailDTO>(`/api/v1/catalog/items/${encodeURIComponent(id)}`)
}

export function createMenuItem(body: CreateMenuItemRequest): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>('/api/v1/catalog/create-menu-item', {
    method: 'POST',
    body,
  })
}

export function updateMenuItem(body: UpdateMenuItemRequest): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>('/api/v1/catalog/update-menu-item', {
    method: 'POST',
    body,
  })
}

export function deleteMenuItem(id: string, version: number): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>('/api/v1/catalog/delete-menu-item', {
    method: 'POST',
    body: { id, version },
  })
}

export function toggleAvailability(
  id: string,
  isAvailable: boolean,
  version: number,
  availabilityStatus?: MenuItemAvailabilityStatus,
): Promise<MenuItemMutationResult> {
  const body: ToggleAvailabilityRequest = {
    id,
    is_available: isAvailable,
    version,
  }
  if (availabilityStatus) body.availability_status = availabilityStatus

  return apiRequest<MenuItemMutationResult>('/api/v1/catalog/toggle-availability', {
    method: 'POST',
    body,
  })
}
