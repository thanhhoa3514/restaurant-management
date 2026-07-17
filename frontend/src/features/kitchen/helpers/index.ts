import type { ItemStatus, Urgency, KDSItem } from '../types'
import { STATUS_FLOW } from '../types'

export function nextStatus(s: ItemStatus): ItemStatus {
  const idx = STATUS_FLOW.indexOf(s)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return s
  return STATUS_FLOW[idx + 1]
}

const STATUS_INDEX = new Map(STATUS_FLOW.map((s, i) => [s, i]))

export function minStatus(items: KDSItem[]): ItemStatus {
  let minIdx = STATUS_FLOW.length
  for (const it of items) {
    const i = STATUS_INDEX.get(it.status) ?? STATUS_FLOW.length
    if (i < minIdx) minIdx = i
  }
  return STATUS_FLOW[minIdx]
}

export function fmtClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function fmtHMS(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  seconds = Math.abs(Math.floor(seconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${sign}${m}:${String(s).padStart(2, '0')}`
}

export function fmtTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function urgencyFor(waitSec: number): Urgency {
  if (waitSec < 5 * 60) return 'green'
  if (waitSec < 10 * 60) return 'amber'
  return 'red'
}


