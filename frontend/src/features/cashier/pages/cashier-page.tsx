import { useMemo, useState, type FC } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { InvoicePanel } from '@/features/cashier/components/invoice-panel'
import { PaymentPanel } from '@/features/cashier/components/payment-panel'
import { ReceiptDialog } from '@/features/cashier/components/receipt-dialog'
import { SessionList } from '@/features/cashier/components/session-list'
import { TakeawayPanel } from '@/features/cashier/components/takeaway-panel'
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
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

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
    contentClassName: 'p-0',
  })

  const isModalOpen = selectedSession !== null
  const handleCloseModal = () => dispatch({ type: 'selectSession', sessionId: null })

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
        <div className="hidden w-[180px] sm:block shrink-0">
          <TakeawayPanel lang={state.lang} t={t} />
        </div>
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

      <div className="flex min-h-0 flex-1 h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[var(--surface-grouped)]">
        {/* Mobile Takeaway Panel */}
        <div className="p-4 pb-0 sm:hidden bg-[var(--background)]">
          <TakeawayPanel lang={state.lang} t={t} />
        </div>

        {/* Main Grid View */}
        <SessionList
          sessions={state.sessions}
          selectedId={state.selectedSessionId}
          now={state.now}
          lang={state.lang}
          t={t}
          onSelect={(id) => dispatch({ type: 'selectSession', sessionId: id })}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[95dvh] w-[98vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl border border-[var(--separator)] bg-[var(--background)]"
        >
          <DialogTitle className="sr-only">Chi tiết hóa đơn & Thanh toán</DialogTitle>
          <div className="flex h-[90dvh] flex-col lg:flex-row">
            {selectedSession && (
              <>
                {/* Mobile Close Button */}
                <div className="flex lg:hidden justify-end p-4 pb-0 bg-[var(--surface-grouped)]/55">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={handleCloseModal}
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                {/* Left side: Invoice Details */}
                <div className="flex flex-1 flex-col overflow-hidden bg-[var(--surface-grouped)]/55 lg:border-r border-[var(--separator)]">
                  <InvoicePanel
                    session={selectedSession}
                    now={state.now}
                    lang={state.lang}
                    t={t}
                    onApplyDiscount={(sessionId, amount, reason) =>
                      dispatch({ type: 'applyDiscount', sessionId, amount, reason })
                    }
                    onRemoveDiscount={(sessionId) =>
                      dispatch({ type: 'removeDiscount', sessionId })
                    }
                    onCloseSession={(sessionId) => dispatch({ type: 'closeSession', sessionId })}
                    onSelectInvoice={(sessionId, invoiceId) =>
                      dispatch({ type: 'selectInvoice', sessionId, invoiceId })
                    }
                    onSplit={(sessionId, groups) =>
                      dispatch({ type: 'splitSession', sessionId, groups })
                    }
                    onSessionReopened={undefined}
                  />
                </div>

                {/* Right side: Payment Details */}
                <div className="flex flex-col w-full lg:w-[450px] shrink-0 bg-[var(--background)] lg:rounded-r-3xl border-t border-[var(--separator)] lg:border-t-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] lg:shadow-none">
                  <div className="hidden lg:flex justify-end p-4 pb-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-[var(--separator)] text-[var(--text-tertiary)]"
                      onClick={handleCloseModal}
                    >
                      <X className="size-5" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <PaymentPanel
                      session={selectedSession}
                      now={state.now}
                      lang={state.lang}
                      t={t}
                      dispatch={dispatch}
                      onReceipt={setReceiptSessionId}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
