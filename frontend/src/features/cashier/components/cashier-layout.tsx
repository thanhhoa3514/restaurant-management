import { useMemo, useState, type FC } from 'react'
import { ChevronLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { InvoicePanel } from '@/features/cashier/components/invoice-panel'
import { PaymentPanel } from '@/features/cashier/components/payment-panel'
import { ReceiptDialog } from '@/features/cashier/components/receipt-dialog'
import { SessionList } from '@/features/cashier/components/session-list'
import { fmtClockSec, fmtVND } from '@/features/cashier/helpers'
import { CashierProvider, useCashier } from '@/features/cashier/hooks/use-cashier'

export const CashierLayout: FC = () => (
  <CashierProvider>
    <CashierWorkspace />
  </CashierProvider>
)

const CashierWorkspace: FC = () => {
  const { state, dispatch, selectedSession, t } = useCashier()
  const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null)
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list')
  const [payOpen, setPayOpen] = useState(false)

  const receiptSession = useMemo(
    () => state.sessions.find((session) => session.id === receiptSessionId) ?? null,
    [receiptSessionId, state.sessions],
  )
  const pendingCount = state.sessions.filter(
    (session) => session.status !== 'closed' && session.status !== 'voided',
  ).length
  const closedToday = 23 + state.sessions.filter((session) => session.status === 'closed').length

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

        <section className="flex min-h-0 flex-col overflow-hidden bg-[var(--surface-grouped)]/55">
          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            {mobilePane === 'detail' && selectedSession ? (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--separator)] bg-[var(--material-regular)] px-2 py-2 backdrop-blur-xl">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-0.5 rounded-full pl-1.5 pr-3"
                    onClick={() => setMobilePane('list')}
                  >
                    <ChevronLeft className="size-5" />
                    {t('back')}
                  </Button>
                  <div className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text)]">
                    {t('table')} {selectedSession.table_number}
                  </div>
                  <Badge className="shrink-0 rounded-full border-0 bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                    {t(`status_${selectedSession.status}`)}
                  </Badge>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
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
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--separator)] bg-[var(--material-thick)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-2xl">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {t('total')}
                    </div>
                    <div className="truncate text-xl font-bold tabular-nums text-[var(--system-orange)]">
                      {fmtVND(selectedSession.invoice.total)}
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="shrink-0 rounded-full px-6"
                    onClick={() => setPayOpen(true)}
                  >
                    {t('payment')}
                  </Button>
                </div>
              </>
            ) : (
              <SessionList
                sessions={state.sessions}
                selectedId={state.selectedSessionId}
                now={state.now}
                lang={state.lang}
                t={t}
                onSelect={(id) => {
                  dispatch({ type: 'selectSession', sessionId: id })
                  setMobilePane('detail')
                }}
              />
            )}
          </div>
          <div className="hidden min-h-0 flex-1 lg:block">
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
          </div>
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

      <Sheet open={payOpen && selectedSession !== null} onOpenChange={setPayOpen}>
        <SheetContent
          side="bottom"
          hideClose
          className="h-[88dvh] gap-0 rounded-t-[24px] border-t border-[var(--separator)] bg-[var(--material-thick)] p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[var(--separator)]" />
          <div className="min-h-0 flex-1 overflow-hidden">
            <PaymentPanel
              session={selectedSession}
              now={state.now}
              lang={state.lang}
              t={t}
              dispatch={dispatch}
              onReceipt={setReceiptSessionId}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ReceiptDialog
        open={receiptSessionId !== null}
        session={receiptSession}
        t={t}
        lang={state.lang}
        onOpenChange={(open) => setReceiptSessionId(open ? receiptSessionId : null)}
      />

      <LanguageLoader open={changingLang !== null} targetLang={changingLang || state.lang} />
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
