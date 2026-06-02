// TicketCard + ManageItemsDialog (per-item status timeline) for the KDS.

const { useState: _ckuseState, useEffect: _ckuseEffect, useMemo: _ckuseMemo } = React;

// ---------- Urgency display ----------
const URGENCY_BORDER = {
  green: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
};
const URGENCY_PILL = {
  // soft tinted backgrounds, darker text from same family
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};
const URGENCY_DOT = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function urgencyLabel(urgency, t) {
  if (urgency === 'green') return t('urg_new');
  if (urgency === 'amber') return t('urg_normal');
  return t('urg_urgent');
}

// ---------- Item status chip ----------
function ItemStatusChip({ status, t }) {
  const map = {
    pending: { tone: 'gray', icon: 'Clock', label: t('status_pending') },
    acknowledged: { tone: 'blue', icon: 'Eye', label: t('status_acknowledged') },
    preparing: { tone: 'amber', icon: 'ChefHat', label: t('status_preparing') },
    ready: { tone: 'emerald', icon: 'CheckCircle2', label: t('status_ready') },
    served: { tone: 'stone', icon: 'CheckCheck', label: t('status_served') },
  };
  const c = map[status];
  return (
    <KBadge tone={c.tone} className="text-[13px] py-1.5 px-3">
      <KIcon name={c.icon} className="w-3.5 h-3.5" />
      {c.label}
    </KBadge>
  );
}

// ---------- Ticket card ----------
function TicketCard({ ticket, lang, t, now, onAdvanceAll, onOpenManage, fading }) {
  const submittedMs = ticket.submitted_at.getTime();
  const waitSec = Math.max(0, Math.floor((now - submittedMs) / 1000));
  const urgency = urgencyFor(waitSec);

  const allServed = ticket.items.every((it) => it.status === 'served');
  const min = minStatus(ticket.items.filter((it) => it.status !== 'served')) || 'served';

  // Bulk action label depending on minStatus across non-served items.
  let primaryLabel = '';
  let primaryVariant = 'primary';
  let primaryIcon = 'ArrowRight';
  if (allServed) {
    primaryLabel = t('btn_served');
  } else if (min === 'pending') {
    primaryLabel = t('btn_acknowledge');
    primaryIcon = 'Eye';
    primaryVariant = 'primary';
  } else if (min === 'acknowledged') {
    primaryLabel = t('btn_start');
    primaryIcon = 'ChefHat';
    primaryVariant = 'amber';
  } else if (min === 'preparing') {
    primaryLabel = t('btn_ready');
    primaryIcon = 'CheckCircle2';
    primaryVariant = 'emerald';
  } else if (min === 'ready') {
    primaryLabel = t('btn_served');
    primaryIcon = 'CheckCheck';
    primaryVariant = 'primary';
  }

  return (
    <div
      className={
        'relative bg-white rounded-2xl border border-stone-200 shadow-sm border-l-[6px] overflow-hidden flex flex-col transition ' +
        URGENCY_BORDER[urgency] +
        ' ' +
        (fading ? 'animate-fade-out pointer-events-none' : '')
      }
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[28px] font-bold text-stone-900 leading-none tracking-tight">
            {t('table')} {ticket.table_number}
          </div>
          <div className="mt-1 text-sm text-stone-500 truncate">
            {t('area')}: {lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en}
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-stone-700 font-mono font-semibold tabular-nums text-[17px]">
            <KIcon name="Clock" className="w-4 h-4 text-stone-500" />
            <span>{fmtHMS(waitSec)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={
              'inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ' +
              URGENCY_PILL[urgency] +
              ' ' +
              (urgency === 'red' ? 'animate-pulse-soft' : '')
            }
          >
            <span className={`w-2 h-2 rounded-full ${URGENCY_DOT[urgency]}`} />
            {urgencyLabel(urgency, t)}
          </span>
          <span className="text-[11px] font-mono text-stone-400 tracking-wide">
            {ticket.order_id}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 pb-3 flex-1">
        <div className="space-y-2">
          {ticket.items.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 ? <KSeparator /> : null}
              <ItemRow item={item} lang={lang} t={t} />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-stone-100 space-y-2">
        <KButton
          variant={primaryVariant}
          size="lg"
          className="w-full"
          onClick={onAdvanceAll}
          disabled={allServed}
        >
          <KIcon name={primaryIcon} className="w-5 h-5" />
          {primaryLabel}
        </KButton>
        <button
          onClick={onOpenManage}
          className="w-full text-center text-sm text-stone-500 hover:text-stone-800 font-medium py-1.5 rounded-lg transition"
        >
          {t('btn_manage')} →
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, lang, t }) {
  const opts = lang === 'vi' ? item.options_text_vi : item.options_text_en;
  const isServed = item.status === 'served';
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex items-start gap-2.5 min-w-0">
        {item.qty > 1 ? (
          <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-stone-900 text-white text-sm font-bold tabular-nums mt-0.5">
            ×{item.qty}
          </span>
        ) : (
          <span className="shrink-0 w-7 h-7" />
        )}
        <div className="min-w-0">
          <div
            className={
              'text-[18px] font-medium leading-tight ' +
              (isServed ? 'text-stone-400 line-through' : 'text-stone-900')
            }
          >
            {lang === 'vi' ? item.name_vi : item.name_en}
          </div>
          {opts ? (
            <div className={'text-sm leading-snug mt-0.5 ' + (isServed ? 'text-stone-300' : 'text-stone-500')}>
              {opts}
            </div>
          ) : null}
          {item.notes ? (
            <div className="mt-1 inline-flex items-start gap-1 text-[13px] text-amber-700 italic">
              <KIcon name="StickyNote" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{item.notes}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">
        <ItemStatusChip status={item.status} t={t} />
      </div>
    </div>
  );
}

// ---------- Per-item dialog (status_history timeline) ----------
function ManageItemsDialog({ open, ticket, lang, t, onClose, onAdvanceItem }) {
  const [expanded, setExpanded] = _ckuseState(() => new Set());

  // Reset expanded state when ticket changes.
  _ckuseEffect(() => {
    if (!ticket) return;
    setExpanded(new Set());
  }, [ticket?.order_id]);

  if (!ticket) return null;

  const toggle = (id) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <KDialog open={open} onClose={onClose} size="xl">
      <KDialogHeader
        title={KDS_DICT[lang].dlg_title(ticket.table_number, ticket.order_id)}
        subtitle={
          (lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en) +
          ' · ' +
          fmtTimestamp(ticket.submitted_at)
        }
        onClose={onClose}
      />
      <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
        {ticket.items.map((item) => {
          const isExpanded = expanded.has(item.id);
          const isLast = item.status === 'served';
          return (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              {/* Row */}
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {item.qty > 1 ? (
                    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-stone-900 text-white text-sm font-bold tabular-nums mt-0.5">
                      ×{item.qty}
                    </span>
                  ) : (
                    <span className="shrink-0 w-7 h-7" />
                  )}
                  <div className="min-w-0">
                    <div
                      className={
                        'text-[17px] font-semibold leading-tight ' +
                        (isLast ? 'text-stone-400 line-through' : 'text-stone-900')
                      }
                    >
                      {lang === 'vi' ? item.name_vi : item.name_en}
                    </div>
                    {(lang === 'vi' ? item.options_text_vi : item.options_text_en) ? (
                      <div className="text-sm text-stone-500 mt-0.5">
                        {lang === 'vi' ? item.options_text_vi : item.options_text_en}
                      </div>
                    ) : null}
                    {item.notes ? (
                      <div className="mt-1 inline-flex items-start gap-1 text-[13px] text-amber-700 italic">
                        <KIcon name="StickyNote" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{item.notes}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <ItemStatusChip status={item.status} t={t} />
                  <KButton
                    variant={isLast ? 'subtle' : 'primary'}
                    size="sm"
                    onClick={() => onAdvanceItem(item.id)}
                    disabled={isLast}
                  >
                    {isLast ? t('dlg_no_advance') : t('dlg_advance')}
                    {!isLast ? <KIcon name="ArrowRight" className="w-4 h-4" /> : null}
                  </KButton>
                </div>
              </div>

              {/* Timeline toggle */}
              <button
                onClick={() => toggle(item.id)}
                className="w-full px-4 py-2 border-t border-stone-100 flex items-center justify-between text-sm text-stone-500 hover:bg-stone-50 transition"
              >
                <span className="font-medium inline-flex items-center gap-1.5">
                  <KIcon name="History" className="w-4 h-4" />
                  {t('dlg_timeline')} ({item.status_history.length})
                </span>
                <KIcon
                  name="ChevronDown"
                  className={'w-4 h-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')}
                />
              </button>

              {isExpanded ? (
                <div className="px-4 pb-4 pt-1 bg-stone-50/60 border-t border-stone-100">
                  <Timeline history={item.status_history} t={t} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 border-t border-stone-200 flex justify-end bg-stone-50">
        <KButton variant="outline" onClick={onClose}>
          {lang === 'vi' ? 'Đóng' : 'Close'}
        </KButton>
      </div>
    </KDialog>
  );
}

function Timeline({ history, t }) {
  const HISTORY_ICON = {
    pending: 'Clock',
    acknowledged: 'Eye',
    preparing: 'ChefHat',
    ready: 'CheckCircle2',
    served: 'CheckCheck',
  };
  const HISTORY_TONE = {
    pending: 'text-stone-500 bg-stone-200',
    acknowledged: 'text-blue-700 bg-blue-100',
    preparing: 'text-amber-700 bg-amber-100',
    ready: 'text-emerald-700 bg-emerald-100',
    served: 'text-stone-500 bg-stone-200',
  };
  const labelKey = (s) => 'hist_' + s;
  return (
    <ol className="relative pl-1 mt-2 space-y-3">
      {history.map((h, i) => {
        const isLast = i === history.length - 1;
        return (
          <li key={i} className="relative flex items-start gap-3">
            <div className="relative flex flex-col items-center">
              <span
                className={
                  'w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 ' +
                  HISTORY_TONE[h.status]
                }
              >
                <KIcon name={HISTORY_ICON[h.status]} className="w-3.5 h-3.5" />
              </span>
              {!isLast ? <span className="w-px flex-1 bg-stone-300 mt-1 mb-[-12px] min-h-[18px]" /> : null}
            </div>
            <div className="flex-1 pt-0.5 pb-1">
              <div className="text-[13px] text-stone-500 font-mono tabular-nums">
                {fmtTimestamp(h.timestamp)}
              </div>
              <div className="text-[15px] font-semibold text-stone-900 leading-tight">
                {t(labelKey(h.status))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

Object.assign(window, {
  TicketCard,
  ManageItemsDialog,
  ItemStatusChip,
});
