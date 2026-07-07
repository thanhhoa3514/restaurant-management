import { type FC } from 'react'
import { Bell, Check, Receipt } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { WF_LANDMARKS } from '@/features/waiter/data/seed'
import {
  wfPriorityOf,
  tableVisuals,
  secondarySignals,
  signalDot,
  priorityLabel,
} from '@/features/waiter/helpers'
import { cn } from '@/lib/utils'
import type { Lang, WFTable } from '@/features/waiter/types'

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
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-x-visible sm:px-0">
      {/* ponytail: height as viewport fraction, not header-coupled magic px */}
      <div className="relative min-h-[620px] min-w-[640px] h-[78dvh] overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50/70 shadow-sm sm:min-w-0 dark:border-zinc-800 dark:bg-zinc-950/40">
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
              'absolute h-20 w-20 rounded-[22px] border-2 shadow-lg ring-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 cursor-pointer',
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
                <span className="absolute top-2.5 animate-in slide-in-from-bottom-1 fade-in duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
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


