import { type FC, useMemo, useState } from 'react'
import { Building2, Link2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { wfFmtClock } from '@/features/waiter/helpers'
import { useWaiter } from '@/features/waiter/hooks/use-waiter'
import type { WFTable } from '@/features/waiter/types'
import { cn } from '@/lib/utils'
import { GridView } from '../components/grid-view'
import { TableSheet } from '../components/table-sheet'
import { ActionCenterPanel } from '../components/action-center-panel'
import { TakeawayPanel } from '@/features/cashier/components/takeaway-panel'
import '@/features/dining/table-catalogue.css'

export const WaiterLayout: FC = () => {
  const { state, actions, counts, selectedTable, t } = useWaiter()
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  const groupId = selectedTable?.session?.merge_group_id
  const mergeSiblings = groupId
    ? state.tables
        .filter(
          (table) => table.id !== selectedTable?.id && table.session?.merge_group_id === groupId,
        )
        .map((table) => table.code)
    : []
  const areaGroups = useMemo(() => {
    const groups = new Map<string, WFTable[]>()
    for (const table of state.tables) {
      if (!table.area_name) continue
      const key = `${table.area_order}:${table.area_name}`
      const group = groups.get(key) ?? []
      group.push(table)
      groups.set(key, group)
    }
    return Array.from(groups.values())
      .map((tables) => ({
        name: tables[0]?.area_name ?? t('area_unassigned'),
        order: tables[0]?.area_order ?? Number.MAX_SAFE_INTEGER,
        tables,
      }))
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
  }, [state.tables, t])

  useShellConfig({
    title: t('floor_view'),
    subtitle: `${t('restaurant')} · ${t('shift')}`,
    contentClassName: 'p-0',
  })

  return (
    <>
      <ShellHeaderCenter>
        <div className="flex items-center justify-center gap-4">
          <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]">
            {wfFmtClock(state.now)}
          </div>
          <Separator orientation="vertical" className="h-7" />
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            {t('shift')}
          </div>
        </div>
      </ShellHeaderCenter>
      <ShellHeaderActions>
        <CounterPill tone="red" label={t('calls')} value={counts.calls} />
        <CounterPill tone="emerald" label={t('ready')} value={counts.ready} />
        <LanguageSwitcher
          currentLang={state.lang}
          onLangChange={(newLang) => {
            setChangingLang(newLang)
            setTimeout(() => {
              actions.setLang(newLang)
              setChangingLang(null)
            }, 750)
          }}
          className="hidden sm:inline-flex"
        />
      </ShellHeaderActions>
      <div className="border-b border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1600px] px-4 py-2.5 sm:flex sm:h-16 sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-0 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] sm:flex">
              <Building2 className="size-4" />
              {t(
                'area_summary',
                areaGroups.length,
                state.tables.filter((table) => table.area_name).length,
              )}
            </div>
            <div className="hidden sm:block">
              <ActionCenterPanel />
            </div>
            <div className="hidden sm:block">
              <TakeawayPanel compact lang={state.lang} t={t} />
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums max-sm:hidden"
            >
              {t('occupied_summary', counts.occupied, counts.total)}
            </Badge>
          </div>
          {(counts.calls > 0 || counts.ready > 0 || counts.occupied > 0) && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5 sm:hidden">
              <SignalChip tone="red" label={t('calls')} value={counts.calls} />
              <SignalChip tone="emerald" label={t('ready')} value={counts.ready} />
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
              >
                {t('occupied_summary', counts.occupied, counts.total)}
              </Badge>
              <TakeawayPanel compact lang={state.lang} t={t} />
              <ActionCenterPanel />
            </div>
          )}
          {counts.calls === 0 && counts.ready === 0 && counts.occupied === 0 && (
            <div className="mt-2 flex sm:hidden gap-2">
              <TakeawayPanel compact lang={state.lang} t={t} />
              <ActionCenterPanel />
            </div>
          )}
        </div>
      </div>

      <main className="dining-catalogue mx-auto w-full max-w-[1600px] px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              'rounded-full',
              state.mergeMode && 'bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90',
            )}
            onClick={actions.toggleMergeMode}
          >
            {state.mergeMode ? <X className="size-4" /> : <Link2 className="size-4" />}
            {state.mergeMode ? t('merge_cancel') : t('merge_start')}
          </Button>
          {state.mergeMode && (
            <>
              <span className="text-sm text-[var(--text-secondary)]">
                {t('merge_hint', state.mergeSelectedIds.length)}
              </span>
              <Button
                size="sm"
                className="rounded-full bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
                disabled={state.mergeSelectedIds.length < 2}
                onClick={actions.confirmMerge}
              >
                {t('merge_confirm')}
              </Button>
            </>
          )}
        </div>

        {areaGroups.map((group) => (
          <section key={`${group.order}:${group.name}`} className="dining-area-section">
            <div className="dining-area-heading">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                  <Building2 className="size-5" />
                </span>
                <h2 className="text-[17px] font-semibold text-[var(--text)]">{group.name}</h2>
              </div>
              <p className="text-sm tabular-nums text-[var(--text-secondary)]">
                {t(
                  'area_occupied_summary',
                  group.tables.filter((table) => table.status === 'occupied').length,
                  group.tables.length,
                )}
              </p>
            </div>
            <GridView
              tables={group.tables}
              now={state.now}
              lang={state.lang}
              t={t}
              onSelectTable={actions.selectTable}
              justChangedIds={state.justChangedIds}
              mergeMode={state.mergeMode}
              mergeSelectedIds={state.mergeSelectedIds}
              onToggleMergeSelection={actions.toggleMergeSelection}
            />
          </section>
        ))}

        {areaGroups.length === 0 && (
          <div className="dining-area-empty min-h-44">
            <Building2 className="size-8" />
            <p>{t('area_empty')}</p>
          </div>
        )}
      </main>

      <TableSheet
        open={selectedTable !== null}
        table={selectedTable}
        now={state.now}
        lang={state.lang}
        t={t}
        onClose={() => actions.selectTable(null)}
        onAcknowledgeCall={actions.acknowledgeCall}
        onNotifyCashier={actions.notifyCashier}
        onMarkItemServed={actions.markItemServed}
        onMarkAllServed={actions.markAllServed}
        onConfirmItem={actions.confirmItem}
        onRejectItem={actions.rejectItem}
        onRequestBill={actions.requestBill}
        onOpenSession={actions.openSession}
        onSplitGroup={actions.splitGroup}
        mergeSiblings={mergeSiblings}
      />

      <LanguageLoader open={changingLang !== null} targetLang={changingLang || state.lang} />
    </>
  )
}

interface CounterPillProps {
  tone: 'red' | 'emerald' | 'blue'
  label: string
  value: number
}

const CHIP_TONE_CLASSES: Record<CounterPillProps['tone'], string> = {
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
}

const SignalChip: FC<CounterPillProps> = ({ tone, label, value }) => {
  if (value === 0) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums',
        CHIP_TONE_CLASSES[tone],
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'red'
            ? 'animate-pulse bg-red-500'
            : tone === 'emerald'
              ? 'bg-emerald-500'
              : 'bg-blue-500',
        )}
      />
      {label}
      <span>{value}</span>
    </span>
  )
}

const TONE_CLASSES: Record<CounterPillProps['tone'], string> = {
  red: 'bg-red-500 text-white shadow-red-500/20',
  emerald: 'bg-emerald-500 text-white shadow-emerald-500/20',
  blue: 'bg-blue-500 text-white shadow-blue-500/20',
}

const CounterPill: FC<CounterPillProps> = ({ tone, label, value }) => {
  if (value === 0) return null
  return (
    <div
      className={cn(
        'hidden items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm font-bold shadow-lg sm:inline-flex',
        TONE_CLASSES[tone],
      )}
    >
      <span>{label}</span>
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 tabular-nums">
        {value}
      </span>
    </div>
  )
}

export default WaiterLayout
