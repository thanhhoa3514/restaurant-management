export type MenuItemStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type MenuItemAvailabilityStatus =
  | 'AVAILABLE'
  | 'OUT_OF_STOCK'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'HIDDEN'

export interface AdminCategoryDTO {
  id: string
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  icon?: string | null
  display_order: number
}

export interface AdminMenuVariantDTO {
  id?: string
  name: string
  unit?: string | null
  price_vnd: number
  is_default?: boolean
  is_available?: boolean
  display_order?: number
}

export interface AdminMenuOptionDTO {
  id?: string
  name: string
  price_delta_vnd: number
  is_default?: boolean
  is_available?: boolean
  display_order?: number
}

export interface AdminMenuOptionGroupDTO {
  id?: string
  name: string
  description?: string | null
  selection_type: string
  is_required?: boolean
  min_selections?: number
  max_selections?: number | null
  display_order?: number
  options: AdminMenuOptionDTO[]
}

export interface AdminMenuItemSummaryDTO {
  id: string
  category_id: string
  name: string
  slug: string
  short_description?: string | null
  image_url?: string | null
  base_price_vnd: number
  availability_status: MenuItemAvailabilityStatus
  is_available: boolean
  has_variants: boolean
  price_from_vnd: number | null
  status: MenuItemStatus
  is_featured: boolean
  station?: string | null
  display_order: number
  version: number
}

export interface MenuPaginationDTO {
  page: number
  page_size: number
  total_items: number
  total_pages: number
  visible: number
  unavailable: number
}

export interface AdminMenuItemListResponse {
  items: AdminMenuItemSummaryDTO[]
  pagination: MenuPaginationDTO
}

export interface AdminMenuItemDetailDTO extends Omit<
  AdminMenuItemSummaryDTO,
  'has_variants' | 'price_from_vnd'
> {
  description?: string | null
  images?: string[]
  is_spicy: boolean
  variants: AdminMenuVariantDTO[]
  option_groups: AdminMenuOptionGroupDTO[]
}

export interface MenuItemFormBody {
  category_id: string
  name: string
  description: string
  short_description: string
  base_price_vnd: number
  image_url: string
  is_available: boolean
  availability_status: MenuItemAvailabilityStatus
  status: MenuItemStatus
  is_featured: boolean
  is_spicy: boolean
  station: string
  display_order: number
  variants?: AdminMenuVariantDTO[]
  option_groups?: AdminMenuOptionGroupDTO[]
}

export type CreateMenuItemRequest = MenuItemFormBody

export interface UpdateMenuItemRequest extends MenuItemFormBody {
  id: string
  version: number
}

export interface MenuItemMutationResult {
  id: string
  version: number
}

export interface PresignResult {
  presigned_url: string
  public_url: string
  upload_url?: string
  fields?: Record<string, string>
}

export interface AdminComboComponentDTO {
  menu_item_id: string
  variant_id?: string
  name: string
  variant_name?: string
  image_url?: string
  station: string
  quantity: number
  unit_price_vnd: number
  display_order: number
}

export interface AdminComboSummaryDTO {
  id: string
  code: string
  name: string
  slug: string
  image_url?: string
  combo_price_vnd: number
  reference_price_vnd: number
  savings_vnd: number
  status: MenuItemStatus
  availability_status: MenuItemAvailabilityStatus
  is_available: boolean
  is_featured: boolean
  valid_from?: string
  valid_to?: string
  display_order: number
  component_count: number
  version: number
}

export interface AdminComboDetailDTO extends AdminComboSummaryDTO {
  description?: string
  components: AdminComboComponentDTO[]
}

export interface AdminComboListResponse {
  items: AdminComboSummaryDTO[]
  pagination: MenuPaginationDTO
}

export interface ComboComponentInput {
  menu_item_id: string
  variant_id?: string
  quantity: number
  display_order: number
}

export interface ComboWriteInput {
  name: string
  description: string
  image_url: string
  combo_price_vnd: number
  status: MenuItemStatus
  availability_status: MenuItemAvailabilityStatus
  is_featured: boolean
  display_order: number
  version?: number
  components: ComboComponentInput[]
}
