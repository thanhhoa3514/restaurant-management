export interface Option {
  id: string
  name_vi: string
  name_en: string
  price_modifier: number
}

export type OptionGroupType = 'single' | 'multi'

export interface OptionGroup {
  id: string
  name_vi: string
  name_en: string
  type: OptionGroupType
  required: boolean
  options: Option[]
}

export interface MenuItem {
  id: string
  category: string
  name: { vi: string; en: string }
  description: { vi: string; en: string }
  price: number
  image: string
  is_available: boolean
  is_bestseller: boolean
  option_groups: OptionGroup[]
  sub_images?: string[]
}

export interface Category {
  id: string
  name_vi: string
  name_en: string
}

export interface CartLine {
  itemId: string
  qty: number
  selections: Record<string, string | string[]>
  notes: string
  unitPrice: number
}

export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served'

export interface OrderItem extends CartLine {
  status: ItemStatus
}

export interface Order {
  placedAt: Date
  items: OrderItem[]
  _orderIdx?: number
  _itemIdx?: number
  _placedAt?: Date
}

export interface Session {
  token: string
  table: number
  startedAt: Date
}

export type Screen = 'qr' | 'menu' | 'order' | 'summary' | 'invoice'

export type Lang = 'vi' | 'en'
