import { useMemo, type FC } from 'react'
import { Bell, Check, Receipt, Users, Clock } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { wfFmtHMS, wfPriorityOf, wfPriorityRank, wfTimeSinceSignal } from '@/features/waiter/helpers'
import { cn } from '@/lib/utils'
import type { Lang, WFTable } from '@/features/waiter/types'
import { priorityLabel, secondarySignals, signalDot, tableVisuals } from '@/features/waiter/helpers'

interface GridViewProps {
  tables: WFTable[]
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  onSelectTable: (tableId: string) => void
  justChangedIds: Set<string>
}

export const GridView: FC<GridViewProps> = ({ tables, now, lang, onSelectTable, justChangedIds }) => {
  const sortedTables = useMemo(() => {
    return tables
      .map((table) => {
        const priority = wfPriorityOf(table, now)
        return {
          table,
          priority,
          waitSeconds: wfTimeSinceSignal(table, priority, now) ?? 0,
        }
      })
      .sort((left, right) => {
        const priorityDiff = wfPriorityRank(left.priority) - wfPriorityRank(right.priority)
        if (priorityDiff !== 0) return priorityDiff
        return right.waitSeconds - left.waitSeconds
      })
  }, [now, tables])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {sortedTables.map(({ table, priority, waitSeconds }) => {
        const visual = tableVisuals(priority)
        const secondaries = secondarySignals(table, priority)
        const changed = justChangedIds.has(table.id)

        const icons = {
          empty: null,
          occupied: <Users className="size-3.5 text-amber-500" />,
          call: <Bell className="size-3.5 text-red-500 animate-in slide-in-from-bottom-1 fade-in duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />,
          ready: <Check className="size-3.5 text-emerald-500" />,
          bill: <Receipt className="size-3.5 text-blue-500" />,
          idle: <Clock className="size-3.5 text-amber-500" />,
        }

        return (
          <button key={table.id} type="button" onClick={() => onSelectTable(table.id)} className="w-full text-left outline-none">
            <Card
              className={cn(
                'relative flex min-h-[148px] flex-col overflow-hidden rounded-[24px] border-2 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.99]',
                priority === 'call' || priority === 'ready' ? 'ring-2' : '',
                changed ? 'scale-[1.04]' : '',
                visual.shell,
              )}
            >
              {/* Header: Table Number & Status Icon */}
              <div className="flex items-start justify-between w-full">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {lang === 'vi' ? 'BÀN' : 'TABLE'}
                  </span>
                  <div className={cn('text-3xl font-black tracking-tight leading-none mt-0.5', visual.text)}>
                    {table.number}
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs border border-zinc-100 dark:bg-zinc-950 dark:border-zinc-800">
                  {icons[priority] || <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>}
                </div>
              </div>

              {/* Middle Section: Secondary signals & capacity */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant={visual.badge} className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-tight">
                  {priorityLabel(priority, lang)}
                </Badge>
                {secondaries.length > 0 && (
                  <div className="flex gap-0.5 bg-white/70 rounded-full px-1.5 py-0.5 border border-zinc-100 shadow-3xs dark:bg-zinc-950/60 dark:border-zinc-800">
                    {secondaries.map((signal) => (
                      <span key={signal} className={cn('size-2 rounded-full shadow-sm', signalDot(signal))} />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: Capacity and Waiting Time */}
              <div className="mt-auto pt-3 flex items-end justify-between w-full border-t border-zinc-100/50 dark:border-zinc-800/40">
                <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  <Users className="size-3 text-zinc-400" />
                  <span>
                    {priority === 'empty'
                      ? `${table.capacity} ${lang === 'vi' ? 'chỗ' : 'seats'}`
                      : `${table.session?.guest_count ?? 0}/${table.capacity} ${lang === 'vi' ? 'khách' : 'guests'}`}
                  </span>
                </div>

                {priority !== 'empty' && (
                  <span className={cn('flex items-center gap-1 font-mono text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded-full border border-zinc-100 shadow-3xs dark:bg-zinc-950 dark:border-zinc-800', visual.sub)}>
                    <Clock className="size-2.5 text-zinc-400" />
                    <span>{wfFmtHMS(waitSeconds)}</span>
                  </span>
                )}
              </div>
            </Card>
          </button>
        )
      })}
    </div>
  )
}


