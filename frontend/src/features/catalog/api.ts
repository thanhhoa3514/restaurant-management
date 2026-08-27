import { apiRequest } from '@/lib/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemListResponse,
  CreateMenuItemRequest,
  MenuItemAvailabilityStatus,
  MenuItemMutationResult,
  PresignResult,
  UpdateMenuItemRequest,
  AdminComboDetailDTO,
  AdminComboListResponse,
  ComboWriteInput,
} from '@/features/catalog/types'

export const catalogQueryKeys = {
  categories: ['catalog', 'categories'] as const,
  items: (categoryId?: string, page?: number, pageSize?: number) =>
    ['catalog', 'items', categoryId, page, pageSize] as const,
  detail: (id: string) => ['catalog', 'items', 'detail', id] as const,
}

export function listAdminCategories(): Promise<AdminCategoryDTO[]> {
  return apiRequest<AdminCategoryDTO[]>('/api/v1/restaurant/menu/categories')
}

export function listAdminMenuItems(
  categoryId?: string,
  page?: number,
  pageSize?: number,
): Promise<AdminMenuItemListResponse> {
  const query = new URLSearchParams()
  if (categoryId) query.set('category_id', categoryId)
  if (page) query.set('page', String(page))
  if (pageSize) query.set('page_size', String(pageSize))
  const qs = query.toString()
  return apiRequest<AdminMenuItemListResponse>(`/api/v1/restaurant/menu/items${qs ? `?${qs}` : ''}`)
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

export function listAdminCombos(): Promise<AdminComboListResponse> {
  return apiRequest<AdminComboListResponse>('/api/v1/restaurant/combos?page_size=100')
}

export function getAdminCombo(id: string): Promise<AdminComboDetailDTO> {
  return apiRequest<AdminComboDetailDTO>(`/api/v1/restaurant/combos/${encodeURIComponent(id)}`)
}

export function createCombo(body: ComboWriteInput): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>('/api/v1/restaurant/combos', { method: 'POST', body })
}

export function updateCombo(id: string, body: ComboWriteInput): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>(`/api/v1/restaurant/combos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  })
}

export function deleteCombo(id: string, version: number): Promise<MenuItemMutationResult> {
  return apiRequest<MenuItemMutationResult>(`/api/v1/restaurant/combos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: { version },
  })
}
