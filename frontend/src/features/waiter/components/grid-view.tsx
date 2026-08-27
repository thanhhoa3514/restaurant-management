import { useMemo, type FC } from 'react'
import { Bell, Check, Clock, ExternalLink, Link2, Receipt, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  wfFmtHMS,
  wfPriorityOf,
  wfPriorityRank,
  wfTimeSinceSignal,
} from '@/features/waiter/helpers'
import { cn } from '@/lib/utils'
import type { Lang, WFTable } from '@/features/waiter/types'
import { priorityLabel, secondarySignals, signalDot, tableVisuals } from '@/features/waiter/helpers'

interface GridViewProps {
  tables: WFTable[]
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  onSelectTable: (tableId: string) => void
  onOpenGuestSession: (tableId: string) => void
  guestOrderUrls: Map<string, string>
  justChangedIds: Set<string>
  mergeMode: boolean
  mergeSelectedIds: string[]
  onToggleMergeSelection: (tableId: string) => void
}

export const GridView: FC<GridViewProps> = ({
  tables,
  now,
  lang,
  t,
  onSelectTable,
  onOpenGuestSession,
  guestOrderUrls,
  justChangedIds,
  mergeMode,
  mergeSelectedIds,
  onToggleMergeSelection,
}) => {
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
        const mergeSelected = mergeSelectedIds.includes(table.id)

        const icons = {
          empty: null,
          occupied: <Users className="size-3.5 text-amber-500" />,
          call: (
            <Bell className="size-3.5 text-red-500 animate-in slide-in-from-bottom-1 fade-in duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />
          ),
          ready: <Check className="size-3.5 text-emerald-500" />,
          bill: <Receipt className="size-3.5 text-blue-500" />,
          idle: <Clock className="size-3.5 text-amber-500" />,
        }

        const isMergeDisabled = mergeMode && !table.session

        return (
          <div
            key={table.id}
            role={mergeMode ? 'checkbox' : 'button'}
            tabIndex={isMergeDisabled ? -1 : 0}
            aria-pressed={mergeMode ? mergeSelected : undefined}
            aria-disabled={isMergeDisabled || undefined}
            onClick={() => {
              if (isMergeDisabled) return
              if (mergeMode) {
                onToggleMergeSelection(table.id)
              } else {
                onSelectTable(table.id)
              }
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || isMergeDisabled) return
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              if (mergeMode) {
                onToggleMergeSelection(table.id)
              } else {
                onSelectTable(table.id)
              }
            }}
            className="w-full cursor-pointer rounded-[20px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--system-blue)] aria-disabled:cursor-not-allowed"
          >
            <Card
              className={cn(
                'relative flex min-h-[148px] flex-col overflow-hidden rounded-[20px] border-2 p-4 transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] focus-within:border-[var(--system-blue)] active:bg-[var(--surface-grouped)]',
                priority === 'call' || priority === 'ready' ? 'ring-2' : '',
                changed ? 'ring-2 ring-[var(--system-blue)]' : '',
                mergeSelected
                  ? 'border-[var(--system-purple)] ring-2 ring-[var(--system-purple)]/25'
                  : '',
                mergeMode && !table.session ? 'cursor-not-allowed opacity-50' : '',
                visual.shell,
              )}
            >
              {(mergeSelected || table.session?.merge_group_id) && (
                <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-[var(--system-purple)] text-white">
                  <Link2 className="size-3.5" />
                </span>
              )}
              {/* Header: Table Number & Status Icon */}
              <div className="flex w-full items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {lang === 'vi' ? 'BÀN' : 'TABLE'}
                  </span>
                  <div
                    className={cn(
                      'text-3xl font-black tracking-tight leading-none mt-0.5',
                      visual.text,
                    )}
                  >
                    {table.code}
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs border border-zinc-100 dark:bg-zinc-950 dark:border-zinc-800">
                  {icons[priority] || (
                    <span className="text-xs text-[var(--text-secondary)]">—</span>
                  )}
                </div>
              </div>

              {/* Middle Section: Secondary signals & capacity */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={visual.badge}
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight"
                >
                  {priorityLabel(priority, lang)}
                </Badge>
                {secondaries.length > 0 && (
                  <div className="flex gap-0.5 bg-white/70 rounded-full px-1.5 py-0.5 border border-zinc-100 shadow-3xs dark:bg-zinc-950/60 dark:border-zinc-800">
                    {secondaries.map((signal) => (
                      <span
                        key={signal}
                        className={cn('size-2 rounded-full shadow-sm', signalDot(signal))}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: Capacity and Waiting Time */}
              <div className="mt-auto pt-3 flex items-end justify-between w-full border-t border-zinc-100/50 dark:border-zinc-800/40">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
                  <Users className="size-3 text-[var(--text-secondary)]" />
                  <span>
                    {priority === 'empty'
                      ? `${table.capacity} ${lang === 'vi' ? 'chỗ' : 'seats'}`
                      : `${table.session?.guest_count ?? 0}/${table.capacity} ${lang === 'vi' ? 'khách' : 'guests'}`}
                  </span>
                </div>

                {guestOrderUrls.has(table.id) && !mergeMode ? (
                  <Button
                    type="button"
                    size="icon"
                    aria-label={t('open_guest_screen')}
                    title={t('open_guest_screen')}
                    className="size-9 shrink-0 rounded-xl shadow-sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenGuestSession(table.id)
                    }}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : priority !== 'empty' ? (
                  <span
                    className={cn(
                      'flex items-center gap-1 font-mono text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded-full border border-zinc-100 shadow-3xs dark:bg-zinc-950 dark:border-zinc-800',
                      visual.sub,
                    )}
                  >
                    <Clock className="size-2.5 text-[var(--text-secondary)]" />
                    <span>{wfFmtHMS(waitSeconds)}</span>
                  </span>
                ) : null}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
