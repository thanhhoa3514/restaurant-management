import { useMemo, useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig } from '@/components/staff-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { InvoicePanel } from '@/features/cashier/components/invoice-panel'
import { PaymentPanel } from '@/features/cashier/components/payment-panel'
import { ReceiptDialog } from '@/features/cashier/components/receipt-dialog'
import { SessionList } from '@/features/cashier/components/session-list'
import { fmtClockSec } from '@/features/cashier/helpers'
import { CashierProvider, useCashier } from '@/features/cashier/hooks/use-cashier'

export const CashierLayout: FC = () => (
  <CashierProvider>
    <CashierWorkspace />
  </CashierProvider>
)

const CashierWorkspace: FC = () => {
  const { state, dispatch, selectedSession, t } = useCashier()
  const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(true)
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  const receiptSession = useMemo(
    () => state.sessions.find((session) => session.id === receiptSessionId) ?? null,
    [receiptSessionId, state.sessions],
  )
  const pendingCount = state.sessions.filter(
    (session) => session.status !== 'closed' && session.status !== 'voided',
  ).length
  const closedToday = 23 + state.sessions.filter((session) => session.status === 'closed').length
  const hasPendingPayment = state.sessions.some((session) => session.payment?.status === 'pending')

  const forcePayment = (success: boolean) => {
    const pending = state.sessions.find((session) => session.payment?.status === 'pending')
    if (!pending) return
    dispatch({ type: success ? 'completePayment' : 'failPayment', sessionId: pending.id })
  }

  useShellConfig({
    title: t('cashier'),
    subtitle: `${t('restaurant')} · ${t('shift')} · ${t('cashier_name')}`,
    headerCenter: (
      <div className="flex items-center justify-center gap-3">
        <div className="font-mono text-xl font-bold tabular-nums">{fmtClockSec(state.now)}</div>
        <div className="h-5 w-px bg-[var(--separator)]" />
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          ×{state.timeMultiplier}
        </div>
      </div>
    ),
    headerActions: (
      <>
        <StatPill label={t('pending_label')} value={pendingCount} tone="orange" />
        <StatPill label={t('closed_today')} value={closedToday} tone="green" />
        <LanguageSwitcher
          currentLang={state.lang}
          onLangChange={(newLang) => {
            setChangingLang(newLang)
            setTimeout(() => {
              dispatch({ type: 'setLang', lang: newLang })
              setChangingLang(null)
            }, 750)
          }}
        />
      </>
    ),
    contentClassName: "p-0"
  })

  return (
    <>
      <div className="grid min-h-0 flex-1 h-[calc(100dvh-64px)] grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        <aside className="min-h-0 overflow-hidden border-r border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-xl max-lg:hidden">
          <SessionList
            sessions={state.sessions}
            selectedId={state.selectedSessionId}
            now={state.now}
            lang={state.lang}
            t={t}
            onSelect={(id) => dispatch({ type: 'selectSession', sessionId: id })}
          />
        </aside>

        <section className="min-h-0 overflow-hidden bg-[var(--surface-grouped)]/55">
          <div className="border-b border-[var(--separator)] bg-[var(--material-regular)] p-3 backdrop-blur-xl lg:hidden">
            <SessionList
              sessions={state.sessions}
              selectedId={state.selectedSessionId}
              now={state.now}
              lang={state.lang}
              t={t}
              onSelect={(id) => dispatch({ type: 'selectSession', sessionId: id })}
            />
          </div>
          <InvoicePanel
            session={selectedSession}
            now={state.now}
            lang={state.lang}
            t={t}
            onApplyDiscount={(sessionId, amount, reason) =>
              dispatch({ type: 'applyDiscount', sessionId, amount, reason })
            }
            onRemoveDiscount={(sessionId) => dispatch({ type: 'removeDiscount', sessionId })}
            onCloseSession={(sessionId) => dispatch({ type: 'closeSession', sessionId })}
          />
        </section>

        <aside className="min-h-0 overflow-hidden border-l border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-xl max-lg:hidden">
          <PaymentPanel
            session={selectedSession}
            now={state.now}
            lang={state.lang}
            t={t}
            dispatch={dispatch}
            onReceipt={setReceiptSessionId}
          />
        </aside>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-[var(--z-raised)] lg:hidden">
        <Card className="border border-[var(--separator)] bg-[var(--material-thick)] shadow-xl backdrop-blur-2xl">
          <PaymentPanel
            session={selectedSession}
            now={state.now}
            lang={state.lang}
            t={t}
            dispatch={dispatch}
            onReceipt={setReceiptSessionId}
          />
        </Card>
      </div>

      <ReceiptDialog
        open={receiptSessionId !== null}
        session={receiptSession}
        t={t}
        lang={state.lang}
        onOpenChange={(open) => setReceiptSessionId(open ? receiptSessionId : null)}
      />

      <LanguageLoader open={changingLang !== null} targetLang={changingLang || state.lang} />

      <DemoControls
        open={demoOpen}
        setOpen={setDemoOpen}
        paused={state.paused}
        multiplier={state.timeMultiplier}
        hasPendingPayment={hasPendingPayment}
        t={t}
        onInjectBill={() => dispatch({ type: 'injectBill' })}
        onForceSuccess={() => forcePayment(true)}
        onForceFail={() => forcePayment(false)}
        onReset={() => dispatch({ type: 'resetAll' })}
        onPauseChange={(paused) => dispatch({ type: 'setPaused', paused })}
        onMultiplierChange={(value) => dispatch({ type: 'setTimeMultiplier', value })}
      />
    </>
  )
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'orange' | 'green'
}) {
  return (
    <Badge
      className={`hidden rounded-full border-0 px-3 py-1.5 sm:inline-flex ${
        tone === 'green'
          ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
          : 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]'
      }`}
    >
      {label} · <span className="font-mono tabular-nums">{value}</span>
    </Badge>
  )
}

function DemoControls({
  open,
  setOpen,
  paused,
  multiplier,
  hasPendingPayment,
  t,
  onInjectBill,
  onForceSuccess,
  onForceFail,
  onReset,
  onPauseChange,
  onMultiplierChange,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  paused: boolean
  multiplier: number
  hasPendingPayment: boolean
  t: (key: string, ...args: Array<number | string>) => string
  onInjectBill: () => void
  onForceSuccess: () => void
  onForceFail: () => void
  onReset: () => void
  onPauseChange: (paused: boolean) => void
  onMultiplierChange: (value: number) => void
}) {
  if (!open) {
    return (
      <Button
        className="fixed bottom-5 right-5 z-[var(--z-modal)] rounded-full shadow-2xl"
        onClick={() => setOpen(true)}
      >
        {t('demo_title')}
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-5 right-5 z-[var(--z-modal)] w-72 border border-[var(--separator)] bg-zinc-950 p-3 text-white shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">{t('demo_title')}</div>
          <div className="text-[10px] text-zinc-400">{t('demo_subtitle')}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 rounded-full px-2"
          onClick={() => setOpen(false)}
        >
          −
        </Button>
      </div>
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={onInjectBill}
        >
          {t('demo_inject_bill')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          disabled={!hasPendingPayment}
          onClick={onForceSuccess}
        >
          {t('demo_force_success')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          disabled={!hasPendingPayment}
          onClick={onForceFail}
        >
          {t('demo_force_fail')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={onReset}
        >
          {t('demo_reset')}
          <span>↺</span>
        </Button>
        <Button
          variant={paused ? 'default' : 'secondary'}
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={() => onPauseChange(!paused)}
        >
          {t('demo_pause')}
          <span>{paused ? 'ON' : 'OFF'}</span>
        </Button>
        <label className="block text-xs font-semibold text-zinc-300" htmlFor="cashier-speed">
          Speed multiplier
        </label>
        <Input
          id="cashier-speed"
          type="number"
          min={1}
          max={60}
          value={multiplier}
          className="bg-zinc-900 text-white"
          onChange={(event) => onMultiplierChange(Number(event.target.value) || 1)}
        />
      </div>
    </Card>
  )
}

export default CashierLayout
