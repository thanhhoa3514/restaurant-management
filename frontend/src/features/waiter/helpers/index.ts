import type {
  ItemStatus,
  WFPriority,
  WFTable,
  StatusHistoryEntry,
} from '../types'
import { STATUS_FLOW } from '../types'

export function wfBuildHistory(
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

export function wfPriorityOf(table: WFTable, now: Date): WFPriority {
  if (table.status === 'empty' || !table.session) return 'empty'
  const s = table.session
  if (s.waiter_called_at) return 'call'
  const anyReady = s.orders.some((o) => o.items.some((it) => it.status === 'ready'))
  if (anyReady) return 'ready'
  if (s.bill_requested_at) return 'bill'
  const lastOrder =
    s.orders.length ? s.orders[s.orders.length - 1].submitted_at : s.started_at
  if (now.getTime() - lastOrder.getTime() > 20 * 60 * 1000) return 'idle'
  return 'occupied'
}

export function wfPriorityRank(priority: WFPriority): number {
  const ranks: Record<WFPriority, number> = {
    call: 0,
    ready: 1,
    bill: 2,
    idle: 3,
    occupied: 4,
    empty: 5,
  }
  return ranks[priority] ?? 6
}

export function wfTimeSinceSignal(table: WFTable, priority: WFPriority, now: Date): number | null {
  if (!table.session) return null
  const s = table.session
  if (priority === 'call' && s.waiter_called_at)
    return Math.max(0, Math.floor((now.getTime() - s.waiter_called_at.getTime()) / 1000))
  if (priority === 'bill' && s.bill_requested_at)
    return Math.max(0, Math.floor((now.getTime() - s.bill_requested_at.getTime()) / 1000))
  if (priority === 'ready') {
    let earliest = Infinity
    for (const o of s.orders) {
      for (const it of o.items) {
        if (it.status === 'ready') {
          const h = it.status_history.find((x) => x.status === 'ready')
          if (h && h.timestamp.getTime() < earliest) earliest = h.timestamp.getTime()
        }
      }
    }
    if (earliest === Infinity) return null
    return Math.max(0, Math.floor((now.getTime() - earliest) / 1000))
  }
  if (priority === 'occupied' || priority === 'idle') {
    return Math.max(0, Math.floor((now.getTime() - s.started_at.getTime()) / 1000))
  }
  return null
}

export function wfFmtClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function wfFmtTimestamp(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function wfFmtHMS(seconds: number | null): string {
  if (seconds == null) return ''
  seconds = Math.max(0, Math.floor(seconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function wfFmtMin(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60))
}

export function wfFmtVND(amount: number): string {
  const r = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return r + 'đ'
}
