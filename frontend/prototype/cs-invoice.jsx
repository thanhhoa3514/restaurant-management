// Cashier — Column 2: Invoice Detail.

const { useState: _civState, useMemo: _civMemo, useEffect: _civEffect } = React;

function InvoiceDetail({ session, now, lang, t, onApplyDiscount, onRemoveDiscount, onVoidSession }) {
  const [discountOpen, setDiscountOpen] = _civState(false);
  const [voidOpen, setVoidOpen] = _civState(false);
  const [historyOpen, setHistoryOpen] = _civState(false);

  if (!session) return <InvoiceEmpty />;
  const inv = session.invoice;
  const elapsedMin = Math.max(0, Math.round((now - session.started_at.getTime()) / 60000));
  const isTerminal = session.status === 'paid' || session.status === 'closed' || session.status === 'voided';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Invoice header card */}
      <div className="px-6 pt-5 pb-3">
        <CCard className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-bold text-stone-900 leading-none">
                  {t('table')} {session.table_number}
                </span>
                <span className="text-sm text-stone-500 font-medium">
                  • {lang === 'vi' ? session.area_name_vi : session.area_name_en}
                </span>
                <CSessionStatusPill status={session.status} t={t} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-stone-500">
                <span>
                  {t('guests', session.guest_count)} · {t('invoice_opened_at')} {csFmtClock(session.started_at)}
                </span>
                <span>
                  {t('invoice_duration')}: {elapsedMin} {lang === 'vi' ? 'phút' : 'min'}
                </span>
                <span className="font-mono text-stone-700 font-semibold">
                  {t('invoice_number')}: {inv.number}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <CButton
                variant="danger_outline"
                size="sm"
                onClick={() => setVoidOpen(true)}
                disabled={isTerminal || session.payment?.status === 'pending'}
              >
                <CIcon name="XCircle" className="w-4 h-4" />
                {t('void_session')}
              </CButton>
            </div>
          </div>
        </CCard>
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Line items section */}
        <div className="mt-2">
          <h3 className="text-base font-bold text-stone-900 mb-2.5">{t('order_details')}</h3>
          <div className="space-y-3">
            {inv.orders.map((order) => (
              <CCard key={order.id} className="overflow-hidden">
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <div className="text-sm font-semibold text-stone-700">
                    {t('order_placed_at')} {csFmtClock(order.submitted_at)}
                  </div>
                  <div className="text-xs text-stone-400 font-mono">{order.id}</div>
                </div>
                <div className="divide-y divide-stone-100">
                  {order.items.map((it) => (
                    <InvoiceLineRow key={it.id} item={it} lang={lang} t={t} />
                  ))}
                </div>
              </CCard>
            ))}
          </div>
        </div>

        {/* Calculation summary */}
        <div className="mt-5">
          <CCard className="p-5">
            <div className="space-y-2.5 text-[15px]">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">{t('subtotal')}</span>
                <span className="font-semibold tabular-nums text-stone-900">{csFmtVND(inv.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">{t('vat')}</span>
                <span className="font-semibold tabular-nums text-stone-900">{csFmtVND(inv.vat_amount)}</span>
              </div>

              {/* Discount section */}
              <div className="pt-1">
                {!inv.discount ? (
                  <button
                    onClick={() => setDiscountOpen(true)}
                    disabled={isTerminal}
                    className="text-amber-700 hover:text-amber-800 font-semibold text-sm hover:underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <CIcon name="Percent" className="w-3.5 h-3.5" />
                    {t('apply_discount')}
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600 inline-flex items-center gap-2">
                        <CIcon name="Percent" className="w-3.5 h-3.5 text-amber-600" />
                        {t('discount')}
                      </span>
                      <span className="font-semibold tabular-nums text-amber-700">
                        −{csFmtVND(inv.discount.amount)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between pl-5">
                      <span className="text-xs text-stone-500 italic">
                        {reasonLabel(inv.discount.reason, t)} ·{' '}
                        <span className="text-stone-400">{t('by')} {inv.discount.applied_by}</span>
                      </span>
                      <button
                        onClick={onRemoveDiscount}
                        disabled={isTerminal}
                        className="text-xs text-stone-400 hover:text-red-600 font-semibold uppercase tracking-wider disabled:opacity-50"
                      >
                        {t('remove_discount')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Discount history (expandable) */}
              {(inv.discount_history?.length ?? 0) > 0 ? (
                <div className="pt-2">
                  <button
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="w-full text-left text-[11px] text-stone-500 hover:text-stone-700 font-semibold uppercase tracking-wider inline-flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CIcon name="Clock" className="w-3 h-3" />
                      {t('discount_history')} ({inv.discount_history.length})
                    </span>
                    <CIcon
                      name="ChevronDown"
                      className={'w-3 h-3 transition-transform ' + (historyOpen ? 'rotate-180' : '')}
                    />
                  </button>
                  {historyOpen ? (
                    <ol className="mt-2 space-y-1.5 pl-4 border-l-2 border-stone-100">
                      {inv.discount_history.map((h, i) => (
                        <li key={i} className="text-[12px] text-stone-600 leading-snug">
                          <span className="font-mono text-stone-400 tabular-nums">{csFmtClock(h.applied_at)}</span>{' '}
                          <span className={h.action === 'removed' ? 'text-stone-500' : 'text-stone-800 font-semibold'}>
                            {h.action === 'applied' ? t('discount_action_applied') : t('discount_action_removed')}{' '}
                            <span className="tabular-nums">{csFmtVND(h.amount)}</span>
                          </span>
                          <span className="text-stone-400"> · {reasonLabel(h.reason, t)} · {t('by')} {h.applied_by}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}

              <div className="h-px bg-stone-200 my-3" />

              {/* Grand total */}
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-stone-900">{t('total')}</span>
                <span className="text-3xl font-bold tabular-nums text-amber-600 leading-none">
                  {csFmtVND(inv.total)}
                </span>
              </div>
            </div>
          </CCard>
        </div>
      </div>

      {/* Discount dialog */}
      <DiscountDialog
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        t={t}
        onApply={(amount, reason) => {
          onApplyDiscount(amount, reason);
          setDiscountOpen(false);
        }}
      />

      {/* Void session dialog */}
      <VoidSessionDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        session={session}
        t={t}
        onConfirm={() => {
          onVoidSession(session.id);
          setVoidOpen(false);
        }}
      />
    </div>
  );
}

function InvoiceEmpty() {
  return (
    <div className="h-full flex items-center justify-center p-10 text-center">
      <div className="max-w-xs">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-stone-100 inline-flex items-center justify-center text-stone-400">
          <CIcon name="Receipt" className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm text-stone-500">
          {/* Same hint as payment panel */}
        </p>
      </div>
    </div>
  );
}

function reasonLabel(reason, t) {
  const map = {
    promo: t('discount_reason_promo'),
    regular: t('discount_reason_regular'),
    complaint: t('discount_reason_complaint'),
  };
  return map[reason] || reason;
}

// ---------- Invoice line row with snapshot tooltip ----------
function InvoiceLineRow({ item, lang, t }) {
  const name = lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en;
  const opts = lang === 'vi' ? item.options_text_vi : item.options_text_en;
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-stone-900 leading-tight">{name}</span>
          <CTooltip content={t('snapshot_tooltip')}>
            <span className="text-stone-400 hover:text-stone-600 cursor-help">
              <CIcon name="Eye" className="w-3.5 h-3.5" />
            </span>
          </CTooltip>
        </div>
        {opts ? <div className="text-[13px] text-stone-500 mt-0.5">{opts}</div> : null}
        {item.notes ? <div className="text-[12px] text-amber-700 italic mt-0.5">"{item.notes}"</div> : null}
        <div className="mt-1 text-[12px] text-stone-500 font-mono tabular-nums">
          {item.qty} × {csFmtVND(item.unit_price_snapshot)}
        </div>
      </div>
      <div className="shrink-0 text-[15px] font-bold tabular-nums text-stone-900">
        {csFmtVND(item.line_total)}
      </div>
    </div>
  );
}

// ---------- Discount Dialog ----------
function DiscountDialog({ open, onClose, t, onApply }) {
  const [amount, setAmount] = _civState('');
  const [reason, setReason] = _civState('promo');

  _civEffect(() => {
    if (open) {
      setAmount('');
      setReason('promo');
    }
  }, [open]);

  const amt = parseInt(amount.replace(/\D/g, ''), 10);
  const valid = amt > 0 && amt <= 50000;

  return (
    <CDialog open={open} onClose={onClose} size="sm">
      <CDialogHeader title={t('discount_dialog_title')} onClose={onClose} />
      <div className="p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('discount_amount')}
          </label>
          <CInput
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="0"
            trailing={<span className="text-sm font-semibold text-stone-600">đ</span>}
            autoFocus
          />
          <p className="text-xs text-stone-500 mt-1.5">{t('discount_max_hint')}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('discount_reason')}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {['promo', 'regular', 'complaint'].map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={
                  'px-2 py-2 rounded-xl border-2 text-sm font-semibold transition ' +
                  (reason === r
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300')
                }
              >
                {reasonLabel(r, t)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
        <CButton variant="outline" onClick={onClose}>{t('cancel')}</CButton>
        <CButton variant="amber" disabled={!valid} onClick={() => onApply(amt, reason)}>
          {t('discount_apply')}
        </CButton>
      </div>
    </CDialog>
  );
}

// ---------- Void Session Dialog ----------
function VoidSessionDialog({ open, onClose, session, t, onConfirm }) {
  const [typed, setTyped] = _civState('');
  _civEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const valid = session && typed.trim() === String(session.table_number);

  return (
    <CDialog open={open} onClose={onClose} size="md">
      <CDialogHeader title={t('void_dialog_title')} onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
          <span className="text-red-600 shrink-0 mt-0.5">
            <CIcon name="AlertCircle" className="w-5 h-5" />
          </span>
          <p className="text-sm text-red-900 leading-relaxed">{t('void_dialog_desc')}</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('void_input_label')}
          </label>
          <CInput
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={String(session?.table_number ?? '')}
            autoFocus
          />
        </div>
      </div>
      <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
        <CButton variant="outline" onClick={onClose}>{t('cancel')}</CButton>
        <CButton variant="red" disabled={!valid} onClick={onConfirm}>
          {t('void_confirm')}
        </CButton>
      </div>
    </CDialog>
  );
}

Object.assign(window, {
  InvoiceDetail,
  reasonLabel,
});
