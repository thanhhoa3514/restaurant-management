export type Lang = 'vi' | 'en'

function locale(lang: Lang): string {
  return lang === 'vi' ? 'vi-VN' : 'en-US'
}

/** Full date: "Thứ Hai, 15/07/2026" or "Monday, 07/15/2026" */
export function fmtDateFull(date: Date, lang: Lang): string {
  return date.toLocaleDateString(locale(lang), {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Short date: "15/07/2026" */
export function fmtDateShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

/** Time: "14:30" */
export function fmtTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Time with seconds: "14:30:45" */
export function fmtTimeSec(date: Date): string {
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${fmtTime(date)}:${s}`
}

/** Short date + time: "15/07/2026 14:30" */
export function fmtDateTime(date: Date): string {
  return `${fmtDateShort(date)} ${fmtTime(date)}`
}

/** Duration: "1:30:45" or "30:45" */
export function fmtDuration(seconds: number | null): string {
  if (seconds == null) return ''
  seconds = Math.max(0, Math.floor(seconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
