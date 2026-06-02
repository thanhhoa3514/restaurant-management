import { type FC } from 'react'
import { Bell, Check, Receipt } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { WF_LANDMARKS } from '@/features/waiter/data/seed'
import { wfPriorityOf } from '@/features/waiter/helpers'
import { cn } from '@/lib/utils'
import type { Lang, WFTable, WFPriority } from '@/features/waiter/types'

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
        shell: 'bg-red-50/95 border-red-300 ring-red-100/50 shadow-[0_8px_30px_rgba(239,68,68,0.12)] border-2 dark:bg-red-950/20 dark:border-red-800',
        text: 'text-red-950 dark:text-red-200',
        sub: 'text-red-600 dark:text-red-400',
        dot: 'bg-red-500',
        badge: 'destructive',
      }
    case 'ready':
      return {
        shell: 'bg-emerald-50/95 border-emerald-300 ring-emerald-100/50 shadow-[0_8px_30px_rgba(16,185,129,0.12)] border-2 dark:bg-emerald-950/20 dark:border-emerald-800',
        text: 'text-emerald-950 dark:text-emerald-200',
        sub: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        badge: 'success',
      }
    case 'bill':
      return {
        shell: 'bg-blue-50/95 border-blue-300 ring-blue-100/50 shadow-[0_8px_30px_rgba(59,130,246,0.12)] border-2 dark:bg-blue-950/20 dark:border-blue-800',
        text: 'text-blue-950 dark:text-blue-200',
        sub: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500',
        badge: 'default',
      }
    case 'idle':
      return {
        shell: 'bg-amber-50/60 border-amber-300 border-dashed ring-amber-100/30 shadow-[0_4px_15px_rgba(245,158,11,0.06)] dark:bg-amber-950/10 dark:border-amber-800/80',
        text: 'text-amber-950 dark:text-amber-200',
        sub: 'text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-400',
        badge: 'warning',
      }
    case 'occupied':
      return {
        shell: 'bg-white border-zinc-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] ring-zinc-50 dark:bg-zinc-900 dark:border-zinc-800',
        text: 'text-zinc-900 dark:text-zinc-100',
        sub: 'text-zinc-500 dark:text-zinc-400',
        dot: 'bg-zinc-400',
        badge: 'warning',
      }
    case 'empty':
    default:
      return {
        shell: 'bg-zinc-50/80 border-zinc-200/80 ring-transparent shadow-none dark:bg-zinc-900/30 dark:border-zinc-800/60',
        text: 'text-zinc-400 dark:text-zinc-600',
        sub: 'text-zinc-400 dark:text-zinc-600',
        dot: 'bg-zinc-300',
        badge: 'secondary',
      }
  }
}

export function secondarySignals(table: WFTable, primary: WFPriority): Signal[] {
  if (!table.session) return []
  const signals: Signal[] = []
  if (primary !== 'call' && table.session.waiter_called_at) signals.push('call')
  if (primary !== 'ready' && table.session.orders.some((order) => order.items.some((item) => item.status === 'ready'))) {
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

interface FloorPlanProps {
  tables: WFTable[]
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  onSelectTable: (tableId: string) => void
  justChangedIds: Set<string>
}

export const FloorPlan: FC<FloorPlanProps> = ({ tables, now, lang, t, onSelectTable, justChangedIds }) => {
  return (
    <div className="relative min-h-[620px] h-[calc(100dvh-190px)] overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50/70 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(60,60,67,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(60,60,67,0.10) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-8 size-80 rounded-full bg-emerald-400/10 blur-3xl" />

      {WF_LANDMARKS.map((landmark) => (
        <div
          key={landmark.key}
          className="pointer-events-none absolute flex select-none items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 shadow-3xs dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400"
          style={{
            left: `${landmark.x}%`,
            top: `${landmark.y}%`,
            width: `${landmark.w}%`,
            height: `${landmark.h}%`,
          }}
        >
          {t(landmark.key)}
        </div>
      ))}

      {tables.map((table) => {
        const priority = wfPriorityOf(table, now)
        const visual = tableVisuals(priority)
        const secondaries = secondarySignals(table, priority)
        const changed = justChangedIds.has(table.id)
        return (
          <button
            key={table.id}
            type="button"
            onClick={() => onSelectTable(table.id)}
            className={cn(
              'absolute h-20 w-20 rounded-[22px] border-2 shadow-lg ring-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95',
              'backdrop-blur-xl',
              priority === 'call' || priority === 'ready' ? 'animate-pulse' : '',
              changed ? 'scale-110' : '',
              visual.shell,
            )}
            style={{
              left: `${table.position.x_pct}%`,
              top: `${table.position.y_pct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className={cn('relative flex h-full w-full flex-col items-center justify-center font-bold', visual.text)}>
              {priority !== 'empty' && priority !== 'occupied' && priority !== 'idle' && (
                <span className="absolute top-2.5 animate-bounce">
                  {priority === 'call' && <Bell className="size-3 text-red-500" />}
                  {priority === 'ready' && <Check className="size-3 text-emerald-500" />}
                  {priority === 'bill' && <Receipt className="size-3 text-blue-500" />}
                </span>
              )}

              <span className={cn('text-[28px] leading-none tracking-tight tabular-nums', 
                (priority !== 'empty' && priority !== 'occupied' && priority !== 'idle') ? 'mt-3.5' : ''
              )}>
                {table.number}
              </span>

              <span className={cn('mt-0.5 text-[10px] font-bold tracking-tight opacity-75 tabular-nums', visual.sub)}>
                {priority === 'empty' ? (lang === 'vi' ? 'Trống' : 'Empty') : `${table.session?.guest_count ?? 0}/${table.capacity}`}
              </span>
            </span>
            {secondaries.length > 0 && (
              <span className="absolute -right-1 -top-1 flex flex-col gap-0.5">
                {secondaries.map((signal) => (
                  <span key={signal} className={cn('size-3 rounded-full border-2 border-white shadow-sm dark:border-zinc-950', signalDot(signal))} />
                ))}
              </span>
            )}
          </button>
        )
      })}

      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        <LegendDot color="bg-red-500" label={priorityLabel('call', lang)} />
        <LegendDot color="bg-emerald-500" label={priorityLabel('ready', lang)} />
        <LegendDot color="bg-blue-500" label={priorityLabel('bill', lang)} />
        <LegendDot color="bg-amber-300" label={priorityLabel('occupied', lang)} />
        <Badge variant="secondary" className="h-6 rounded-full px-2 text-[11px]">
          {priorityLabel('empty', lang)}
        </Badge>
      </div>
    </div>
  )
}

interface LegendDotProps {
  color: string
  label: string
}

const LegendDot: FC<LegendDotProps> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
    <span className={cn('size-2.5 rounded-full', color)} />
    {label}
  </span>
)

export default FloorPlan
