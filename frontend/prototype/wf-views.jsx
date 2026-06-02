// Waiter Floor View — FloorPlan, Grid, TableSheet.

const { useState: _wvState, useEffect: _wvEffect, useMemo: _wvMemo, useRef: _wvRef } = React;

// ---------- Visual treatment per priority ----------
function tableVisuals(priority) {
  switch (priority) {
    case 'call':
      return {
        bg: 'bg-red-50',
        border: 'border-red-500 border-2',
        text: 'text-red-900',
        sub: 'text-red-700',
        pulse: 'animate-pulse-soft',
      };
    case 'ready':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-500 border-2',
        text: 'text-emerald-900',
        sub: 'text-emerald-700',
        pulse: 'animate-pulse-soft',
      };
    case 'bill':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500 border-2',
        text: 'text-blue-900',
        sub: 'text-blue-700',
        pulse: '',
      };
    case 'idle':
      return {
        bg: 'bg-white',
        border: 'border-amber-500 border-2 border-dashed',
        text: 'text-stone-800',
        sub: 'text-stone-500',
        pulse: '',
      };
    case 'occupied':
      return {
        bg: 'bg-white',
        border: 'border-amber-200 border-2',
        text: 'text-stone-900',
        sub: 'text-stone-500',
        pulse: '',
      };
    case 'empty':
    default:
      return {
        bg: 'bg-stone-200/70',
        border: 'border-stone-200 border-2',
        text: 'text-stone-500',
        sub: 'text-stone-400',
        pulse: '',
      };
  }
}

// Returns the secondary signals present (excluding the primary priority).
function secondarySignals(table, primary) {
  if (!table.session) return [];
  const out = [];
  const s = table.session;
  if (primary !== 'call' && s.waiter_called_at) out.push('call');
  if (primary !== 'ready' && s.orders.some((o) => o.items.some((it) => it.status === 'ready')))
    out.push('ready');
  if (primary !== 'bill' && s.bill_requested_at) out.push('bill');
  return out;
}

const SIGNAL_DOT = {
  call: 'bg-red-500',
  ready: 'bg-emerald-500',
  bill: 'bg-blue-500',
};

// ---------- Floor plan view ----------
function FloorPlan({ tables, now, lang, t, onSelectTable, justChangedIds }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl relative overflow-hidden" style={{ minHeight: '600px', height: '70vh' }}>
      {/* Faint grid background to feel like a plan */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(168,162,158,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(168,162,158,0.18) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      {/* Landmarks */}
      {WF_LANDMARKS.map((lm) => (
        <div
          key={lm.key}
          className="absolute rounded-xl bg-stone-200/80 border border-stone-300 text-stone-600 text-xs font-semibold uppercase tracking-wider flex items-center justify-center select-none pointer-events-none"
          style={{
            left: lm.x + '%',
            top: lm.y + '%',
            width: lm.w + '%',
            height: lm.h + '%',
          }}
        >
          {t(lm.key)}
        </div>
      ))}

      {/* Tables */}
      {tables.map((tbl) => {
        const priority = wfPriorityOf(tbl, now);
        const v = tableVisuals(priority);
        const secondaries = secondarySignals(tbl, priority);
        const just = justChangedIds.has(tbl.id);
        return (
          <button
            key={tbl.id}
            onClick={() => onSelectTable(tbl.id)}
            className={
              `absolute rounded-2xl shadow-sm transition-all hover:shadow-md active:scale-[0.97] ${v.bg} ${v.border} ${v.pulse} ${just ? 'animate-pop' : ''}`
            }
            style={{
              left: tbl.position.x_pct + '%',
              top: tbl.position.y_pct + '%',
              width: '80px',
              height: '80px',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={`flex flex-col items-center justify-center h-full ${v.text} font-bold`}>
              <span className="text-2xl leading-none">{tbl.number}</span>
              <span className={`text-[11px] mt-1 font-semibold ${v.sub} tabular-nums`}>
                {priority === 'empty' ? '— —' : `${tbl.session?.guest_count ?? 0}/${tbl.capacity}`}
              </span>
            </div>
            {/* Secondary signal dots */}
            {secondaries.length > 0 ? (
              <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
                {secondaries.map((sig) => (
                  <span
                    key={sig}
                    className={`w-3 h-3 rounded-full ${SIGNAL_DOT[sig]} border-2 border-white shadow`}
                  />
                ))}
              </div>
            ) : null}
          </button>
        );
      })}

      {/* Legend (bottom-left) */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur border border-stone-200 rounded-xl p-2 shadow-sm flex items-center gap-3 text-[11px] font-semibold text-stone-600">
        <LegendDot color="bg-red-500" label={lang === 'vi' ? 'Gọi' : 'Call'} />
        <LegendDot color="bg-emerald-500" label={lang === 'vi' ? 'Sẵn sàng' : 'Ready'} />
        <LegendDot color="bg-blue-500" label={lang === 'vi' ? 'Thanh toán' : 'Bill'} />
        <LegendDot color="bg-amber-300" label={lang === 'vi' ? 'Đang phục vụ' : 'Active'} ring />
        <LegendDot color="bg-stone-300" label={lang === 'vi' ? 'Trống' : 'Empty'} />
      </div>
    </div>
  );
}

function LegendDot({ color, label, ring }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color} ${ring ? 'ring-2 ring-amber-100' : ''}`} />
      <span>{label}</span>
    </span>
  );
}

// ---------- Grid view ----------
function GridView({ tables, now, lang, t, onSelectTable, justChangedIds }) {
  const sorted = _wvMemo(() => {
    const annotated = tables.map((tbl) => {
      const priority = wfPriorityOf(tbl, now);
      const sig = wfTimeSinceSignal(tbl, priority, now) ?? 0;
      return { tbl, priority, sig };
    });
    annotated.sort((a, b) => {
      const ra = wfPriorityRank(a.priority);
      const rb = wfPriorityRank(b.priority);
      if (ra !== rb) return ra - rb;
      // longest-waiting first within band
      return b.sig - a.sig;
    });
    return annotated;
  }, [tables, now]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {sorted.map(({ tbl, priority, sig }) => {
        const v = tableVisuals(priority);
        const secondaries = secondarySignals(tbl, priority);
        const just = justChangedIds.has(tbl.id);
        const label = priorityLabel(priority, lang);
        return (
          <button
            key={tbl.id}
            onClick={() => onSelectTable(tbl.id)}
            className={
              `relative text-left rounded-2xl p-3.5 transition shadow-sm hover:shadow-md active:scale-[0.99] min-h-[140px] flex flex-col ${v.bg} ${v.border} ${v.pulse} ${just ? 'animate-pop' : ''}`
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`text-2xl font-bold leading-none ${v.text}`}>{tbl.number}</div>
                <div className={`text-[11px] mt-1.5 ${v.sub} font-semibold uppercase tracking-wider`}>
                  {priority === 'empty'
                    ? lang === 'vi' ? 'Trống' : 'Empty'
                    : `${tbl.session?.guest_count ?? 0}/${tbl.capacity} ${lang === 'vi' ? 'khách' : ''}`}
                </div>
              </div>
              {secondaries.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {secondaries.map((s) => (
                    <span key={s} className={`w-2.5 h-2.5 rounded-full ${SIGNAL_DOT[s]}`} />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-auto pt-2">
              {priority !== 'empty' ? (
                <div className={`text-[13px] font-semibold ${v.text} leading-tight`}>{label}</div>
              ) : null}
              {priority !== 'empty' && sig != null ? (
                <div className={`text-[12px] font-mono tabular-nums mt-0.5 ${v.sub}`}>
                  {t('waiting')} {wfFmtHMS(sig)}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function priorityLabel(priority, lang) {
  const map = {
    call: lang === 'vi' ? 'Gọi nhân viên' : 'Calling waiter',
    ready: lang === 'vi' ? 'Có món sẵn sàng' : 'Items ready',
    bill: lang === 'vi' ? 'Yêu cầu thanh toán' : 'Bill requested',
    idle: lang === 'vi' ? 'Lâu chưa hoạt động' : 'Idle',
    occupied: lang === 'vi' ? 'Đang phục vụ' : 'Active',
    empty: '',
  };
  return map[priority];
}

// ---------- Item status chip ----------
function ItemStatusChip({ status, t }) {
  const map = {
    pending: { tone: 'gray', label: t('status_pending') },
    acknowledged: { tone: 'blue', label: t('status_acknowledged') },
    preparing: { tone: 'amber', label: t('status_preparing') },
    ready: { tone: 'emerald', label: t('status_ready') },
    served: { tone: 'stone', label: t('status_served') },
  };
  const c = map[status];
  return <WBadge tone={c.tone}>{c.label}</WBadge>;
}

// ---------- Table detail sheet ----------
function TableSheet({ open, table, now, lang, t, onClose, onAcknowledgeCall, onNotifyCashier, onMarkItemServed, onMarkAllServed, onRequestBill, onOpenSession }) {
  const [confirmBill, setConfirmBill] = _wvState(false);
  const [openSessionForm, setOpenSessionForm] = _wvState(false);
  const [formGuests, setFormGuests] = _wvState(2);
  const [formNotes, setFormNotes] = _wvState('');

  // Reset sub-dialog state on table change.
  _wvEffect(() => {
    setConfirmBill(false);
    setOpenSessionForm(false);
    setFormGuests(table?.capacity ? Math.min(2, table.capacity) : 2);
    setFormNotes('');
  }, [table?.id]);

  if (!table) return null;
  const isEmpty = table.status === 'empty';
  const session = table.session;

  // For occupied tables: aggregate ready items, derive subtotal, count orders.
  const readyItems = [];
  if (session) {
    for (const order of session.orders) {
      for (const item of order.items) {
        if (item.status === 'ready') {
          readyItems.push({ item, orderId: order.id });
        }
      }
    }
  }
  const subtotal = session
    ? session.orders.reduce(
        (sum, o) => sum + o.items.reduce((s, it) => s + it.unit_price * it.qty, 0),
        0
      )
    : 0;
  const orderCount = session?.orders.length ?? 0;
  const elapsedSec = session ? Math.max(0, Math.floor((now - session.started_at.getTime()) / 1000)) : 0;
  const elapsedMin = Math.round(elapsedSec / 60);

  return (
    <WSheet open={open} onClose={onClose}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-stone-200 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-stone-900 leading-none">
              {t('table')} {table.number}
            </span>
            {!isEmpty ? (
              <span className="text-sm text-stone-500 font-medium">
                • {t('guests', session.guest_count)}
              </span>
            ) : (
              <WBadge tone="stone">{t('empty')}</WBadge>
            )}
          </div>
          {!isEmpty ? (
            <div className="mt-1 text-sm text-stone-500 font-medium">
              {t('opened_at')} {wfFmtTimestamp(session.started_at)} • {elapsedMin} {t('minutes')}
            </div>
          ) : (
            <div className="mt-1 text-sm text-stone-500 font-medium">
              {t('table')} {table.number} • {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 -mr-2 -mt-1 rounded-full inline-flex items-center justify-center text-stone-500 hover:bg-stone-100 text-xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isEmpty ? (
          <EmptyTableBody
            table={table}
            t={t}
            lang={lang}
            openSessionForm={openSessionForm}
            setOpenSessionForm={setOpenSessionForm}
            formGuests={formGuests}
            setFormGuests={setFormGuests}
            formNotes={formNotes}
            setFormNotes={setFormNotes}
            onSubmit={() => {
              onOpenSession(table.id, formGuests, formNotes);
              setOpenSessionForm(false);
            }}
          />
        ) : (
          <OccupiedBody
            table={table}
            session={session}
            now={now}
            t={t}
            lang={lang}
            readyItems={readyItems}
            onAcknowledgeCall={onAcknowledgeCall}
            onNotifyCashier={onNotifyCashier}
            onMarkItemServed={onMarkItemServed}
            onMarkAllServed={onMarkAllServed}
          />
        )}
      </div>

      {/* Footer (only for occupied tables) */}
      {!isEmpty ? (
        <div className="border-t border-stone-200 px-6 py-4 bg-stone-50/60 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              {t('subtotal_label')}
            </div>
            <div className="text-xl font-bold text-stone-900 tabular-nums">
              {wfFmtVND(subtotal)}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              {orderCount} {lang === 'vi' ? 'lượt gọi món' : 'orders'}
            </div>
          </div>
          {session.bill_requested_at ? (
            <WBadge tone="blue" className="text-sm py-1.5 px-3">
              {t('signal_bill')}
            </WBadge>
          ) : (
            <WButton variant="blue" onClick={() => setConfirmBill(true)}>
              {t('btn_request_bill')}
            </WButton>
          )}
        </div>
      ) : null}

      {/* Confirm bill dialog */}
      <WDialog open={confirmBill} onClose={() => setConfirmBill(false)} size="sm">
        <div className="p-6">
          <div className="text-lg font-bold text-stone-900">{t('confirm_bill_title')}</div>
          <p className="mt-2 text-sm text-stone-600 leading-relaxed">{t('confirm_bill_desc')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <WButton variant="outline" onClick={() => setConfirmBill(false)}>
              {t('cancel')}
            </WButton>
            <WButton
              variant="blue"
              onClick={() => {
                onRequestBill(table.id);
                setConfirmBill(false);
              }}
            >
              {t('confirm')}
            </WButton>
          </div>
        </div>
      </WDialog>
    </WSheet>
  );
}

// ---------- Occupied table body ----------
function OccupiedBody({ table, session, now, t, lang, readyItems, onAcknowledgeCall, onNotifyCashier, onMarkItemServed, onMarkAllServed }) {
  return (
    <div className="space-y-5">
      {/* Active signals */}
      {session.waiter_called_at ? (
        <SignalBanner
          tone="red"
          title={t('signal_call')}
          time={wfFmtHMS(Math.floor((now - session.waiter_called_at.getTime()) / 1000))}
          buttonLabel={t('btn_acknowledge')}
          onClick={() => onAcknowledgeCall(table.id)}
        />
      ) : null}
      {session.bill_requested_at ? (
        <SignalBanner
          tone="blue"
          title={t('signal_bill')}
          time={wfFmtHMS(Math.floor((now - session.bill_requested_at.getTime()) / 1000))}
          buttonLabel={t('btn_notify_cashier')}
          onClick={() => onNotifyCashier(table.id)}
        />
      ) : null}

      {/* Ready to serve */}
      {readyItems.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-emerald-800 font-bold text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {t('ready_section', readyItems.length)}
            </h3>
            {readyItems.length >= 2 ? (
              <button
                onClick={() => onMarkAllServed(table.id)}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
              >
                {t('btn_mark_all_served')}
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 divide-y divide-emerald-200/60 overflow-hidden">
            {readyItems.map(({ item }) => {
              const readyEntry = item.status_history.find((h) => h.status === 'ready');
              const sinceReady = readyEntry
                ? Math.max(0, Math.floor((now - readyEntry.timestamp.getTime()) / 1000))
                : 0;
              return (
                <div key={item.id} className="p-3 flex items-start gap-3">
                  {item.qty > 1 ? (
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold tabular-nums">
                      ×{item.qty}
                    </span>
                  ) : (
                    <span className="shrink-0 w-7 h-7" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-semibold text-stone-900 leading-tight">
                      {lang === 'vi' ? item.name_vi : item.name_en}
                    </div>
                    {(lang === 'vi' ? item.options_text_vi : item.options_text_en) ? (
                      <div className="text-[13px] text-stone-500 mt-0.5">
                        {lang === 'vi' ? item.options_text_vi : item.options_text_en}
                      </div>
                    ) : null}
                    {item.notes ? (
                      <div className="mt-1 text-[12px] text-amber-700 italic">"{item.notes}"</div>
                    ) : null}
                    <div className="mt-1.5 text-[12px] text-emerald-700 font-semibold tabular-nums font-mono">
                      {t('ready_since')} {wfFmtHMS(sinceReady)}
                    </div>
                  </div>
                  <WButton
                    variant="emerald"
                    size="sm"
                    onClick={() => onMarkItemServed(table.id, item.id)}
                  >
                    {t('btn_mark_served')}
                  </WButton>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Order history */}
      <div>
        <h3 className="text-stone-900 font-bold text-base mb-2.5">{t('order_history')}</h3>
        <div className="space-y-3">
          {session.orders.length === 0 ? (
            <div className="text-sm text-stone-500 italic">
              {lang === 'vi' ? 'Chưa có lượt gọi món nào.' : 'No orders yet.'}
            </div>
          ) : (
            session.orders.map((order) => (
              <WCard key={order.id} className="overflow-hidden">
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <div className="text-sm font-semibold text-stone-700">
                    {t('order_placed_at')} {wfFmtTimestamp(order.submitted_at)}
                  </div>
                  <div className="text-xs text-stone-400 font-mono">{order.id}</div>
                </div>
                <div className="divide-y divide-stone-100">
                  {order.items.map((item) => {
                    const served = item.status === 'served';
                    return (
                      <div key={item.id} className="p-3 flex items-start gap-3">
                        {item.qty > 1 ? (
                          <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold tabular-nums ${served ? 'bg-stone-200 text-stone-400' : 'bg-stone-900 text-white'}`}>
                            ×{item.qty}
                          </span>
                        ) : (
                          <span className="shrink-0 w-7 h-7" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-[15px] font-semibold leading-tight ${served ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                            {lang === 'vi' ? item.name_vi : item.name_en}
                          </div>
                          {(lang === 'vi' ? item.options_text_vi : item.options_text_en) ? (
                            <div className={`text-[13px] mt-0.5 ${served ? 'text-stone-300' : 'text-stone-500'}`}>
                              {lang === 'vi' ? item.options_text_vi : item.options_text_en}
                            </div>
                          ) : null}
                          {item.notes ? (
                            <div className="text-[12px] text-amber-700 italic mt-0.5">"{item.notes}"</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <ItemStatusChip status={item.status} t={t} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </WCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SignalBanner({ tone, title, time, buttonLabel, onClick }) {
  const tones = {
    red: {
      wrap: 'border-red-300 bg-red-50',
      dot: 'bg-red-500',
      title: 'text-red-900',
      time: 'text-red-700',
      btn: 'red',
    },
    blue: {
      wrap: 'border-blue-300 bg-blue-50',
      dot: 'bg-blue-500',
      title: 'text-blue-900',
      time: 'text-blue-700',
      btn: 'blue',
    },
  }[tone];
  return (
    <div className={`rounded-2xl border-2 ${tones.wrap} p-3.5 flex items-center justify-between gap-3 ${tone === 'red' ? 'animate-pulse-soft' : ''}`}>
      <div className="flex items-start gap-3 min-w-0">
        <span className={`w-3 h-3 rounded-full ${tones.dot} mt-2 shrink-0`} />
        <div className="min-w-0">
          <div className={`font-bold text-[15px] ${tones.title}`}>{title}</div>
          <div className={`text-sm font-mono tabular-nums ${tones.time} mt-0.5`}>{time}</div>
        </div>
      </div>
      <WButton variant={tones.btn} size="sm" onClick={onClick}>{buttonLabel}</WButton>
    </div>
  );
}

// ---------- Empty table body ----------
function EmptyTableBody({ table, t, lang, openSessionForm, setOpenSessionForm, formGuests, setFormGuests, formNotes, setFormNotes, onSubmit }) {
  if (!openSessionForm) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-stone-100 inline-flex items-center justify-center text-stone-400 text-3xl font-bold">
          {table.number}
        </div>
        <div className="mt-4 text-lg font-bold text-stone-900">{t('empty')}</div>
        <div className="text-sm text-stone-500 mt-1">
          {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
        </div>
        <WButton
          variant="primary"
          size="lg"
          className="mt-6 w-full"
          onClick={() => setOpenSessionForm(true)}
        >
          {t('empty_table_cta')}
        </WButton>
        <p className="mt-3 text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
          {lang === 'vi'
            ? 'Mở phiên thủ công cho khách walk-in không quét mã QR.'
            : 'Manually open a session for walk-in guests without a QR scan.'}
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="text-base font-bold text-stone-900">{t('open_session_title')}</div>
      <p className="text-sm text-stone-500 mt-1">
        {t('table')} {table.number} • {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-2">
            {t('guest_count_label')}
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: table.capacity }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setFormGuests(n)}
                className={
                  'min-w-[48px] h-[48px] rounded-xl border-2 font-bold text-lg transition ' +
                  (formGuests === n
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400')
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 block mb-2">
            {t('notes_label')}
          </label>
          <textarea
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder={t('notes_placeholder')}
            rows={3}
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200 resize-none"
          />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <WButton variant="outline" className="flex-1" onClick={() => setOpenSessionForm(false)}>
          {t('cancel')}
        </WButton>
        <WButton variant="primary" className="flex-1" onClick={onSubmit}>
          {t('btn_open_session')}
        </WButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  FloorPlan,
  GridView,
  TableSheet,
  tableVisuals,
  secondarySignals,
});
