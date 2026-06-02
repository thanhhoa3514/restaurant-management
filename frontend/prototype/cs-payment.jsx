// Cashier — Column 3: Payment Panel.
// Whether the panel shows "select method" vs "QR pending" vs "paid" derives
// from session.payment.status, NOT from panel-local state. That way, when the
// cashier switches to another session and back, the e-wallet pending state is
// preserved — the background webhook timer is owned by App, not by this panel.

const { useState: _cpState, useEffect: _cpEffect, useMemo: _cpMemo } = React;

function PaymentPanel({
  session,
  panelState,
  setPanelState,
  lang,
  t,
  now,
  onConfirmCashPayment,
  onConfirmCardPayment,
  onInitiateEwallet,
  onCancelEwallet,
  onPrintReceipt,
  onCloseSession,
}) {
  // --- Empty state: no session selected ---
  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 inline-flex items-center justify-center text-stone-400">
          <CIcon name="Receipt" className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-base font-semibold text-stone-700">{t('select_session_empty')}</p>
        <p className="mt-1 text-sm text-stone-500 leading-relaxed">{t('select_session_hint')}</p>
      </div>
    );
  }

  // --- Derived: which sub-screen ---
  const isClosed = session.status === 'closed' || session.status === 'voided';
  const payment = session.payment;
  // session.status === 'paid' OR payment status paid → terminal positive
  const isPaid =
    session.status === 'paid' ||
    (payment?.status === 'paid' && session.status !== 'closed');
  const isFailed = payment?.status === 'failed';
  const isPending = payment?.status === 'pending';

  // Local state per session — initialized once via App-owned map.
  const mode = panelState?.mode || 'select';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">{t('payment')}</h2>
          <CSessionStatusPill status={session.status} t={t} />
        </div>
        <div className="mt-1 text-xs text-stone-500">
          {t('table')} {session.table_number} · {lang === 'vi' ? session.area_name_vi : session.area_name_en}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Terminal positive */}
        {isPaid ? (
          <PaidView session={session} t={t} lang={lang} onPrintReceipt={onPrintReceipt} onCloseSession={onCloseSession} />
        ) : isPending ? (
          <EwalletPendingView session={session} t={t} lang={lang} now={now} onCancel={onCancelEwallet} />
        ) : isFailed ? (
          <FailedView session={session} t={t} lang={lang} onRetry={() => setPanelState({ mode: 'ewallet_provider' })} onChangeMethod={() => setPanelState({ mode: 'select' })} />
        ) : isClosed ? (
          <div className="text-center py-10 text-sm text-stone-500">
            {t('status_' + session.status)}
          </div>
        ) : mode === 'select' ? (
          <MethodSelect
            session={session}
            t={t}
            onSelect={(m) =>
              setPanelState({
                mode: m === 'cash' ? 'cash_entry' : m === 'card' ? 'card_entry' : 'ewallet_provider',
              })
            }
          />
        ) : mode === 'cash_entry' ? (
          <CashEntry
            session={session}
            t={t}
            initial={panelState?.cashTendered ?? session.invoice.total}
            onChange={(v) => setPanelState({ ...panelState, cashTendered: v })}
            onBack={() => setPanelState({ mode: 'select' })}
            onConfirm={(tendered) => onConfirmCashPayment(tendered)}
          />
        ) : mode === 'card_entry' ? (
          <CardEntry
            session={session}
            t={t}
            initial={panelState?.cardForm || { txn: '', last4: '', bank: '' }}
            onChange={(form) => setPanelState({ ...panelState, cardForm: form })}
            onBack={() => setPanelState({ mode: 'select' })}
            onConfirm={(form) => onConfirmCardPayment(form)}
          />
        ) : mode === 'ewallet_provider' ? (
          <EwalletProviderPick
            session={session}
            t={t}
            onBack={() => setPanelState({ mode: 'select' })}
            onPick={(provider) => onInitiateEwallet(provider)}
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------- Method select ----------
function MethodSelect({ session, t, onSelect }) {
  return (
    <div className="space-y-4">
      <TotalDisplay amount={session.invoice.total} t={t} />
      <div>
        <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-2">
          {t('select_method')}
        </div>
        <div className="space-y-2">
          <MethodCard
            icon="Banknote"
            title={t('method_cash')}
            hint={t('method_cash_hint')}
            onClick={() => onSelect('cash')}
          />
          <MethodCard
            icon="CreditCard"
            title={t('method_card')}
            hint={t('method_card_hint')}
            onClick={() => onSelect('card')}
          />
          <MethodCard
            icon="Smartphone"
            title={t('method_ewallet')}
            hint={t('method_ewallet_hint')}
            onClick={() => onSelect('ewallet')}
          />
        </div>
      </div>
    </div>
  );
}

function MethodCard({ icon, title, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border-2 border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 transition flex items-center gap-3 active:scale-[0.99]"
    >
      <span className="w-12 h-12 rounded-xl bg-stone-100 inline-flex items-center justify-center text-stone-700 shrink-0">
        <CIcon name={icon} className="w-6 h-6" strokeWidth={1.8} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-stone-900">{title}</div>
        <div className="text-[12px] text-stone-500 mt-0.5">{hint}</div>
      </div>
      <CIcon name="ChevronRight" className="w-4 h-4 text-stone-400 shrink-0" />
    </button>
  );
}

function TotalDisplay({ amount, t }) {
  return (
    <div className="rounded-2xl bg-stone-50 border border-stone-200 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
        {t('cash_total')}
      </div>
      <div className="mt-0.5 text-3xl font-bold tabular-nums text-amber-600 leading-tight">
        {csFmtVND(amount)}
      </div>
    </div>
  );
}

function BackButton({ onClick, t }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800 -ml-1 mb-3"
    >
      <CIcon name="ArrowLeft" className="w-4 h-4" />
      {t('back')}
    </button>
  );
}

// ---------- Cash ----------
function CashEntry({ session, t, initial, onChange, onBack, onConfirm }) {
  const total = session.invoice.total;
  const [tendered, setTendered] = _cpState(initial);
  const [submitting, setSubmitting] = _cpState(false);
  _cpEffect(() => { setTendered(initial); }, [session.id]);

  const change = tendered - total;
  const short = change < 0;

  // Round-up suggestions based on total
  const suggestions = _cpMemo(() => {
    const out = new Set();
    const r = (n) => Math.ceil(total / n) * n;
    out.add(r(50000));
    out.add(r(100000));
    out.add(r(200000));
    out.add(r(500000));
    return Array.from(out).filter((v) => v >= total).slice(0, 4);
  }, [total]);

  const update = (v) => {
    setTendered(v);
    onChange(v);
  };

  return (
    <div>
      <BackButton onClick={onBack} t={t} />
      <TotalDisplay amount={total} t={t} />

      <div className="mt-4">
        <label className="text-sm font-semibold text-stone-700 block mb-1.5">
          {t('cash_tendered')}
        </label>
        <CInput
          type="text"
          inputMode="numeric"
          value={tendered.toString()}
          onChange={(e) => {
            const v = parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0;
            update(v);
          }}
          trailing={<span className="text-sm font-semibold text-stone-600">đ</span>}
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => update(s)}
              className={
                'py-2 rounded-xl border text-sm font-semibold tabular-nums transition ' +
                (tendered === s
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300')
              }
            >
              {csFmtVND(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-600">
          {short ? t('cash_short') : t('cash_change')}
        </span>
        <span
          className={
            'text-xl font-bold tabular-nums ' +
            (short ? 'text-red-600' : change > 0 ? 'text-emerald-600' : 'text-stone-700')
          }
        >
          {short ? csFmtVND(-change) : csFmtVND(change)}
        </span>
      </div>

      <div className="mt-5">
        <CButton
          variant="amber"
          size="lg"
          className="w-full"
          loading={submitting}
          disabled={short || submitting}
          onClick={async () => {
            setSubmitting(true);
            setTimeout(() => {
              onConfirm(tendered);
              setSubmitting(false);
            }, 600);
          }}
        >
          {!submitting ? <CIcon name="CheckCircle2" className="w-5 h-5" /> : null}
          {t('cash_confirm')}
        </CButton>
      </div>
    </div>
  );
}

// ---------- Card ----------
function CardEntry({ session, t, initial, onChange, onBack, onConfirm }) {
  const [form, setForm] = _cpState(initial);
  const [submitting, setSubmitting] = _cpState(false);
  _cpEffect(() => { setForm(initial); }, [session.id]);

  const setField = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    onChange(next);
  };

  const valid = form.txn.trim().length > 0 && /^\d{4}$/.test(form.last4.trim());

  return (
    <div>
      <BackButton onClick={onBack} t={t} />
      <TotalDisplay amount={session.invoice.total} t={t} />

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('card_txn')} *
          </label>
          <CInput
            value={form.txn}
            onChange={(e) => setField('txn', e.target.value)}
            placeholder="e.g. POS-2024-002389"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('card_last4')} *
          </label>
          <CInput
            value={form.last4}
            onChange={(e) => setField('last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            inputMode="numeric"
            maxLength={4}
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-1.5">
            {t('card_bank')}
          </label>
          <CInput
            value={form.bank}
            onChange={(e) => setField('bank', e.target.value)}
            placeholder="Vietcombank, Techcombank, …"
          />
        </div>
        <p className="text-xs text-stone-500 leading-relaxed flex items-start gap-1.5">
          <CIcon name="Info" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-stone-400" />
          <span>{t('card_hint')}</span>
        </p>
      </div>

      <div className="mt-5">
        <CButton
          variant="amber"
          size="lg"
          className="w-full"
          loading={submitting}
          disabled={!valid || submitting}
          onClick={async () => {
            setSubmitting(true);
            setTimeout(() => {
              onConfirm(form);
              setSubmitting(false);
            }, 800);
          }}
        >
          {!submitting ? <CIcon name="CheckCircle2" className="w-5 h-5" /> : null}
          {t('card_confirm')}
        </CButton>
      </div>
    </div>
  );
}

// ---------- E-wallet provider picker ----------
function EwalletProviderPick({ session, t, onBack, onPick }) {
  return (
    <div>
      <BackButton onClick={onBack} t={t} />
      <TotalDisplay amount={session.invoice.total} t={t} />
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-2">
          {t('ewallet_provider_pick')}
        </div>
        <div className="space-y-2">
          {CS_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="w-full text-left p-4 rounded-2xl border-2 border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 transition flex items-center gap-3 active:scale-[0.99]"
            >
              <span className={`w-12 h-12 rounded-xl inline-flex items-center justify-center border-2 ${p.accent}`}>
                <CIcon name="Smartphone" className="w-6 h-6" strokeWidth={1.8} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-stone-900">{p.name}</div>
                <div className="text-[12px] text-stone-500 mt-0.5">E-wallet</div>
              </div>
              <CIcon name="ChevronRight" className="w-4 h-4 text-stone-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- E-wallet QR pending ----------
function EwalletPendingView({ session, t, lang, now, onCancel }) {
  const p = session.payment;
  const provider = CS_PROVIDERS.find((x) => x.id === p.sub_method);
  const sinceSec = Math.max(0, Math.floor((now - p.initiated_at.getTime()) / 1000));
  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 ${provider?.accent} p-4 text-center`}>
        <div className="text-xs uppercase tracking-wider font-bold opacity-80">
          {provider?.name}
        </div>
        <div className="text-sm font-semibold mt-1">{t('ewallet_qr_title')}</div>
        <div className="mt-3 inline-block bg-white rounded-xl p-3 border-2 border-stone-200 shadow-sm">
          <FakeQRCode size={180} />
        </div>
        <div className="mt-3">
          <div className="text-3xl font-bold tabular-nums text-stone-900 leading-tight">
            {csFmtVND(session.invoice.total)}
          </div>
          <div className="mt-1 text-[11px] font-mono text-stone-500">{p.transaction_id}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
        <CIcon name="Loader2" className="w-5 h-5 text-amber-700 animate-spin shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-900 animate-pulse-subtle">{t('ewallet_awaiting')}</div>
          <div className="text-[11px] font-mono tabular-nums text-amber-700 mt-0.5">
            {csFmtHMS(sinceSec)}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-500 leading-relaxed">{t('ewallet_pending_hint')}</p>

      <CButton variant="outline" className="w-full" onClick={() => onCancel(session.id)}>
        <CIcon name="XCircle" className="w-4 h-4" />
        {t('ewallet_cancel')}
      </CButton>
    </div>
  );
}

// ---------- Paid (terminal) ----------
function PaidView({ session, t, lang, onPrintReceipt, onCloseSession }) {
  const p = session.payment;
  const methodLabel = {
    cash: t('method_cash'),
    card: t('method_card'),
    ewallet: t('method_ewallet') + (p.sub_method ? ` · ${csProviderName(p.sub_method)}` : ''),
  }[p.method];
  return (
    <div className="space-y-4">
      <div className="text-center pt-2 pb-1">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 inline-flex items-center justify-center text-emerald-600 animate-check-in">
          <CIcon name="CheckCircle2" className="w-9 h-9" strokeWidth={2} />
        </div>
        <div className="mt-3 text-base font-bold text-stone-900">{t('paid_title')}</div>
      </div>

      <CCard className="p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-stone-500">{t('paid_amount')}</span>
          <span className="font-bold tabular-nums text-stone-900 text-base">
            {csFmtVND(session.invoice.total)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">{t('paid_method')}</span>
          <span className="font-semibold text-stone-900">{methodLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">{t('paid_txn')}</span>
          <span className="font-mono text-[12px] text-stone-700">{p.transaction_id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">{t('paid_time')}</span>
          <span className="font-mono tabular-nums text-[12px] text-stone-700">
            {p.completed_at ? csFmtDateTime(p.completed_at) : '—'}
          </span>
        </div>
        {p.method === 'cash' && p.amount_tendered ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">{t('cash_tendered')}</span>
              <span className="font-semibold tabular-nums text-stone-900">{csFmtVND(p.amount_tendered)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">{t('cash_change')}</span>
              <span className="font-semibold tabular-nums text-emerald-600">{csFmtVND(p.change)}</span>
            </div>
          </>
        ) : null}
        {p.method === 'card' && p.last4 ? (
          <div className="flex items-center justify-between">
            <span className="text-stone-500">{t('card_last4')}</span>
            <span className="font-mono text-[13px] text-stone-700">•••• {p.last4}</span>
          </div>
        ) : null}
      </CCard>

      <div className="space-y-2 pt-1">
        <CButton variant="amber" size="lg" className="w-full" onClick={onPrintReceipt}>
          <CIcon name="Printer" className="w-4 h-4" />
          {t('print_receipt')}
        </CButton>
        <CButton variant="outline" size="md" className="w-full" onClick={() => onCloseSession(session.id)}>
          {t('close_session')}
        </CButton>
        <CTooltip content={t('send_email_sms_soon')}>
          <CButton variant="ghost" size="md" className="w-full" disabled>
            <CIcon name="Send" className="w-4 h-4" />
            {t('send_email_sms')}
          </CButton>
        </CTooltip>
      </div>
    </div>
  );
}

// ---------- Failed ----------
function FailedView({ session, t, lang, onRetry, onChangeMethod }) {
  return (
    <div className="space-y-4">
      <div className="text-center pt-2 pb-1">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-50 border border-red-200 inline-flex items-center justify-center text-red-600">
          <CIcon name="XCircle" className="w-9 h-9" strokeWidth={2} />
        </div>
        <div className="mt-3 text-base font-bold text-stone-900">{t('failed_title')}</div>
        <p className="mt-1 text-sm text-stone-500 leading-relaxed max-w-xs mx-auto">
          {session.payment?.failure_reason || t('failed_reason_default')}
        </p>
      </div>
      <div className="space-y-2">
        <CButton variant="amber" size="lg" className="w-full" onClick={onRetry}>
          <CIcon name="RotateCcw" className="w-4 h-4" />
          {t('retry')}
        </CButton>
        <CButton variant="outline" size="md" className="w-full" onClick={onChangeMethod}>
          {t('change_method')}
        </CButton>
      </div>
    </div>
  );
}

// ---------- Fake QR (decorative; not a real scannable code) ----------
function FakeQRCode({ size = 180, seed = 'demo' }) {
  // 25×25 grid; deterministic-ish pattern.
  const N = 25;
  const cells = _cpMemo(() => {
    const arr = [];
    // Position squares (top-left, top-right, bottom-left)
    const isFinderModule = (r, c) => {
      const inBox = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
      if (inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0)) {
        // Outer ring black, inner white ring, inner 3×3 black
        const rel = (r0, c0) => ({ rr: r - r0, cc: c - c0 });
        let r0, c0;
        if (inBox(0, 0)) { r0 = 0; c0 = 0; }
        else if (inBox(0, N - 7)) { r0 = 0; c0 = N - 7; }
        else { r0 = N - 7; c0 = 0; }
        const { rr, cc } = rel(r0, c0);
        if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true;
        if (rr === 1 || rr === 5 || cc === 1 || cc === 5) return false;
        return true;
      }
      return null;
    };
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rng = () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return ((h >>> 16) & 0xffff) / 0xffff;
    };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const f = isFinderModule(r, c);
        if (f !== null) {
          arr.push({ r, c, fill: f });
          continue;
        }
        arr.push({ r, c, fill: rng() < 0.46 });
      }
    }
    return arr;
  }, [seed]);

  const px = size / N;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <rect x="0" y="0" width={size} height={size} fill="white" />
      {cells.map((c, i) =>
        c.fill ? (
          <rect
            key={i}
            x={c.c * px}
            y={c.r * px}
            width={px}
            height={px}
            fill="#111111"
          />
        ) : null
      )}
    </svg>
  );
}

Object.assign(window, {
  PaymentPanel,
  FakeQRCode,
});
