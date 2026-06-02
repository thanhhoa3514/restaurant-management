// Waiter Floor View — App: header, layout, event loop, demo controls.

const { useState: _waState, useEffect: _waEffect, useMemo: _waMemo, useCallback: _waCallback, useRef: _waRef } = React;

function WFApp() {
  const [lang, setLang] = _waState('vi');
  const [soundOn, setSoundOn] = _waState(true);
  const [view, setView] = _waState('plan'); // 'plan' | 'grid'
  const [tables, setTables] = _waState(() => wfBuildInitialTables(new Date()));
  const [selectedTableId, setSelectedTableId] = _waState(null);
  const [now, setNow] = _waState(() => new Date());
  const [timeMultiplier, setTimeMultiplier] = _waState(1);
  const [autoOn, setAutoOn] = _waState(true);
  const [justChangedIds, setJustChangedIds] = _waState(() => new Set());
  const [demoOpen, setDemoOpen] = _waState(true);

  const { toast } = useWToast();

  const t = _waCallback(
    (key, ...args) => {
      const v = WF_DICT[lang][key];
      if (typeof v === 'function') return v(...args);
      return v ?? key;
    },
    [lang]
  );

  // Auto-collapse demo panel after 10s
  _waEffect(() => {
    const id = setTimeout(() => setDemoOpen(false), 10000);
    return () => clearTimeout(id);
  }, []);

  // Clock tick — virtual clock advances by 1s * multiplier per real second
  _waEffect(() => {
    const id = setInterval(() => {
      setNow((prev) => new Date(prev.getTime() + 1000 * timeMultiplier));
    }, 1000);
    return () => clearInterval(id);
  }, [timeMultiplier]);

  // Audio unlock on first gesture
  _waEffect(() => {
    const unlock = () => {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) {
        try { /* lazy ctx will be created on first chime */ } catch (e) {}
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // ---------- Just-changed pop animation ----------
  const markJustChanged = _waCallback((id) => {
    setJustChangedIds((cur) => {
      const next = new Set(cur);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setJustChangedIds((cur) => {
        const next = new Set(cur);
        next.delete(id);
        return next;
      });
    }, 500);
  }, []);

  // ---------- Mutations ----------
  const acknowledgeCall = (tableId) => {
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || !tbl.session?.waiter_called_at) return tbl;
        return { ...tbl, session: { ...tbl.session, waiter_called_at: null } };
      })
    );
    const tbl = tables.find((x) => x.id === tableId);
    if (tbl) toast(t('toast_acknowledged', tbl.number), { accent: 'red' });
  };

  const notifyCashier = (tableId) => {
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || !tbl.session?.bill_requested_at) return tbl;
        return { ...tbl, session: { ...tbl.session, bill_requested_at: null } };
      })
    );
    toast(t('toast_bill_sent'), { accent: 'blue' });
  };

  const requestBill = (tableId) => {
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || !tbl.session) return tbl;
        if (tbl.session.bill_requested_at) return tbl;
        return { ...tbl, session: { ...tbl.session, bill_requested_at: new Date(now) } };
      })
    );
    toast(t('toast_bill_sent'), { accent: 'blue' });
    markJustChanged(tableId);
  };

  // Real system: emit ORDER_ITEM_SERVED event via outbox → WebSocket → customer's order status updates
  const markItemServed = (tableId, itemId) => {
    let servedName = '';
    let tableNum = 0;
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || !tbl.session) return tbl;
        tableNum = tbl.number;
        const newOrders = tbl.session.orders.map((o) => ({
          ...o,
          items: o.items.map((it) => {
            if (it.id !== itemId) return it;
            servedName = lang === 'vi' ? it.name_vi : it.name_en;
            return {
              ...it,
              status: 'served',
              status_history: [...it.status_history, { status: 'served', timestamp: new Date(now) }],
            };
          }),
        }));
        return { ...tbl, session: { ...tbl.session, orders: newOrders } };
      })
    );
    if (servedName) toast(t('toast_served', servedName, tableNum), { accent: 'emerald' });
  };

  const markAllServed = (tableId) => {
    let tableNum = 0;
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || !tbl.session) return tbl;
        tableNum = tbl.number;
        const newOrders = tbl.session.orders.map((o) => ({
          ...o,
          items: o.items.map((it) => {
            if (it.status !== 'ready') return it;
            return {
              ...it,
              status: 'served',
              status_history: [...it.status_history, { status: 'served', timestamp: new Date(now) }],
            };
          }),
        }));
        return { ...tbl, session: { ...tbl.session, orders: newOrders } };
      })
    );
    if (tableNum) toast(t('toast_all_served', tableNum), { accent: 'emerald' });
  };

  const openSession = (tableId, guestCount, notes) => {
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.id !== tableId || tbl.status !== 'empty') return tbl;
        const session = wfMakeSession({
          startedAt: new Date(now),
          guestCount: Math.max(1, Math.min(tbl.capacity, guestCount)),
          orders: [],
        });
        // Stash notes on session even though it's not in the type — useful in real system
        session._notes = notes || '';
        return { ...tbl, status: 'occupied', session };
      })
    );
    const tbl = tables.find((x) => x.id === tableId);
    if (tbl) {
      toast(t('toast_session_opened', tbl.number), { accent: 'emerald' });
      markJustChanged(tableId);
    }
  };

  // ---------- Injections (used by demo controls + auto loop) ----------
  function injectItemReady() {
    let pickedNumber = 0;
    setTables((prev) => {
      const candidates = [];
      for (const tbl of prev) {
        if (tbl.status !== 'occupied' || !tbl.session) continue;
        for (const o of tbl.session.orders) {
          for (const it of o.items) {
            if (it.status === 'preparing') candidates.push({ tableId: tbl.id, itemId: it.id });
          }
        }
      }
      if (candidates.length === 0) return prev;
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      const stamp = new Date(now);
      return prev.map((tbl) => {
        if (tbl.id !== choice.tableId) return tbl;
        pickedNumber = tbl.number;
        const newOrders = tbl.session.orders.map((o) => ({
          ...o,
          items: o.items.map((it) => {
            if (it.id !== choice.itemId) return it;
            return {
              ...it,
              status: 'ready',
              status_history: [...it.status_history, { status: 'ready', timestamp: stamp }],
            };
          }),
        }));
        return { ...tbl, session: { ...tbl.session, orders: newOrders } };
      });
    });
    if (pickedNumber) {
      toast(t('toast_event_ready', pickedNumber), {
        accent: 'emerald',
        onClick: () => {
          const target = tables.find((x) => x.number === pickedNumber);
          if (target) setSelectedTableId(target.id);
        },
      });
      if (soundOn) wfPlayReadyChime();
      // find the table id by number for the just-changed pop
      const tbl = tables.find((x) => x.number === pickedNumber);
      if (tbl) markJustChanged(tbl.id);
    }
  }

  function injectCall() {
    let pickedNumber = 0;
    let pickedId = null;
    setTables((prev) => {
      const candidates = prev.filter(
        (tbl) => tbl.status === 'occupied' && tbl.session && !tbl.session.waiter_called_at
      );
      if (candidates.length === 0) return prev;
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      pickedNumber = choice.number;
      pickedId = choice.id;
      return prev.map((tbl) =>
        tbl.id === choice.id
          ? { ...tbl, session: { ...tbl.session, waiter_called_at: new Date(now) } }
          : tbl
      );
    });
    if (pickedNumber) {
      toast(t('toast_event_call', pickedNumber), {
        accent: 'red',
        onClick: () => pickedId && setSelectedTableId(pickedId),
      });
      if (soundOn) wfPlayCallChime();
      if (pickedId) markJustChanged(pickedId);
    }
  }

  function injectBill() {
    let pickedNumber = 0;
    let pickedId = null;
    setTables((prev) => {
      const candidates = prev.filter(
        (tbl) => tbl.status === 'occupied' && tbl.session && !tbl.session.bill_requested_at
      );
      if (candidates.length === 0) return prev;
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      pickedNumber = choice.number;
      pickedId = choice.id;
      return prev.map((tbl) =>
        tbl.id === choice.id
          ? { ...tbl, session: { ...tbl.session, bill_requested_at: new Date(now) } }
          : tbl
      );
    });
    if (pickedNumber) {
      toast(t('toast_event_bill', pickedNumber), {
        accent: 'blue',
        onClick: () => pickedId && setSelectedTableId(pickedId),
      });
      if (soundOn) wfPlayBillChime();
      if (pickedId) markJustChanged(pickedId);
    }
  }

  function injectNewSession() {
    let pickedNumber = 0;
    let pickedId = null;
    setTables((prev) => {
      const empties = prev.filter((tbl) => tbl.status === 'empty');
      if (empties.length === 0) return prev;
      const choice = empties[Math.floor(Math.random() * empties.length)];
      pickedNumber = choice.number;
      pickedId = choice.id;
      // Compose 1-3 random pending items
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const used = new Set();
      const items = [];
      const stamp = new Date(now);
      for (let i = 0; i < itemCount; i++) {
        let dish;
        let guard = 0;
        do {
          dish = WF_MENU[Math.floor(Math.random() * WF_MENU.length)];
          guard++;
        } while (used.has(dish.id) && guard < 8);
        used.add(dish.id);
        items.push(wfMakeItem(dish.id, 1 + Math.floor(Math.random() * 2), 'pending', stamp));
      }
      const session = wfMakeSession({
        startedAt: stamp,
        guestCount: Math.max(1, Math.min(choice.capacity, 1 + Math.floor(Math.random() * choice.capacity))),
        orders: [wfMakeOrder(stamp, items)],
      });
      return prev.map((tbl) => (tbl.id === choice.id ? { ...tbl, status: 'occupied', session } : tbl));
    });
    if (pickedNumber) {
      toast(t('toast_event_new_session', pickedNumber), {
        accent: 'amber',
        onClick: () => pickedId && setSelectedTableId(pickedId),
      });
      if (soundOn) wfPlayBillChime();
      if (pickedId) markJustChanged(pickedId);
    }
  }

  // ---------- Auto event loop (real time 8–15s) ----------
  _waEffect(() => {
    if (!autoOn) return;
    let timerId;
    const schedule = () => {
      const delay = 8000 + Math.random() * 7000;
      timerId = setTimeout(() => {
        const r = Math.random();
        if (r < 0.30) injectItemReady();
        else if (r < 0.45) injectCall();
        else if (r < 0.55) injectBill();
        else if (r < 0.80) injectNewSession();
        // else 20% no-op
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn]);

  // ---------- Derived counters ----------
  const counts = _waMemo(() => {
    let calls = 0, ready = 0, bills = 0, occupied = 0;
    for (const tbl of tables) {
      if (tbl.status === 'occupied' && tbl.session) {
        occupied++;
        if (tbl.session.waiter_called_at) calls++;
        if (tbl.session.bill_requested_at) bills++;
        for (const o of tbl.session.orders) {
          for (const it of o.items) {
            if (it.status === 'ready') ready++;
          }
        }
      }
    }
    return { calls, ready, bills, occupied, total: tables.length };
  }, [tables]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center gap-5">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white inline-flex items-center justify-center text-xs font-bold tracking-tight">
              WF
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[15px] font-bold text-stone-900 truncate">{t('floor_view')}</div>
              <div className="text-[11px] text-stone-500 font-medium truncate">{t('restaurant')}</div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="text-xl font-bold text-stone-900 tabular-nums tracking-tight font-mono">
              {wfFmtClock(now)}
            </div>
            <div className="w-px h-5 bg-stone-200" />
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
              {t('shift')}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <WCounterPill tone="red" label={t('calls')} value={counts.calls} />
            <WCounterPill tone="emerald" label={t('ready')} value={counts.ready} />
            <WCounterPill tone="blue" label={t('bills')} value={counts.bills} />
            <div className="w-px h-7 bg-stone-200 mx-1" />
            <WLangToggle lang={lang} setLang={setLang} />
            <WSoundToggle on={soundOn} setOn={setSoundOn} />
          </div>
        </div>
      </header>

      {/* View toggle bar */}
      <div className="sticky top-16 z-20 h-14 bg-stone-50 border-b border-stone-200">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between gap-4">
          <WViewTabs
            value={view}
            onChange={setView}
            items={[
              { id: 'plan', label: t('view_plan') },
              { id: 'grid', label: t('view_grid') },
            ]}
          />
          <div className="text-sm text-stone-500 font-medium tabular-nums">
            {t('occupied_summary', counts.occupied, counts.total)}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-5">
        {view === 'plan' ? (
          <FloorPlan
            tables={tables}
            now={now}
            lang={lang}
            t={t}
            onSelectTable={setSelectedTableId}
            justChangedIds={justChangedIds}
          />
        ) : (
          <GridView
            tables={tables}
            now={now}
            lang={lang}
            t={t}
            onSelectTable={setSelectedTableId}
            justChangedIds={justChangedIds}
          />
        )}
      </main>

      <TableSheet
        open={!!selectedTable}
        table={selectedTable}
        now={now}
        lang={lang}
        t={t}
        onClose={() => setSelectedTableId(null)}
        onAcknowledgeCall={acknowledgeCall}
        onNotifyCashier={notifyCashier}
        onMarkItemServed={markItemServed}
        onMarkAllServed={markAllServed}
        onRequestBill={requestBill}
        onOpenSession={openSession}
      />

      <WFDemoControls
        open={demoOpen}
        setOpen={setDemoOpen}
        lang={lang}
        t={t}
        autoOn={autoOn}
        setAutoOn={setAutoOn}
        timeMultiplier={timeMultiplier}
        setTimeMultiplier={setTimeMultiplier}
        onInjectReady={injectItemReady}
        onInjectCall={injectCall}
        onInjectBill={injectBill}
        onInjectSession={injectNewSession}
      />
    </div>
  );
}

// ---------- Demo controls ----------
function WFDemoControls({ open, setOpen, lang, t, autoOn, setAutoOn, timeMultiplier, setTimeMultiplier, onInjectReady, onInjectCall, onInjectBill, onInjectSession }) {
  const cycleSpeed = () => {
    const seq = [1, 10, 60];
    const idx = seq.indexOf(timeMultiplier);
    setTimeMultiplier(seq[(idx + 1) % seq.length]);
  };
  const btn = 'w-full text-left px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm font-semibold text-stone-100 flex items-center justify-between transition';

  return (
    <div className={'fixed bottom-5 right-5 z-40 font-mono select-none transition-all ' + (open ? 'w-72' : 'w-auto')}>
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
            <button onClick={onInjectReady} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {t('demo_inject_ready')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onInjectCall} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {t('demo_inject_call')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onInjectBill} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {t('demo_inject_bill')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>
            <button onClick={onInjectSession} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {t('demo_inject_session')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>

            <div className="h-px bg-stone-800 my-1" />

            <button onClick={() => setAutoOn((v) => !v)} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className={'w-2 h-2 rounded-full ' + (autoOn ? 'bg-emerald-400' : 'bg-stone-500')} />
                {t('demo_auto')}
              </span>
              <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded ' + (autoOn ? 'bg-emerald-500 text-stone-950' : 'bg-stone-700 text-stone-300')}>
                {autoOn ? 'ON' : 'OFF'}
              </span>
            </button>

            <button onClick={cycleSpeed} className={btn}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-stone-300" />
                {t('demo_speed')}
              </span>
              <span
                className={
                  'tabular-nums font-bold text-[13px] px-2 py-0.5 rounded ' +
                  (timeMultiplier === 1
                    ? 'bg-stone-700 text-stone-200'
                    : timeMultiplier === 10
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-red-500 text-white')
                }
              >
                ×{timeMultiplier}
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

function WFRoot() {
  return (
    <WToastProvider>
      <WFApp />
    </WToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WFRoot />);
