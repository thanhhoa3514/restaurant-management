// Cashier UI primitives.

const { useState: _csuiState, useEffect: _csuiEffect, useRef: _csuiRef, useCallback: _csuiCb, useContext: _csuiCtx, createContext: _csuiCreate } = React;

// ---------- Icon (lucide) ----------
function CIcon({ name, className = 'w-5 h-5', strokeWidth = 2 }) {
  const ref = _csuiRef(null);
  _csuiEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const def = window.lucide.icons[name] || window.lucide.icons.Circle;
      const svg = window.lucide.createElement(def);
      svg.setAttribute('stroke-width', strokeWidth);
      svg.classList.add(...className.split(/\s+/).filter(Boolean));
      ref.current.appendChild(svg);
    }
  }, [name, className, strokeWidth]);
  return <span ref={ref} className="inline-flex items-center justify-center" aria-hidden="true" />;
}

// ---------- Button ----------
function CButton({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  loading,
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = {
    sm: 'text-sm px-3 py-2 min-h-[40px]',
    md: 'text-[15px] px-4 py-2.5 min-h-[44px]',
    lg: 'text-base px-5 py-3.5 min-h-[52px]',
  };
  const variants = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
    amber: 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    red: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    blue: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 hover:border-stone-400',
    danger_outline: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300',
    ghost: 'text-stone-700 hover:bg-stone-100',
    subtle: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
    link: 'text-amber-700 hover:text-amber-800 underline-offset-4 hover:underline px-0 min-h-0 py-0',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <CIcon name="Loader2" className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

// ---------- Card ----------
function CCard({ className = '', children, ...rest }) {
  return (
    <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------- Badge ----------
function CBadge({ tone = 'stone', className = '', children }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
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

// ---------- Input ----------
function CInput({ className = '', leading, trailing, ...rest }) {
  return (
    <div className="relative">
      {leading ? (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{leading}</span>
      ) : null}
      <input
        className={
          'w-full bg-white border border-stone-300 rounded-xl text-[15px] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 transition placeholder:text-stone-400 ' +
          (leading ? 'pl-9 pr-3 ' : 'px-3 ') +
          (trailing ? 'pr-9 ' : '') +
          'py-2.5 min-h-[44px] ' +
          className
        }
        {...rest}
      />
      {trailing ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">{trailing}</span>
      ) : null}
    </div>
  );
}

// ---------- Dialog ----------
function CDialog({ open, onClose, children, size = 'md', closeOnBackdrop = true }) {
  _csuiEffect(() => {
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
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div className={`relative w-full ${widths[size]} bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-fade-up`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function CDialogHeader({ title, subtitle, onClose }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-stone-200 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-lg font-bold text-stone-900 leading-tight">{title}</div>
        {subtitle ? <div className="text-sm text-stone-500 mt-1">{subtitle}</div> : null}
      </div>
      {onClose ? (
        <button
          onClick={onClose}
          className="w-9 h-9 -mr-1 -mt-1 rounded-full inline-flex items-center justify-center text-stone-500 hover:bg-stone-100"
          aria-label="Close"
        >
          <CIcon name="X" className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );
}

// ---------- Tooltip ----------
function CTooltip({ content, children, side = 'top' }) {
  const [open, setOpen] = _csuiState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          className={
            'absolute z-30 px-2.5 py-1.5 rounded-lg bg-stone-900 text-white text-[11px] font-medium leading-snug shadow-lg whitespace-nowrap pointer-events-none animate-fade-in ' +
            (side === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
              : 'top-full left-1/2 -translate-x-1/2 mt-1.5')
          }
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

// ---------- Lang toggle ----------
function CLangToggle({ lang, setLang }) {
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

// ---------- Stat pill (header) ----------
function CStatPill({ label, value, tone = 'stone' }) {
  const tones = {
    stone: 'border-stone-200 text-stone-700',
    amber: 'border-amber-200 text-amber-800 bg-amber-50',
    red: 'border-red-200 text-red-700 bg-red-50',
    emerald: 'border-emerald-200 text-emerald-800 bg-emerald-50',
  };
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 border bg-white text-sm shadow-sm ${tones[tone]}`}>
      <span className="font-medium text-stone-600">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

// ---------- Toast (Sonner-ish) ----------
const CToastCtx = _csuiCreate({ toast: () => {} });

function CToastProvider({ children }) {
  const [toasts, setToasts] = _csuiState([]);
  const toast = _csuiCb((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [
      ...t,
      { id, message, tone: opts.tone || 'dark', onClick: opts.onClick || null, icon: opts.icon || null },
    ]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3000);
  }, []);
  return (
    <CToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map((t) => {
          const tones = {
            dark: 'bg-stone-900 text-white',
            emerald: 'bg-emerald-600 text-white',
            amber: 'bg-amber-600 text-white',
            red: 'bg-red-600 text-white',
            blue: 'bg-blue-600 text-white',
          };
          return (
            <button
              key={t.id}
              onClick={t.onClick || undefined}
              className={
                'pointer-events-auto text-left flex items-center gap-3 rounded-2xl pl-3 pr-4 py-3 shadow-2xl animate-fade-up text-sm font-semibold ' +
                tones[t.tone] +
                ' ' +
                (t.onClick ? 'cursor-pointer hover:opacity-95' : 'cursor-default')
              }
            >
              {t.icon ? (
                <span className="w-7 h-7 rounded-full bg-white/15 inline-flex items-center justify-center">
                  <CIcon name={t.icon} className="w-4 h-4" />
                </span>
              ) : null}
              <span>{t.message}</span>
            </button>
          );
        })}
      </div>
    </CToastCtx.Provider>
  );
}

function useCToast() { return _csuiCtx(CToastCtx); }

// ---------- Skeleton ----------
function CSkeleton({ className = '' }) {
  return <div className={`bg-stone-200/80 animate-pulse rounded-xl ${className}`} />;
}

// ---------- Status pill (session status) ----------
function CSessionStatusPill({ status, t }) {
  const map = {
    dining: { tone: 'stone', label: t('status_dining'), dot: 'bg-stone-400' },
    bill_requested: { tone: 'red', label: t('status_bill_requested'), dot: 'bg-red-500' },
    in_payment: { tone: 'amber', label: t('status_in_payment'), dot: 'bg-amber-500' },
    paid: { tone: 'emerald', label: t('status_paid'), dot: 'bg-emerald-500' },
    closed: { tone: 'stone', label: t('status_closed'), dot: 'bg-stone-400' },
    voided: { tone: 'red', label: t('status_voided'), dot: 'bg-red-400' },
  };
  const c = map[status] || map.dining;
  return (
    <CBadge tone={c.tone}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </CBadge>
  );
}

Object.assign(window, {
  CIcon,
  CButton,
  CCard,
  CBadge,
  CInput,
  CDialog,
  CDialogHeader,
  CTooltip,
  CLangToggle,
  CStatPill,
  CToastProvider,
  useCToast,
  CSkeleton,
  CSessionStatusPill,
});
