// Cashier — App shell: header, 3-column layout, session list, payment timers, demo controls, receipt dialog.

const { useState: _caState, useEffect: _caEffect, useMemo: _caMemo, useCallback: _caCb, useRef: _caRef } = React;

const REASON_FOR_FAIL_KEY = 'failed_reason_default';

function CashierApp() {
  const [lang, setLang] = _caState('vi');
  const [sessions, setSessions] = _caState(() => csBuildInitialSessions(new Date()));
  const [selectedSessionId, setSelectedSessionId] = _caState(null);
  const [search, setSearch] = _caState('');
  const [sortMode, setSortMode] = _caState('newest'); // 'newest' | 'bill'
  const [now, setNow] = _caState(() => new Date());
  const [closedToday, setClosedToday] = _caState(23);
  const [demoOpen, setDemoOpen] = _caState(true);
  const [autoOn, setAutoOn] = _caState(false);
  const [receiptForId, setReceiptForId] = _caState(null);
  const [panelStates, setPanelStates] = _caState({}); // { [sessionId]: { mode, cashTendered, cardForm } }

  // Pending e-wallet timers (sessionId → setTimeout handle)
  const timersRef = _caRef({});

  const { toast } = useCToast();

  const t = _caCb(
    (key, ...args) => {
      const v = CS_DICT[lang][key];
      if (typeof v === 'function') return v(...args);
      return v ?? key;
    },
    [lang]
  );

  // Clock tick
  _caEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-collapse demo panel after 10s
  _caEffect(() => {
    const id = setTimeout(() => setDemoOpen(false), 10000);
    return () => clearTimeout(id);
  }, []);

  // Auto-events loop (off by default — only fires when toggled on)
  _caEffect(() => {
    if (!autoOn) return;
    let timerId;
    const schedule = () => {
      const delay = 30000 + Math.random() * 30000;
      timerId = setTimeout(() => {
        injectBillRequest();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn]);

  // ---------- Panel state helpers ----------
  const setPanelState = (sessionId, next) => {
    setPanelStates((prev) => ({ ...prev, [sessionId]: next }));
  };
  const getPanelState = (sessionId) => panelStates[sessionId];

  // ---------- Update one session ----------
  const updateSession = _caCb((id, fn) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  // ---------- Recalculate invoice total after discount change ----------
  function recalc(invoice, discount) {
    const items = invoice.orders.flatMap((o) => o.items);
    const subtotal = items.reduce((s, it) => s + it.line_total, 0);
    const vat_amount = Math.round(subtotal * 0.1);
    const disc = discount ? discount.amount : 0;
    return {
      ...invoice,
      subtotal,
      vat_amount,
      discount: discount,
      total: Math.max(0, subtotal + vat_amount - disc),
    };
  }

  // ---------- Mutations ----------
  function applyDiscount(sessionId, amount, reason) {
    updateSession(sessionId, (sess) => {
      const entry = {
        amount,
        reason,
        applied_by: t('cashier_name'),
        applied_at: new Date(),
        action: 'applied',
      };
      const invoice = recalc(sess.invoice, { amount, reason, applied_by: entry.applied_by, applied_at: entry.applied_at });
      invoice.discount_history = [...(sess.invoice.discount_history || []), entry];
      return { ...sess, invoice };
    });
    toast(t('toast_discount_applied'), { tone: 'amber', icon: 'Percent' });
  }

  function removeDiscount(sessionId) {
    updateSession(sessionId, (sess) => {
      if (!sess.invoice.discount) return sess;
      const removedEntry = {
        amount: sess.invoice.discount.amount,
        reason: sess.invoice.discount.reason,
        applied_by: t('cashier_name'),
        applied_at: new Date(),
        action: 'removed',
      };
      const invoice = recalc(sess.invoice, null);
      invoice.discount_history = [...(sess.invoice.discount_history || []), removedEntry];
      return { ...sess, invoice };
    });
    toast(t('toast_discount_removed'), { tone: 'dark' });
  }

  function voidSession(sessionId) {
    let tableNum = 0;
    updateSession(sessionId, (sess) => {
      tableNum = sess.table_number;
      return { ...sess, status: 'voided' };
    });
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setClosedToday((c) => c + 1);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    }, 600);
    if (tableNum) toast(t('toast_session_voided', tableNum), { tone: 'red' });
  }

  function confirmCashPayment(sessionId, tendered) {
    let tableNum = 0;
    updateSession(sessionId, (sess) => {
      tableNum = sess.table_number;
      const total = sess.invoice.total;
      const change = Math.max(0, tendered - total);
      return {
        ...sess,
        status: 'paid',
        payment: {
          method: 'cash',
          sub_method: null,
          status: 'paid',
          transaction_id: csMakeTxnId(new Date()),
          initiated_at: new Date(),
          completed_at: new Date(),
          amount_tendered: tendered,
          change,
          last4: null,
          bank: null,
        },
      };
    });
    if (tableNum) toast(t('toast_cash_received'), { tone: 'emerald', icon: 'CheckCircle2' });
  }

  function confirmCardPayment(sessionId, form) {
    let tableNum = 0;
    updateSession(sessionId, (sess) => {
      tableNum = sess.table_number;
      return {
        ...sess,
        status: 'paid',
        payment: {
          method: 'card',
          sub_method: null,
          status: 'paid',
          transaction_id: form.txn || csMakeTxnId(new Date()),
          initiated_at: new Date(),
          completed_at: new Date(),
          amount_tendered: null,
          change: null,
          last4: form.last4,
          bank: form.bank || null,
        },
      };
    });
    if (tableNum) toast(t('toast_card_received'), { tone: 'emerald', icon: 'CheckCircle2' });
  }

  function initiateEwallet(sessionId, provider) {
    updateSession(sessionId, (sess) => {
      return {
        ...sess,
        status: 'in_payment',
        payment: {
          method: 'ewallet',
          sub_method: provider,
          status: 'pending',
          transaction_id: csMakeTxnId(new Date()),
          initiated_at: new Date(),
          completed_at: null,
          amount_tendered: null,
          change: null,
          last4: null,
          bank: null,
        },
      };
    });
    // Schedule simulated webhook in 6s
    schedulePendingTimer(sessionId, 6000);
  }

  function schedulePendingTimer(sessionId, delay) {
    if (timersRef.current[sessionId]) clearTimeout(timersRef.current[sessionId]);
    timersRef.current[sessionId] = setTimeout(() => {
      completeEwallet(sessionId, true);
      delete timersRef.current[sessionId];
    }, delay);
  }

  // Real system: webhook from payment provider triggers status update via outbox event
  //              → WebSocket → this UI re-renders. Handler must be idempotent (at-least-once delivery).
  function completeEwallet(sessionId, success, reasonKey) {
    let tableNum = 0;
    updateSession(sessionId, (sess) => {
      // Idempotency: if not pending anymore, ignore.
      if (!sess.payment || sess.payment.status !== 'pending') return sess;
      tableNum = sess.table_number;
      if (success) {
        return {
          ...sess,
          status: 'paid',
          payment: {
            ...sess.payment,
            status: 'paid',
            completed_at: new Date(),
          },
        };
      }
      return {
        ...sess,
        status: 'bill_requested', // back to bill_requested so cashier can retry
        payment: {
          ...sess.payment,
          status: 'failed',
          failure_reason: reasonKey ? t(reasonKey) : t('failed_reason_default'),
          completed_at: new Date(),
        },
      };
    });
    if (tableNum) {
      if (success) {
        toast(t('toast_ewallet_paid', tableNum), {
          tone: 'emerald',
          icon: 'CheckCircle2',
          onClick: () => {
            // Jump to that session
            const target = sessions.find((s) => s.table_number === tableNum);
            if (target) setSelectedSessionId(target.id);
          },
        });
      } else {
        toast(t('toast_ewallet_failed'), { tone: 'red', icon: 'XCircle' });
      }
    }
  }

  function cancelEwallet(sessionId) {
    if (timersRef.current[sessionId]) {
      clearTimeout(timersRef.current[sessionId]);
      delete timersRef.current[sessionId];
    }
    updateSession(sessionId, (sess) => {
      if (!sess.payment || sess.payment.status !== 'pending') return sess;
      return {
        ...sess,
        status: 'bill_requested',
        payment: null,
      };
    });
    // Reset panel to method-select
    setPanelState(sessionId, { mode: 'select' });
  }

  function closeSession(sessionId) {
    let tableNum = 0;
    updateSession(sessionId, (sess) => {
      tableNum = sess.table_number;
      return { ...sess, status: 'closed' };
    });
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setClosedToday((c) => c + 1);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
    }, 400);
    if (tableNum) toast(t('toast_session_closed', tableNum), { tone: 'dark' });
  }

  function injectBillRequest() {
    let pickedNum = 0;
    setSessions((prev) => {
      const candidates = prev.filter((s) => s.status === 'dining');
      if (candidates.length === 0) return prev;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pickedNum = pick.table_number;
      return prev.map((s) =>
        s.id === pick.id ? { ...s, status: 'bill_requested', bill_requested_at: new Date() } : s
      );
    });
    if (pickedNum) {
      toast(t('toast_bill_requested', pickedNum), { tone: 'red', icon: 'AlertCircle' });
    }
  }

  function forceWebhook(success) {
    // Find any session with payment.status === 'pending'
    const pendingSess = sessions.find((s) => s.payment?.status === 'pending');
    if (!pendingSess) return;
    if (timersRef.current[pendingSess.id]) {
      clearTimeout(timersRef.current[pendingSess.id]);
      delete timersRef.current[pendingSess.id];
    }
    completeEwallet(pendingSess.id, success, success ? null : REASON_FOR_FAIL_KEY);
  }

  function resetAll() {
    // Clear all timers
    for (const id of Object.keys(timersRef.current)) {
      clearTimeout(timersRef.current[id]);
    }
    timersRef.current = {};
    setSessions(csBuildInitialSessions(new Date()));
    setSelectedSessionId(null);
    setPanelStates({});
    setClosedToday(23);
    toast(t('toast_reset'), { tone: 'dark' });
  }

  // Cleanup timers on unmount
  _caEffect(() => () => {
    for (const id of Object.keys(timersRef.current)) clearTimeout(timersRef.current[id]);
  }, []);

  // ---------- Derived ----------
  const filteredSorted = _caMemo(() => {
    const q = search.trim().toLowerCase();
    let list = sessions.filter((s) => {
      if (q && !String(s.table_number).includes(q) && !s.area_name_vi.toLowerCase().includes(q) && !s.area_name_en.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    if (sortMode === 'bill') {
      // Sessions with bill_requested first (oldest request first), then everything else by recency.
      list = list.slice().sort((a, b) => {
        const aHas = !!a.bill_requested_at && a.status === 'bill_requested';
        const bHas = !!b.bill_requested_at && b.status === 'bill_requested';
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) return a.bill_requested_at - b.bill_requested_at;
        return b.started_at - a.started_at;
      });
    } else {
      // newest: bill_requested first naturally (highlight), then dining/in_payment by recency
      list = list.slice().sort((a, b) => {
        const rank = (s) =>
          ({ bill_requested: 0, in_payment: 1, dining: 2, paid: 3, closed: 4, voided: 4 })[s.status] ?? 9;
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        return b.started_at - a.started_at;
      });
    }
    return list;
  }, [sessions, search, sortMode]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  const pendingCount = sessions.filter((s) => s.status !== 'closed' && s.status !== 'voided').length;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-stone-200 shadow-sm shrink-0 no-print">
        <div className="px-6 h-full flex items-center gap-5">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white inline-flex items-center justify-center">
              <CIcon name="Receipt" className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-stone-900">{t('cashier')}</div>
              <div className="text-[11px] text-stone-500 font-medium">{t('restaurant')}</div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="text-lg font-bold text-stone-900 tabular-nums tracking-tight font-mono">
              {csFmtClockSec(now)}
            </div>
            <div className="w-px h-5 bg-stone-200" />
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
              {t('shift')} · {t('cashier_name')}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CStatPill label={t('pending_label')} value={pendingCount} tone="amber" />
            <CStatPill label={t('closed_today')} value={closedToday} tone="emerald" />
            <div className="w-px h-7 bg-stone-200 mx-1" />
            <CLangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Column 1 */}
        <aside className="w-80 shrink-0 border-r border-stone-200 bg-white flex flex-col overflow-hidden">
          <SessionListColumn
            sessions={filteredSorted}
            allSessions={sessions}
            selectedId={selectedSessionId}
            onSelect={setSelectedSessionId}
            search={search}
            setSearch={setSearch}
            sortMode={sortMode}
            setSortMode={setSortMode}
            now={now}
            lang={lang}
            t={t}
          />
        </aside>

        {/* Column 2 */}
        <section className="flex-1 min-w-0 bg-stone-50 overflow-hidden flex flex-col">
          <InvoiceDetail
            session={selectedSession}
            now={now}
            lang={lang}
            t={t}
            onApplyDiscount={(amount, reason) => applyDiscount(selectedSession.id, amount, reason)}
            onRemoveDiscount={() => removeDiscount(selectedSession.id)}
            onVoidSession={voidSession}
          />
        </section>

        {/* Column 3 */}
        <aside className="w-96 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
          <PaymentPanel
            session={selectedSession}
            panelState={selectedSession ? getPanelState(selectedSession.id) : null}
            setPanelState={(next) => selectedSession && setPanelState(selectedSession.id, next)}
            lang={lang}
            t={t}
            now={now}
            onConfirmCashPayment={(tendered) => confirmCashPayment(selectedSession.id, tendered)}
            onConfirmCardPayment={(form) => confirmCardPayment(selectedSession.id, form)}
            onInitiateEwallet={(provider) => initiateEwallet(selectedSession.id, provider)}
            onCancelEwallet={cancelEwallet}
            onPrintReceipt={() => setReceiptForId(selectedSession.id)}
            onCloseSession={closeSession}
          />
        </aside>
      </div>

      {/* Receipt dialog */}
      <ReceiptDialog
        open={!!receiptForId}
        session={sessions.find((s) => s.id === receiptForId)}
        lang={lang}
        t={t}
        onClose={() => setReceiptForId(null)}
        onPrint={() => {
          window.print();
          toast(t('toast_printed'), { tone: 'dark', icon: 'Printer' });
        }}
      />

      {/* Demo controls */}
      <DemoControls
        open={demoOpen}
        setOpen={setDemoOpen}
        t={t}
        autoOn={autoOn}
        setAutoOn={setAutoOn}
        onInjectBill={injectBillRequest}
        onForceSuccess={() => forceWebhook(true)}
        onForceFail={() => forceWebhook(false)}
        onReset={resetAll}
        hasPending={sessions.some((s) => s.payment?.status === 'pending')}
      />
    </div>
  );
}

// ============================================================
// Column 1: Session list
// ============================================================
function SessionListColumn({ sessions, allSessions, selectedId, onSelect, search, setSearch, sortMode, setSortMode, now, lang, t }) {
  const hasBillRequest = allSessions.some((s) => s.status === 'bill_requested');
  return (
    <>
      <div className="p-3 border-b border-stone-100 space-y-2.5">
        <CInput
          leading={<CIcon name="Search" className="w-4 h-4" />}
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setSortMode('newest')}
            className={
              'flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition ' +
              (sortMode === 'newest'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200')
            }
          >
            {t('sort_newest')}
          </button>
          <button
            onClick={() => setSortMode('bill')}
            className={
              'flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition relative ' +
              (sortMode === 'bill'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200')
            }
          >
            {t('sort_bill')}
            {hasBillRequest ? (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            ) : null}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-10 text-sm text-stone-500">{t('no_sessions')}</div>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              selected={s.id === selectedId}
              onClick={() => onSelect(s.id)}
              now={now}
              lang={lang}
              t={t}
            />
          ))
        )}
      </div>
    </>
  );
}

function SessionCard({ session, selected, onClick, now, lang, t }) {
  const itemCount = session.invoice.orders.reduce((n, o) => n + o.items.reduce((m, it) => m + it.qty, 0), 0);
  const elapsedMin = Math.max(0, Math.round((now - session.started_at.getTime()) / 60000));
  const billAgoSec = session.bill_requested_at
    ? Math.max(0, Math.floor((now - session.bill_requested_at.getTime()) / 1000))
    : null;
  const accent = {
    bill_requested: 'border-l-red-500',
    in_payment: 'border-l-amber-500',
    paid: 'border-l-emerald-500',
    dining: 'border-l-stone-300',
    closed: 'border-l-stone-300',
    voided: 'border-l-stone-300',
  }[session.status];

  return (
    <button
      onClick={onClick}
      className={
        `w-full text-left rounded-xl border bg-white border-l-[5px] ${accent} transition shadow-sm hover:shadow-md ` +
        (selected
          ? 'border-stone-900 ring-2 ring-stone-900/15 shadow-md'
          : 'border-stone-200 hover:border-stone-300')
      }
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-bold text-stone-900 leading-tight">
              {t('table')} {session.table_number}
            </div>
            <div className="text-[12px] text-stone-500 mt-0.5 truncate">
              {lang === 'vi' ? session.area_name_vi : session.area_name_en} · {t('guests', session.guest_count)}
            </div>
          </div>
          <CIcon name="ChevronRight" className="w-4 h-4 text-stone-300 mt-1 shrink-0" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-stone-500 tabular-nums">
          <span className="font-mono">
            {csFmtClock(session.started_at)} · {elapsedMin}{lang === 'vi' ? 'p' : 'm'}
          </span>
          <span className="font-semibold tabular-nums text-stone-900">
            {t('items_count', itemCount)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <CSessionStatusPill status={session.status} t={t} />
          <span className="font-bold tabular-nums text-stone-900 text-[14px]">
            {csFmtVND(session.invoice.total)}
          </span>
        </div>
        {billAgoSec != null && session.status === 'bill_requested' ? (
          <div className="mt-1.5 text-[11px] font-mono tabular-nums text-red-600">
            {t('bill_requested_ago', csFmtHMS(billAgoSec))}
          </div>
        ) : null}
        {session.payment?.status === 'pending' ? (
          <div className="mt-1.5 text-[11px] font-mono text-amber-700 inline-flex items-center gap-1.5">
            <CIcon name="Loader2" className="w-3 h-3 animate-spin" />
            {csProviderName(session.payment.sub_method)} · pending
          </div>
        ) : null}
      </div>
    </button>
  );
}

// ============================================================
// Receipt Dialog (80mm thermal style; prints only this area)
// ============================================================
function ReceiptDialog({ open, session, lang, t, onClose, onPrint }) {
  if (!session) return null;
  const inv = session.invoice;
  const p = session.payment;
  const methodLabel = p
    ? p.method === 'cash'
      ? t('method_cash')
      : p.method === 'card'
      ? t('method_card') + (p.last4 ? ` (•••• ${p.last4})` : '')
      : `${t('method_ewallet')} · ${csProviderName(p.sub_method)}`
    : '—';

  return (
    <CDialog open={open} onClose={onClose} size="md">
      <CDialogHeader title={t('print_receipt')} subtitle={inv.number} onClose={onClose} />
      <div className="p-5 bg-stone-100">
        <div
          id="receipt-print-area"
          className="max-w-sm mx-auto bg-white border border-stone-200 rounded-md p-5 font-mono text-[12px] leading-relaxed text-stone-900 shadow-sm"
        >
          <div className="text-center">
            <div className="font-bold text-base">{t('restaurant')}</div>
            <div>{t('restaurant_address')}</div>
            <div>{t('restaurant_phone')}</div>
          </div>
          <Divider />
          <div className="text-center font-bold uppercase tracking-wider text-[13px]">
            {t('receipt_title')}
          </div>
          <div className="mt-1 space-y-0.5">
            <Row label={t('receipt_no')} value={inv.number} />
            <Row label={t('receipt_date')} value={p?.completed_at ? csFmtDateTime(p.completed_at) : csFmtDateTime(new Date())} />
            <Row label={t('receipt_table')} value={String(session.table_number) + ' — ' + (lang === 'vi' ? session.area_name_vi : session.area_name_en)} />
            <Row label={t('receipt_cashier')} value={t('cashier_name')} />
          </div>
          <Divider />

          {inv.orders.flatMap((o) => o.items).map((it) => {
            const name = lang === 'vi' ? it.name_snapshot_vi : it.name_snapshot_en;
            return (
              <div key={it.id} className="flex justify-between gap-3 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="font-bold">{name}</span> × {it.qty}
                  </div>
                  <div className="text-[11px] text-stone-500 tabular-nums">{csFmtVND(it.unit_price_snapshot)}</div>
                </div>
                <div className="tabular-nums font-semibold whitespace-nowrap">{csFmtVND(it.line_total)}</div>
              </div>
            );
          })}

          <Divider />

          <Row label={t('subtotal')} value={csFmtVND(inv.subtotal)} mono />
          <Row label={t('vat')} value={csFmtVND(inv.vat_amount)} mono />
          {inv.discount ? (
            <Row label={t('discount')} value={'-' + csFmtVND(inv.discount.amount)} mono />
          ) : null}
          <Divider />
          <div className="flex justify-between text-[14px] font-bold">
            <span>{t('total').toUpperCase()}:</span>
            <span className="tabular-nums">{csFmtVND(inv.total)}</span>
          </div>

          {p ? (
            <>
              <div className="mt-2">
                <Row label={t('receipt_method')} value={methodLabel} />
                {p.transaction_id ? <Row label={lang === 'vi' ? 'Mã GD' : 'Txn'} value={p.transaction_id} /> : null}
              </div>
            </>
          ) : null}
          <Divider />
          <div className="text-center">
            <div>{t('receipt_thanks')}</div>
            <div className="mt-3 inline-block bg-white border border-stone-300 rounded p-2">
              <FakeQRCode size={88} seed={inv.number} />
            </div>
            <div className="text-[10px] text-stone-500 mt-1">{t('receipt_scan_hint')}</div>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-stone-200 bg-white flex justify-end gap-2 no-print">
        <CButton variant="outline" onClick={onClose}>{t('close')}</CButton>
        <CButton variant="amber" onClick={onPrint}>
          <CIcon name="Printer" className="w-4 h-4" />
          {t('print')}
        </CButton>
      </div>
    </CDialog>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}:</span>
      <span className={mono ? 'tabular-nums whitespace-nowrap' : 'whitespace-nowrap'}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-stone-400" />;
}

// ============================================================
// Demo controls
// ============================================================
function DemoControls({ open, setOpen, t, autoOn, setAutoOn, onInjectBill, onForceSuccess, onForceFail, onReset, hasPending }) {
  const btn = 'w-full text-left px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm font-semibold text-stone-100 flex items-center justify-between transition disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className={'fixed bottom-5 right-5 z-40 font-mono select-none transition-all no-print ' + (open ? 'w-72' : 'w-auto')}>
      {open ? (
        <div className="bg-stone-950 text-stone-100 rounded-2xl border-2 border-dashed border-stone-600 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider">{t('demo_title')}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">{t('demo_subtitle')}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-400 hover:bg-stone-800 hover:text-white text-lg leading-none"
              aria-label="Collapse"
            >
              −
            </button>
          </div>
          <div className="p-3 space-y-2">
            <button onClick={onInjectBill} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {t('demo_inject_bill')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onForceSuccess} disabled={!hasPending} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {t('demo_force_success')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onForceFail} disabled={!hasPending} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {t('demo_force_fail')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onReset} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-stone-400" />
                {t('demo_reset')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <div className="h-px bg-stone-800 my-1" />
            <button onClick={() => setAutoOn((v) => !v)} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className={'w-2 h-2 rounded-full ' + (autoOn ? 'bg-emerald-400' : 'bg-stone-500')} />
                Auto events
              </span>
              <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded ' + (autoOn ? 'bg-emerald-500 text-stone-950' : 'bg-stone-700 text-stone-300')}>
                {autoOn ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-stone-950 text-stone-100 rounded-full pl-3 pr-4 py-2 border-2 border-dashed border-stone-600 shadow-2xl text-xs font-bold uppercase tracking-wider hover:bg-stone-900 inline-flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {t('demo_title')}
        </button>
      )}
    </div>
  );
}

function CashierRoot() {
  return (
    <CToastProvider>
      <CashierApp />
    </CToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CashierRoot />);
