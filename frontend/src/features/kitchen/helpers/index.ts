import type { ItemStatus, Urgency, KDSItem, Ticket, StatusHistoryEntry } from '../types'
import { STATUS_FLOW } from '../types'

export function nextStatus(s: ItemStatus): ItemStatus {
  const idx = STATUS_FLOW.indexOf(s)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return s
  return STATUS_FLOW[idx + 1]
}

export function minStatus(items: KDSItem[]): ItemStatus {
  let minIdx = STATUS_FLOW.length
  for (const it of items) {
    const i = STATUS_FLOW.indexOf(it.status)
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

export function buildHistory(
  currentStatus: ItemStatus,
  submittedAt: Date,
  now: Date = new Date(),
): StatusHistoryEntry[] {
  const endIdx = STATUS_FLOW.indexOf(currentStatus)
  if (endIdx < 0) return [{ status: 'pending', timestamp: new Date(submittedAt) }]
  const elapsed = Math.max(1, now.getTime() - submittedAt.getTime())
  const step = elapsed / (endIdx + 1)
  const history: StatusHistoryEntry[] = []
  for (let i = 0; i <= endIdx; i++) {
    const ts = new Date(submittedAt.getTime() + Math.round(step * i))
    history.push({ status: STATUS_FLOW[i], timestamp: ts })
  }
  return history
}

export function getDisplayTime(now: Date, ticket: Ticket): number {
  return Math.max(0, Math.floor((now.getTime() - ticket.submitted_at.getTime()) / 1000))
}
