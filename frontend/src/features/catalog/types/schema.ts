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

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  unit: z.string().optional().nullable(),
  price_vnd: z.coerce.number().min(0),
  is_default: z.boolean().optional(),
  is_available: z.boolean().optional(),
  display_order: z.number().optional(),
})

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price_delta_vnd: z.coerce.number().min(0),
  is_default: z.boolean().optional(),
  is_available: z.boolean().optional(),
  display_order: z.number().optional(),
})

const optionGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  selection_type: z.string(),
  is_required: z.boolean().optional(),
  min_selections: z.number().optional(),
  max_selections: z.number().optional().nullable(),
  display_order: z.number().optional(),
  options: z.array(optionSchema).default([]),
})

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
  variants: z.array(variantSchema).optional().default([]),
  option_groups: z.array(optionGroupSchema).optional().default([]),
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
  variants: [],
  option_groups: [],
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
  variants: item.variants ?? [],
  option_groups: item.option_groups ?? [],
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
    variants: (form.variants ?? [])
      .filter((v) => v.name.trim().length > 0)
      .map((v, i) => ({
        ...v,
        name: v.name.trim(),
        unit: v.unit ? v.unit.trim() : null,
        price_vnd: Math.max(0, Math.round(Number(v.price_vnd) || 0)),
        display_order: i + 1,
      })),
    option_groups: (form.option_groups ?? [])
      .filter((g) => g.name.trim().length > 0)
      .map((g, gIdx) => ({
        ...g,
        name: g.name.trim(),
        display_order: gIdx + 1,
        options: (g.options ?? [])
          .filter((o) => o.name.trim().length > 0)
          .map((o, oIdx) => ({
            ...o,
            name: o.name.trim(),
            price_delta_vnd: Math.max(0, Math.round(Number(o.price_delta_vnd) || 0)),
            display_order: oIdx + 1,
          })),
      })),
  }
}
