import { useMemo, useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { InvoicePanel } from '@/features/cashier/components/invoice-panel'
import { PaymentPanel } from '@/features/cashier/components/payment-panel'
import { ReceiptDialog } from '@/features/cashier/components/receipt-dialog'
import { SessionList } from '@/features/cashier/components/session-list'
import { fmtClockSec } from '@/features/cashier/helpers'
import { CashierProvider, useCashier } from '@/features/cashier/hooks/use-cashier'
import { DemoControls } from '@/features/cashier/components/demo-controls'

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
    contentClassName: "p-0"
  })

  return (
    <>
      <ShellHeaderCenter>
        <div className="flex items-center justify-center gap-3">
          <div className="font-mono text-xl font-bold tabular-nums">{fmtClockSec(state.now)}</div>
          <div className="h-5 w-px bg-[var(--separator)]" />
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            ×{state.timeMultiplier}
          </div>
        </div>
      </ShellHeaderCenter>
      <ShellHeaderActions>
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
      </ShellHeaderActions>
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



export default CashierLayout
