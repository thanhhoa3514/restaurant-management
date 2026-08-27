import type { ItemStatus, WFPriority, WFTable, StatusHistoryEntry, Lang } from '../types'
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
  const lastOrder = s.orders.length ? s.orders[s.orders.length - 1].submitted_at : s.started_at
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
          let readyTime: number | null = null
          for (const x of it.status_history) {
            if (x.status === 'ready') {
              readyTime = x.timestamp.getTime()
              break
            }
          }
          if (readyTime !== null && readyTime < earliest) earliest = readyTime
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

export const wfFmtTime = wfFmtClock

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
  const r = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return r + 'đ'
}

export type Signal = 'call' | 'ready' | 'bill'

export interface WaiterVisuals {
  shell: string
  text: string
  sub: string
  dot: string
  badge: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
}

export function tableVisuals(priority: WFPriority): WaiterVisuals {
  switch (priority) {
    case 'call':
      return {
        shell: 'bg-[var(--system-red)]/8 border-[var(--system-red)]/40 ring-[var(--system-red)]/20',
        text: 'text-[var(--text)]',
        sub: 'text-[var(--system-red)]',
        dot: 'bg-[var(--system-red)]',
        badge: 'destructive',
      }
    case 'ready':
      return {
        shell:
          'bg-[var(--system-green)]/8 border-[var(--system-green)]/40 ring-[var(--system-green)]/20',
        text: 'text-[var(--text)]',
        sub: 'text-[var(--system-green)]',
        dot: 'bg-[var(--system-green)]',
        badge: 'success',
      }
    case 'bill':
      return {
        shell:
          'bg-[var(--system-blue)]/8 border-[var(--system-blue)]/40 ring-[var(--system-blue)]/20',
        text: 'text-[var(--text)]',
        sub: 'text-[var(--system-blue)]',
        dot: 'bg-[var(--system-blue)]',
        badge: 'default',
      }
    case 'idle':
      return {
        shell:
          'border-dashed border-[var(--system-orange)]/45 bg-[var(--system-orange)]/8 ring-[var(--system-orange)]/20',
        text: 'text-[var(--text)]',
        sub: 'text-[var(--system-orange)]',
        dot: 'bg-[var(--system-orange)]',
        badge: 'warning',
      }
    case 'occupied':
      return {
        shell: 'border-[var(--separator)] bg-[var(--bg-elevated)] ring-transparent',
        text: 'text-[var(--text)]',
        sub: 'text-[var(--text-secondary)]',
        dot: 'bg-[var(--text-secondary)]',
        badge: 'warning',
      }
    case 'empty':
    default:
      return {
        shell: 'border-[var(--separator)] bg-[var(--surface-grouped)]/55 ring-transparent',
        text: 'text-[var(--text-secondary)]',
        sub: 'text-[var(--text-secondary)]',
        dot: 'bg-[var(--text-secondary)]',
        badge: 'secondary',
      }
  }
}

export function secondarySignals(table: WFTable, primary: WFPriority): Signal[] {
  if (!table.session) return []
  const signals: Signal[] = []
  if (primary !== 'call' && table.session.waiter_called_at) signals.push('call')
  if (
    primary !== 'ready' &&
    table.session.orders.some((order) => order.items.some((item) => item.status === 'ready'))
  ) {
    signals.push('ready')
  }
  if (primary !== 'bill' && table.session.bill_requested_at) signals.push('bill')
  return signals
}

export function signalDot(signal: Signal): string {
  if (signal === 'call') return 'bg-red-500'
  if (signal === 'ready') return 'bg-emerald-500'
  return 'bg-blue-500'
}

export function priorityLabel(priority: WFPriority, lang: Lang): string {
  const labels: Record<WFPriority, string> = {
    call: lang === 'vi' ? 'Gọi nhân viên' : 'Calling waiter',
    ready: lang === 'vi' ? 'Có món sẵn sàng' : 'Items ready',
    bill: lang === 'vi' ? 'Yêu cầu thanh toán' : 'Bill requested',
    idle: lang === 'vi' ? 'Lâu chưa hoạt động' : 'Idle',
    occupied: lang === 'vi' ? 'Đang phục vụ' : 'Active',
    empty: lang === 'vi' ? 'Trống' : 'Empty',
  }
  return labels[priority]
}
