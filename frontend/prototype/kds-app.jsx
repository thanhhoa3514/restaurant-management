// KDS App — header, ticket grid, event loop, demo controls.

const { useState: _auseState, useEffect: _auseEffect, useRef: _auseRef, useMemo: _auseMemo, useCallback: _auseCallback } = React;

function KDSApp() {
  const [lang, setLang] = _auseState('vi');
  const [soundOn, setSoundOn] = _auseState(true);
  const [tickets, setTickets] = _auseState(() => buildInitialTickets(new Date()));
  const [fadingIds, setFadingIds] = _auseState(() => new Set());
  const [manageOrderId, setManageOrderId] = _auseState(null);

  // Virtual "now" — ticks every real second, advances by 1s × multiplier.
  const [now, setNow] = _auseState(() => new Date());
  const [timeMultiplier, setTimeMultiplier] = _auseState(1); // 1, 10, 60
  const [paused, setPaused] = _auseState(false);

  // Demo panel collapse — expanded for first 10s, then auto-collapse.
  const [demoOpen, setDemoOpen] = _auseState(true);
  _auseEffect(() => {
    const id = setTimeout(() => setDemoOpen(false), 10000);
    return () => clearTimeout(id);
  }, []);

  const { toast } = useKToast();

  const t = _auseCallback(
    (key, ...args) => {
      const v = KDS_DICT[lang][key];
      if (typeof v === 'function') return v(...args);
      return v ?? key;
    },
    [lang]
  );

  // ---------- Clock tick ----------
  _auseEffect(() => {
    const id = setInterval(() => {
      setNow((prev) => new Date(prev.getTime() + 1000 * timeMultiplier));
    }, 1000);
    return () => clearInterval(id);
  }, [timeMultiplier]);

  // ---------- "Just went red" detection ----------
  const prevUrgencyRef = _auseRef({});
  _auseEffect(() => {
    let firedRed = false;
    const next = {};
    for (const tk of tickets) {
      if (fadingIds.has(tk.order_id)) continue;
      if (tk.items.every((it) => it.status === 'served')) continue;
      const waitSec = Math.max(0, Math.floor((now - tk.submitted_at.getTime()) / 1000));
      const u = urgencyFor(waitSec);
      const prev = prevUrgencyRef.current[tk.order_id];
      if (prev && prev !== 'red' && u === 'red') {
        firedRed = true;
      }
      next[tk.order_id] = u;
    }
    prevUrgencyRef.current = next;
    if (firedRed && soundOn) {
      playUrgencyChime();
    }
  }, [tickets, now, soundOn, fadingIds]);

  // ---------- Auto-inject new tickets every 20–30s real time ----------
  _auseEffect(() => {
    if (paused) return;
    let timerId;
    const schedule = () => {
      const delay = 20000 + Math.random() * 10000;
      timerId = setTimeout(() => {
        injectNewTicket();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // ---------- One-shot audio unlock on first user gesture ----------
  _auseEffect(() => {
    const unlock = () => {
      // Touching the context resumes it; subsequent plays will work.
      // (No-op if no AudioContext is available.)
      try {
        const ctx = (window.AudioContext || window.webkitAudioContext) ? null : null;
      } catch (e) {}
      // Actually call into our helper to lazily create + resume.
      // We do this silently — just create, don't play.
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) {
        try {
          // touching playNewOrderChime creates the ctx; we don't want to play
          // so just create the ctx directly:
        } catch (e) {}
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

  // ---------- Mutations ----------
  function injectNewTicket() {
    setNow((curNow) => {
      const stamp = new Date(curNow.getTime());
      const ticket = buildRandomNewTicket(stamp);
      setTickets((prev) => [...prev, ticket]);
      toast(t('toast_new_order', ticket.table_number), { tone: 'amber', icon: 'BellRing' });
      if (soundOn) playNewOrderChime();
      return curNow;
    });
  }

  function advanceAll(orderId) {
    setTickets((prev) =>
      prev.map((tk) => {
        if (tk.order_id !== orderId) return tk;
        const live = tk.items.filter((it) => it.status !== 'served');
        if (live.length === 0) return tk; // already all served
        const min = minStatus(live);
        const stamp = new Date(now);
        const newItems = tk.items.map((it) => {
          if (it.status !== min) return it;
          const nextS = nextStatus(it.status);
          return {
            ...it,
            status: nextS,
            status_history: [...it.status_history, { status: nextS, timestamp: stamp }],
          };
        });
        // Schedule toast based on the new min status the user just advanced *from*.
        const toastKey = {
          pending: 'toast_acknowledged',
          acknowledged: 'toast_start',
          preparing: 'toast_ready',
          ready: 'toast_served',
        }[min];
        if (toastKey) {
          const toastIcon = {
            toast_acknowledged: 'Eye',
            toast_start: 'ChefHat',
            toast_ready: 'CheckCircle2',
            toast_served: 'CheckCheck',
          }[toastKey];
          const toastTone = {
            toast_acknowledged: 'dark',
            toast_start: 'amber',
            toast_ready: 'emerald',
            toast_served: 'dark',
          }[toastKey];
          toast(t(toastKey, tk.table_number), { icon: toastIcon, tone: toastTone });
        }
        return { ...tk, items: newItems };
      })
    );
  }

  function advanceItem(orderId, itemId) {
    setTickets((prev) =>
      prev.map((tk) => {
        if (tk.order_id !== orderId) return tk;
        const stamp = new Date(now);
        let advancedName = '';
        const newItems = tk.items.map((it) => {
          if (it.id !== itemId) return it;
          if (it.status === 'served') return it;
          const nextS = nextStatus(it.status);
          advancedName = lang === 'vi' ? it.name_vi : it.name_en;
          return {
            ...it,
            status: nextS,
            status_history: [...it.status_history, { status: nextS, timestamp: stamp }],
          };
        });
        if (advancedName) {
          toast(t('toast_item_advanced', advancedName), { icon: 'ArrowRight' });
        }
        return { ...tk, items: newItems };
      })
    );
  }

  // ---------- Fade-out + remove tickets when fully served ----------
  _auseEffect(() => {
    for (const tk of tickets) {
      if (fadingIds.has(tk.order_id)) continue;
      if (tk.items.length === 0) continue;
      if (tk.items.every((it) => it.status === 'served')) {
        setFadingIds((cur) => new Set(cur).add(tk.order_id));
        setTimeout(() => {
          setTickets((prev) => prev.filter((x) => x.order_id !== tk.order_id));
          setFadingIds((cur) => {
            const next = new Set(cur);
            next.delete(tk.order_id);
            return next;
          });
        }, 1500);
      }
    }
  }, [tickets, fadingIds]);

  // ---------- Derived stats ----------
  const stats = _auseMemo(() => {
    let pending = 0,
      preparing = 0,
      ready = 0;
    for (const tk of tickets) {
      for (const it of tk.items) {
        if (it.status === 'pending' || it.status === 'acknowledged') pending++;
        else if (it.status === 'preparing') preparing++;
        else if (it.status === 'ready') ready++;
      }
    }
    return { pending, preparing, ready };
  }, [tickets]);

  // ---------- Sort: oldest first (longest waiting at top-left) ----------
  const sortedTickets = _auseMemo(
    () => tickets.slice().sort((a, b) => a.submitted_at - b.submitted_at),
    [tickets]
  );

  const manageTicket = sortedTickets.find((t) => t.order_id === manageOrderId);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 h-20 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
          {/* Left */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-xl bg-stone-900 text-white inline-flex items-center justify-center">
              <KIcon name="ChefHat" className="w-6 h-6" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-stone-900">{t('restaurant')}</div>
              <div className="text-xs text-stone-500 font-medium">{t('kitchen_display')}</div>
            </div>
          </div>

          {/* Center: live clock */}
          <div className="flex-1 flex justify-center">
            <div className="text-3xl font-bold text-stone-900 tabular-nums tracking-tight font-mono">
              {fmtClock(now)}
            </div>
          </div>

          {/* Right: stats + lang + sound */}
          <div className="flex items-center gap-2 shrink-0">
            <KStatPill dot="amber" label={t('pending_count')} value={stats.pending} />
            <KStatPill dot="blue" label={t('preparing_count')} value={stats.preparing} />
            <KStatPill dot="emerald" label={t('ready_count')} value={stats.ready} />
            <div className="w-px h-8 bg-stone-200 mx-1" />
            <KLangToggle lang={lang} setLang={setLang} />
            <KIconButton
              onClick={() => setSoundOn((s) => !s)}
              active={soundOn}
              label={soundOn ? 'Mute' : 'Unmute'}
            >
              <KIcon name={soundOn ? 'Volume2' : 'VolumeX'} className="w-5 h-5" />
            </KIconButton>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        {sortedTickets.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedTickets.map((tk) => {
              const isNew = now - tk.submitted_at.getTime() < 1500; // freshly arrived
              return (
                <div
                  key={tk.order_id}
                  className={isNew ? 'animate-slide-in-top rounded-2xl animate-amber-pulse' : 'animate-fade-in'}
                >
                  <TicketCard
                    ticket={tk}
                    lang={lang}
                    t={t}
                    now={now}
                    fading={fadingIds.has(tk.order_id)}
                    onAdvanceAll={() => advanceAll(tk.order_id)}
                    onOpenManage={() => setManageOrderId(tk.order_id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Demo controls */}
      <DemoControls
        open={demoOpen}
        setOpen={setDemoOpen}
        lang={lang}
        t={t}
        timeMultiplier={timeMultiplier}
        setTimeMultiplier={setTimeMultiplier}
        paused={paused}
        setPaused={setPaused}
        onInject={injectNewTicket}
      />

      {/* Manage items dialog */}
      <ManageItemsDialog
        open={!!manageTicket}
        ticket={manageTicket}
        lang={lang}
        t={t}
        onClose={() => setManageOrderId(null)}
        onAdvanceItem={(itemId) => advanceItem(manageTicket.order_id, itemId)}
      />
    </div>
  );
}

function EmptyState({ t }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-24 h-24 rounded-3xl bg-stone-100 inline-flex items-center justify-center text-stone-400">
        <KIcon name="ChefHat" className="w-12 h-12" strokeWidth={1.5} />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-stone-900">{t('empty_title')}</h2>
      <p className="mt-2 text-base text-stone-500">{t('empty_hint')}</p>
    </div>
  );
}

// ---------- Demo controls floating panel ----------
function DemoControls({
  open,
  setOpen,
  lang,
  t,
  timeMultiplier,
  setTimeMultiplier,
  paused,
  setPaused,
  onInject,
}) {
  const cycleSpeed = () => {
    const seq = [1, 10, 60];
    const idx = seq.indexOf(timeMultiplier);
    setTimeMultiplier(seq[(idx + 1) % seq.length]);
  };

  return (
    <div
      className={
        'fixed bottom-5 right-5 z-40 font-mono select-none transition-all ' +
        (open ? 'w-72' : 'w-auto')
      }
    >
      {open ? (
        <div className="bg-stone-950 text-stone-100 rounded-2xl border-2 border-dashed border-stone-600 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider">
                {t('demo_title')}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                {t('demo_subtitle')}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-400 hover:bg-stone-800 hover:text-white"
              aria-label="Collapse"
            >
              <KIcon name="Minus" className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <button
              onClick={onInject}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm font-semibold text-stone-100 flex items-center justify-between transition"
            >
              <span className="inline-flex items-center gap-2">
                <KIcon name="Zap" className="w-4 h-4" />
                {t('demo_inject')}
              </span>
              <span className="text-[10px] text-stone-400">▶</span>
            </button>

            <button
              onClick={cycleSpeed}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm font-semibold text-stone-100 flex items-center justify-between transition"
            >
              <span className="inline-flex items-center gap-2">
                <KIcon name="FastForward" className="w-4 h-4" />
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

            <button
              onClick={() => setPaused((p) => !p)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm font-semibold text-stone-100 flex items-center justify-between transition"
            >
              <span className="inline-flex items-center gap-2">
                <KIcon name={paused ? 'Play' : 'Pause'} className="w-4 h-4" />
                {paused ? t('demo_resume') : t('demo_pause')}
              </span>
              <span
                className={
                  'text-[10px] font-bold px-1.5 py-0.5 rounded ' +
                  (paused ? 'bg-red-500 text-white' : 'bg-emerald-500 text-stone-950')
                }
              >
                {paused ? 'OFF' : 'ON'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-stone-950 text-stone-100 rounded-full pl-3 pr-4 py-2 border-2 border-dashed border-stone-600 shadow-2xl text-xs font-bold uppercase tracking-wider hover:bg-stone-900 inline-flex items-center gap-2"
        >
          <KIcon name="Terminal" className="w-4 h-4" />
          {t('demo_title')}
        </button>
      )}
    </div>
  );
}

// Root
function KDSRoot() {
  return (
    <KToastProvider>
      <KDSApp />
    </KToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<KDSRoot />);
