import { useCallback, useState } from 'react'

export type Lang = 'vi' | 'en'

const STORAGE_KEY = 'rest_lang'

/**
 * Shared language state for the staff shell. One localStorage key (`rest_lang`)
 * so language is consistent across admin routes. Post screen-collapse this
 * becomes the single shell-wide lang hook (feature-specific keys disappear with
 * their screens).
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(STORAGE_KEY) as Lang) || 'vi',
  )

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  return { lang, setLang }
}
