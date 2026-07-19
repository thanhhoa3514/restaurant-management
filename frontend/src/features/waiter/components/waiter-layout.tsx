import { type FC, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { wfFmtClock } from '@/features/waiter/helpers'
import { useWaiter } from '@/features/waiter/hooks/use-waiter'
import type { WaiterView } from '@/features/waiter/types'
import { cn } from '@/lib/utils'
import { FloorPlan } from './floor-plan'
import { GridView } from './grid-view'
import { TableSheet } from './table-sheet'
import { PendingSessionsPanel } from './pending-sessions-panel'
import { TakeawayPanel } from '@/features/cashier/components/takeaway-panel'

export const WaiterLayout: FC = () => {
  const { state, actions, counts, selectedTable, t } = useWaiter()
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  useShellConfig({
    title: t('floor_view'),
    subtitle: `${t('restaurant')} · ${t('shift')}`,
    contentClassName: "p-0"
  })

  return (
    <>
      <ShellHeaderCenter>
        <div className="flex items-center justify-center gap-4">
          <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]">
            {wfFmtClock(state.now)}
          </div>
          <Separator orientation="vertical" className="h-7" />
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
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
      <div className="sticky top-0 z-30 border-b border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1600px] px-4 py-2.5 sm:flex sm:h-16 sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-0 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Tabs
              value={state.view}
              onValueChange={(value) => actions.setView(value as WaiterView)}
              className="min-w-0 flex-1 sm:flex-none"
            >
              <TabsList className="w-full rounded-[18px] sm:w-auto">
                <TabsTrigger value="plan" className="flex-1 rounded-[15px] px-4 sm:flex-none sm:px-5">
                  {t('view_plan')}
                </TabsTrigger>
                <TabsTrigger value="grid" className="flex-1 rounded-[15px] px-4 sm:flex-none sm:px-5">
                  {t('view_grid')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="hidden sm:block">
              <PendingSessionsPanel />
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
              <PendingSessionsPanel />
            </div>
          )}
          {counts.calls === 0 && counts.ready === 0 && counts.occupied === 0 && (
            <div className="mt-2 flex sm:hidden gap-2">
              <TakeawayPanel compact lang={state.lang} t={t} />
              <PendingSessionsPanel />
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8">
        {state.view === 'plan' ? (
          <FloorPlan
            tables={state.tables}
            now={state.now}
            lang={state.lang}
            t={t}
            onSelectTable={actions.selectTable}
            justChangedIds={state.justChangedIds}
          />
        ) : (
          <GridView
            tables={state.tables}
            now={state.now}
            lang={state.lang}
            t={t}
            onSelectTable={actions.selectTable}
            justChangedIds={state.justChangedIds}
          />
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
        onRequestBill={actions.requestBill}
        onOpenSession={actions.openSession}
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
          tone === 'red' ? 'animate-pulse bg-red-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500',
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
