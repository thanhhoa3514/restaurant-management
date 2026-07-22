import type { Lang } from '../types'
import { vi, en } from '@/i18n'

export const WF_DICT: Record<Lang, Record<string, string | ((...args: never[]) => string)>> = {
  vi: vi.waiter,
  en: en.waiter,
}
