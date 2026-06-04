// Mirrors the backend catalog MenuItemSummaryDTO (subset relevant to the UI).
export interface MenuItemSummary {
  id: string
  category_id: string
  name: string
  base_price_vnd: number
  availability_status: string
  is_available: boolean
}

// Result of POST /api/v1/catalog/toggle-availability (Output DTO).
export interface ToggleAvailabilityResult {
  id: string
  status: string
}