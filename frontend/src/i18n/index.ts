import { vi } from './locales/vi'
import { en } from './locales/en'
import type { Lang, LocaleDict } from './types'

export * from './types'
export * from './use-translation'
export { vi } from './locales/vi'
export { en } from './locales/en'

export type ShellStrings = LocaleDict['shell']
export const shellStrings = (lang: Lang = 'vi'): ShellStrings =>
  lang === 'en' ? en.shell : vi.shell

export type AdminT = (key: string, ...args: Array<string | number>) => string

export function makeAdminT(lang: Lang = 'vi'): AdminT {
  const dict = lang === 'en' ? en.admin : vi.admin
  return (key, ...args) => {
    const value = dict[key]
    if (typeof value === 'function') return value(...(args as never[]))
    return value ?? key
  }
}

export type OrderingDict = typeof vi.ordering
export type CashierDict = Record<string, string | ((...args: never[]) => string)>
export type KitchenDict = typeof vi.kitchen

export const DICT: Record<Lang, OrderingDict> = {
  vi: vi.ordering as OrderingDict,
  en: en.ordering as OrderingDict,
}

export const CS_DICT: Record<Lang, CashierDict> = {
  vi: vi.cashier as CashierDict,
  en: en.cashier as CashierDict,
}

export const KDS_DICT: Record<Lang, KitchenDict> = {
  vi: vi.kitchen as KitchenDict,
  en: en.kitchen as KitchenDict,
}
