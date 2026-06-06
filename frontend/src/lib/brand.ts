/**
 * Single source of truth for restaurant branding.
 *
 * Placeholder values for "Quán Lẩu Nướng" (hotpot & grill). Replace `name` /
 * `tagline` once the final brand is decided in Figma — every screen reads from
 * here, so the change is one edit.
 */

type Lang = 'vi' | 'en'

export const BRAND = {
  /** Logo initials shown in the sidebar/header avatar. */
  shortName: 'LN',
  /** Full restaurant name per language. */
  name: {
    vi: 'Quán Lẩu Nướng',
    en: 'Hotpot & Grill House',
  },
  /** Short tagline under the name on guest/landing screens. */
  tagline: {
    vi: 'Lẩu & nướng — phục vụ tại bàn',
    en: 'Hotpot & grill — served at your table',
  },
} as const

/** Uppercase name for printed invoices/receipts. */
export const brandNameUpper = (lang: Lang): string => BRAND.name[lang].toUpperCase()
