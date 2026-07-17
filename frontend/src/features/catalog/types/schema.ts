import { z } from 'zod'
import type { 
  MenuItemStatus, 
  MenuItemAvailabilityStatus, 
  MenuItemFormBody, 
  AdminMenuItemDetailDTO 
} from '@/features/catalog/types'

export const STATUS_OPTIONS: MenuItemStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
export const AVAILABILITY_OPTIONS: MenuItemAvailabilityStatus[] = [
  'AVAILABLE',
  'OUT_OF_STOCK',
  'TEMPORARILY_UNAVAILABLE',
  'HIDDEN',
]
export const STATION_OPTIONS = ['HOTPOT', 'GRILL', 'NOODLE', 'DRINK', 'DESSERT', 'GENERAL'] as const

export const catalogFormSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Name is required'),
  short_description: z.string().optional().default(''),
  description: z.string().optional().default(''),
  base_price_vnd: z.coerce.number().min(0),
  image_url: z.string().optional().default(''),
  is_available: z.boolean().default(true),
  availability_status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  is_featured: z.boolean().default(false),
  is_spicy: z.boolean().default(false),
  station: z.string().optional().default(''),
  display_order: z.coerce.number().default(0),
})

export const blankForm = (categoryId = ''): MenuItemFormBody => ({
  category_id: categoryId,
  name: '',
  description: '',
  short_description: '',
  base_price_vnd: 0,
  image_url: '',
  is_available: true,
  availability_status: 'AVAILABLE',
  status: 'PUBLISHED',
  is_featured: false,
  is_spicy: false,
  station: '',
  display_order: 0,
})

export const formFromDetail = (item: AdminMenuItemDetailDTO): MenuItemFormBody => ({
  category_id: item.category_id,
  name: item.name,
  description: item.description ?? '',
  short_description: item.short_description ?? '',
  base_price_vnd: item.base_price_vnd,
  image_url: item.image_url ?? '',
  is_available: item.is_available,
  availability_status: item.availability_status,
  status: item.status,
  is_featured: item.is_featured,
  is_spicy: item.is_spicy,
  station: item.station ?? '',
  display_order: item.display_order,
})

export function normalizeForm(form: MenuItemFormBody): MenuItemFormBody {
  return {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    short_description: form.short_description.trim(),
    image_url: form.image_url.trim(),
    station: form.station.trim(),
    base_price_vnd: Math.max(0, Math.round(Number(form.base_price_vnd) || 0)),
    display_order: Math.round(Number(form.display_order) || 0),
  }
}
