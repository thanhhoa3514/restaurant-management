import { useMemo } from 'react'
import { vi } from './locales/vi'
import { en } from './locales/en'
import type { Lang, LocaleDict } from './types'

const LOCALES: Record<Lang, LocaleDict> = { vi, en }

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

export type TranslationKey = NestedKeyOf<LocaleDict>

function getNestedValue(obj: Record<string, any>, path: string): string {
  const parts = path.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null) return path
    current = current[part]
  }
  return typeof current === 'string' ? current : path
}

export function useTranslation(lang: Lang = 'vi') {
  const dict = useMemo(() => LOCALES[lang] ?? LOCALES.vi, [lang])

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text = getNestedValue(dict as any, key)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
        }
      }
      return text
    }
  }, [dict])

  return { t, lang, dict }
}
