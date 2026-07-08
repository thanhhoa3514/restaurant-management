import { useCallback, useState } from 'react'

export type Lang = 'vi' | 'en'

const STORAGE_KEY = 'rest_lang'

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
