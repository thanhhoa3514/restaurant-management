// Waiter Floor View — UI primitives. NO icons (text + colored shapes only).

const { useState: _wuiState, useEffect: _wuiEffect, useCallback: _wuiCallback, useContext: _wuiContext, createContext: _wuiCreateCtx } = React;

// ---------- Button ----------
function WButton({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-900 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = {
    sm: 'text-sm px-3 py-2 min-h-[40px]',
    md: 'text-[15px] px-4 py-3 min-h-[48px]',
    lg: 'text-base px-5 py-3.5 min-h-[56px]',
  };
  const variants = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
    amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    red: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    blue: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 hover:border-stone-400',
    ghost: 'text-stone-700 hover:bg-stone-100',
    subtle: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Card ----------
function WCard({ className = '', children, ...rest }) {
  return (
    <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------- Badge ----------
function WBadge({ tone = 'stone', className = '', children }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    gray: 'bg-stone-100 text-stone-600 border-stone-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    dark: 'bg-stone-900 text-white border-stone-900',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ---------- Pill counter (header) ----------
function WCounterPill({ tone, label, value }) {
  if (!value) return null;
  const tones = {
    red: 'bg-red-500 text-white border-red-500 ring-red-200',
    emerald: 'bg-emerald-500 text-white border-emerald-500 ring-emerald-200',
    blue: 'bg-blue-500 text-white border-blue-500 ring-blue-200',
  };
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full pl-3 pr-1 py-1 border shadow-sm font-semibold text-sm ${tones[tone]}`}
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-white/25 text-white text-sm font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ---------- Lang toggle ----------
function WLangToggle({ lang, setLang }) {
  return (
    <div className="inline-flex bg-stone-100 rounded-full p-0.5 text-xs font-semibold">
      {['vi', 'en'].map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={
            'px-3 py-1.5 rounded-full transition ' +
            (lang === code ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------- Sound toggle (no icon — text label) ----------
function WSoundToggle({ on, setOn }) {
  return (
    <button
      onClick={() => setOn((s) => !s)}
      className={
        'min-h-[40px] px-3.5 rounded-full text-xs font-bold uppercase tracking-wider border transition flex items-center gap-2 ' +
        (on
          ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
          : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50')
      }
      aria-label={on ? 'Mute' : 'Unmute'}
    >
      <span
        className={
          'inline-block w-2 h-2 rounded-full ' +
          (on ? 'bg-emerald-400' : 'bg-stone-300')
        }
      />
      Sound
    </button>
  );
}

// ---------- View tabs (Floor plan / Grid) ----------
function WViewTabs({ value, onChange, items }) {
  return (
    <div className="inline-flex bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={
              'px-4 py-2 rounded-lg text-sm font-semibold transition min-h-[40px] ' +
              (active ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50')
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Right-side Sheet ----------
function WSheet({ open, onClose, children, width = 'w-[28rem]' }) {
  _wuiEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 bottom-0 ${width} max-w-full bg-white shadow-2xl flex flex-col animate-slide-in-right`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------- Centered Dialog (smaller confirm) ----------
function WDialog({ open, onClose, children, size = 'md' }) {
  _wuiEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' };
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-stone-900/50 animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-up`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------- Toast (Sonner-ish) ----------
const WToastCtx = _wuiCreateCtx({ toast: () => {} });

function WToastProvider({ children }) {
  const [toasts, setToasts] = _wuiState([]);
  const toast = _wuiCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [
      ...t,
      { id, message, tone: opts.tone || 'dark', accent: opts.accent || null, onClick: opts.onClick || null },
    ]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 2800);
  }, []);
  return (
    <WToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map((t) => {
          const accent = {
            red: 'bg-red-500',
            emerald: 'bg-emerald-500',
            blue: 'bg-blue-500',
            amber: 'bg-amber-500',
          }[t.accent];
          return (
            <button
              key={t.id}
              onClick={t.onClick || undefined}
              className={
                'pointer-events-auto text-left flex items-center gap-3 bg-stone-900 text-white rounded-2xl pl-3 pr-4 py-3 shadow-2xl animate-fade-up text-sm font-semibold ' +
                (t.onClick ? 'cursor-pointer hover:bg-stone-800' : 'cursor-default')
              }
            >
              {accent ? <span className={`w-2.5 h-2.5 rounded-full ${accent} shrink-0`} /> : null}
              <span>{t.message}</span>
            </button>
          );
        })}
      </div>
    </WToastCtx.Provider>
  );
}

function useWToast() { return _wuiContext(WToastCtx); }

Object.assign(window, {
  WButton,
  WCard,
  WBadge,
  WCounterPill,
  WLangToggle,
  WSoundToggle,
  WViewTabs,
  WSheet,
  WDialog,
  WToastProvider,
  useWToast,
});
