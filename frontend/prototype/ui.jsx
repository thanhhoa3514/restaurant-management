// Shared UI primitives — lightweight shadcn-style components built on Tailwind.
// All exported to window.

const { useEffect, useState, useRef, useCallback, useMemo, createContext, useContext } = React;

// ---------- Lucide icon helper ----------
function Icon({ name, className = 'w-5 h-5', strokeWidth = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const svg = window.lucide.createElement(window.lucide.icons[name] || window.lucide.icons.Circle);
      svg.setAttribute('stroke-width', strokeWidth);
      svg.classList.add(...className.split(/\s+/).filter(Boolean));
      ref.current.appendChild(svg);
    }
  }, [name, className, strokeWidth]);
  return <span ref={ref} className="inline-flex items-center justify-center" aria-hidden="true" />;
}

// ---------- Button ----------
function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  loading,
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-150 select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-current ' +
    'active:scale-[0.98]';
  const sizes = {
    sm: 'text-sm px-3 py-2',
    md: 'text-[15px] px-4 py-3',
    lg: 'text-base px-5 py-4',
  };
  const variants = {
    primary:
      'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none',
    secondary: 'bg-stone-900 text-white hover:bg-stone-800',
    outline:
      'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 hover:border-stone-400',
    ghost: 'text-stone-700 hover:bg-stone-100',
    danger: 'text-red-600 hover:bg-red-50',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

// ---------- Card ----------
function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- Badge ----------
function Badge({ tone = 'stone', className = '', children }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    orange: 'bg-orange-500 text-white border-orange-500',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    gray: 'bg-stone-100 text-stone-500 border-stone-200',
    red: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ---------- Skeleton ----------
function Skeleton({ className = '' }) {
  return <div className={`bg-stone-200/80 animate-pulse rounded-xl ${className}`} />;
}

// ---------- Sheet (bottom on mobile, side/right or center for dialogs) ----------
function Sheet({ open, onClose, children, side = 'bottom', className = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sidePos = {
    bottom: 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl animate-slide-up',
    right: 'inset-y-0 right-0 w-full max-w-md animate-slide-in-right',
    center:
      'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-lg rounded-3xl animate-fade-up',
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-stone-900/50 animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`absolute bg-white shadow-2xl flex flex-col overflow-hidden ${sidePos[side]} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function SheetHeader({ title, subtitle, onClose, sticky = true }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-stone-200 bg-white ${sticky ? 'sticky top-0 z-10' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-stone-900 truncate">{title}</div>
        {subtitle ? <div className="text-xs text-stone-500 mt-0.5">{subtitle}</div> : null}
      </div>
      {onClose ? (
        <button
          className="-mr-1 -mt-1 w-9 h-9 rounded-full inline-flex items-center justify-center text-stone-500 hover:bg-stone-100"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="X" className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );
}

// ---------- Tabs (horizontal scrolling pill tabs) ----------
function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-2 overflow-x-auto no-scrollbar ${className}`}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={
              'shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-150 ' +
              (active
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300 hover:bg-stone-50')
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Quantity stepper ----------
function QtyStepper({ value, onChange, min = 1, max = 99, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-lg';
  const txt = size === 'sm' ? 'w-7 text-sm' : 'w-8 text-[15px]';
  const btn =
    'inline-flex items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition';
  return (
    <div className="inline-flex items-center gap-2">
      <button
        className={`${btn} ${sz}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Icon name="Minus" className="w-4 h-4" />
      </button>
      <span className={`text-center font-semibold tabular-nums ${txt}`}>{value}</span>
      <button
        className={`${btn} ${sz}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase"
      >
        <Icon name="Plus" className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------- Radio group ----------
function RadioGroup({ options, value, onChange, renderRight }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition ' +
              (active
                ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/50'
                : 'bg-white border-stone-200 hover:border-stone-300')
            }
          >
            <span className="flex items-center gap-3 text-left">
              <span
                className={
                  'w-5 h-5 rounded-full border-2 inline-flex items-center justify-center shrink-0 ' +
                  (active ? 'border-amber-600' : 'border-stone-300')
                }
              >
                {active ? <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> : null}
              </span>
              <span className="text-[15px] text-stone-900 font-medium">{opt.label}</span>
            </span>
            {renderRight ? <span className="text-sm text-stone-500 tabular-nums">{renderRight(opt)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Checkbox group ----------
function CheckboxGroup({ options, value, onChange, renderRight }) {
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const active = value.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition ' +
              (active
                ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/50'
                : 'bg-white border-stone-200 hover:border-stone-300')
            }
          >
            <span className="flex items-center gap-3 text-left">
              <span
                className={
                  'w-5 h-5 rounded-md border-2 inline-flex items-center justify-center shrink-0 transition ' +
                  (active ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-300')
                }
              >
                {active ? <Icon name="Check" className="w-3.5 h-3.5" /> : null}
              </span>
              <span className="text-[15px] text-stone-900 font-medium">{opt.label}</span>
            </span>
            {renderRight ? <span className="text-sm text-stone-500 tabular-nums">{renderRight(opt)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Toast (Sonner-ish) ----------
const ToastContext = createContext({ toast: () => {} });

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, icon: opts.icon || 'Check', tone: opts.tone || 'amber' }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, opts.duration || 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-3 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-stone-900 text-white text-sm px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-fade-up max-w-sm"
          >
            <span
              className={
                'w-6 h-6 rounded-full inline-flex items-center justify-center ' +
                (t.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500')
              }
            >
              <Icon name={t.icon} className="w-3.5 h-3.5" />
            </span>
            <span className="font-medium">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

// ---------- Hooks ----------
function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

Object.assign(window, {
  Icon,
  Button,
  Card,
  Badge,
  Skeleton,
  Sheet,
  SheetHeader,
  Tabs,
  QtyStepper,
  RadioGroup,
  CheckboxGroup,
  ToastProvider,
  useToast,
  useNow,
});
