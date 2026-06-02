// KDS UI primitives — shadcn-style Button, Badge, Card, Separator, Dialog, Toast.

const { useEffect: _kuseEffect, useState: _kuseState, useRef: _kuseRef, useCallback: _kuseCallback, createContext: _kcreateContext, useContext: _kuseContext } = React;

// ---------- Button ----------
function KButton({
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
    md: 'text-[15px] px-4 py-2.5 min-h-[44px]',
    lg: 'text-base px-5 py-3.5 min-h-[56px]', // 56px+ primary action targets
  };
  const variants = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
    amber:
      'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20',
    emerald:
      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    red: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    outline:
      'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 hover:border-stone-400',
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
function KCard({ className = '', children, ...rest }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- Badge / pill ----------
function KBadge({ tone = 'stone', className = '', children }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    gray: 'bg-stone-100 text-stone-600 border-stone-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
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

// ---------- Separator ----------
function KSeparator({ className = '' }) {
  return <div className={`h-px w-full bg-stone-100 ${className}`} />;
}

// ---------- Dialog (centered modal) ----------
function KDialog({ open, onClose, children, className = '', size = 'lg' }) {
  _kuseEffect(() => {
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
  const widths = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full ${widths[size]} bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-fade-up ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function KDialogHeader({ title, subtitle, onClose }) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-stone-200 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xl font-bold text-stone-900 leading-tight">{title}</div>
        {subtitle ? <div className="text-sm text-stone-500 mt-1">{subtitle}</div> : null}
      </div>
      {onClose ? (
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full inline-flex items-center justify-center text-stone-500 hover:bg-stone-100"
          aria-label="Close"
        >
          <KIcon name="X" className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );
}

// ---------- Stat pill (header stats) ----------
function KStatPill({ dot, label, value }) {
  const dotColor = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
  }[dot] || 'bg-stone-400';
  return (
    <div className="inline-flex items-center gap-2.5 bg-white border border-stone-200 rounded-full pl-3 pr-4 py-1.5 shadow-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <span className="text-sm text-stone-600 font-medium">{label}</span>
      <span className="text-base font-bold text-stone-900 tabular-nums">{value}</span>
    </div>
  );
}

// ---------- Lang toggle ----------
function KLangToggle({ lang, setLang }) {
  return (
    <div className="inline-flex bg-stone-100 rounded-full p-0.5 text-xs font-semibold">
      {['vi', 'en'].map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={
            'px-3 py-1.5 rounded-full transition ' +
            (lang === code
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700')
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------- Icon button (header) ----------
function KIconButton({ onClick, label, children, active }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={
        'w-10 h-10 rounded-full inline-flex items-center justify-center border transition ' +
        (active
          ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50')
      }
    >
      {children}
    </button>
  );
}

// ---------- Toast (Sonner-ish) ----------
const KToastContext = _kcreateContext({ toast: () => {} });

function KToastProvider({ children }) {
  const [toasts, setToasts] = _kuseState([]);
  const toast = _kuseCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [
      ...t,
      { id, message, icon: opts.icon || 'Bell', tone: opts.tone || 'dark' },
    ]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, opts.duration || 2400);
  }, []);

  return (
    <KToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none max-w-md w-full px-4">
        {toasts.map((t) => {
          const tones = {
            dark: 'bg-stone-900 text-white',
            amber: 'bg-amber-500 text-white',
            emerald: 'bg-emerald-600 text-white',
            red: 'bg-red-600 text-white',
          };
          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl shadow-2xl px-4 py-3 text-sm font-semibold flex items-center gap-3 animate-fade-up ${tones[t.tone] || tones.dark}`}
            >
              <span className="w-7 h-7 rounded-full bg-white/15 inline-flex items-center justify-center">
                <KIcon name={t.icon} className="w-4 h-4" />
              </span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </KToastContext.Provider>
  );
}

function useKToast() {
  return _kuseContext(KToastContext);
}

Object.assign(window, {
  KButton,
  KCard,
  KBadge,
  KSeparator,
  KDialog,
  KDialogHeader,
  KStatPill,
  KLangToggle,
  KIconButton,
  KToastProvider,
  useKToast,
});
