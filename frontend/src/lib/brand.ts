type Lang = 'vi' | 'en'

export const BRAND = {

  shortName: 'ZH',

  name: {
    vi: 'Zenith Lẩu Nướng',
    en: 'Zenith Hotpot & Grill',
  },

  tagline: {

    en: 'Hotpot & grill — served at your table',
  },
} as const


export const brandNameUpper = (lang: Lang): string => BRAND.name[lang].toUpperCase()
