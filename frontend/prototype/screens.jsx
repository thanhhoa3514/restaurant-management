// All 6 screens.

const { useEffect: _useEffect, useState: _useState, useMemo: _useMemo, useRef: _useRef } = React;

// ========== Top header (shared) ==========
function TopHeader({ lang, setLang, t, tableNumber, cartCount, onOpenCart, onBack, scrolled }) {
  return (
    <header
      className={
        'sticky top-0 z-30 transition-all ' +
        (scrolled
          ? 'bg-white/95 backdrop-blur border-b border-stone-200'
          : 'bg-stone-50/95 backdrop-blur border-b border-transparent')
      }
    >
      <div className="px-4 py-3 flex items-center gap-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-stone-700 hover:bg-stone-100"
            aria-label={t('back')}
          >
            <Icon name="ChevronLeft" className="w-5 h-5" />
          </button>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-stone-900 truncate leading-tight">
            {t('restaurant')}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1.5">
            <Icon name="MapPin" className="w-3 h-3" />
            {t('table')} {tableNumber}
          </div>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
        {onOpenCart ? (
          <button
            onClick={onOpenCart}
            className="relative w-10 h-10 rounded-full inline-flex items-center justify-center bg-white border border-stone-200 text-stone-800 hover:bg-stone-50 transition"
            aria-label={t('view_cart')}
          >
            <Icon name="ShoppingBag" className="w-5 h-5" />
            {cartCount > 0 ? (
              <span
                key={cartCount}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold inline-flex items-center justify-center animate-pulse-once"
              >
                {cartCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <div className="inline-flex bg-stone-100 rounded-full p-0.5 text-xs font-semibold">
      {['vi', 'en'].map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={
            'px-2.5 py-1 rounded-full transition ' +
            (lang === code ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ========== 1. QR LANDING ==========
function QRLanding({ t, lang, setLang, session, onStart }) {
  const now = useNow(30000);
  return (
    <div className="phone-shell animate-fade-in flex flex-col">
      {/* Top: lang toggle */}
      <div className="flex justify-end p-4">
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {/* Logo + name */}
      <div className="px-6 pt-2 pb-4 text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 inline-flex items-center justify-center text-white">
          <Icon name="UtensilsCrossed" className="w-10 h-10" strokeWidth={1.8} />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-stone-900 tracking-tight">
          {t('restaurant')}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{t('tagline')}</p>
      </div>

      {/* Table card */}
      <div className="px-5">
        <Card className="p-5 bg-gradient-to-br from-white to-amber-50/60">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('table')}
              </div>
              <div className="mt-1 text-5xl font-bold text-stone-900 tabular-nums leading-none">
                {session.table}
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 inline-flex items-center justify-center text-amber-700">
              <Icon name="QrCode" className="w-8 h-8" strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-stone-100">
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('area')}
              </div>
              <div className="mt-0.5 text-stone-900 font-medium">{t('floor')}</div>
            </div>
            <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-stone-100">
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('now')}
              </div>
              <div className="mt-0.5 text-stone-900 font-medium tabular-nums">
                {formatTime(now)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* CTA */}
      <div className="mt-auto px-5 pt-8 pb-8">
        <Button size="lg" className="w-full text-base" onClick={onStart}>
          {t('start_ordering')}
          <Icon name="ArrowRight" className="w-5 h-5" />
        </Button>
        <p className="mt-3 text-xs text-stone-500 text-center leading-relaxed">
          {t('session_hint')}
        </p>
      </div>
    </div>
  );
}

// ========== 2. MENU ==========
function MenuScreen({ t, lang, setLang, session, cart, onAddItem, onOpenCart, cartTotal }) {
  const [category, setCategory] = _useState('all');
  const [search, setSearch] = _useState('');
  const [scrolled, setScrolled] = _useState(false);
  const [loading, setLoading] = _useState(true);
  const [detailItem, setDetailItem] = _useState(null);

  _useEffect(() => {
    const id = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(id);
  }, []);

  _useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = _useMemo(() => {
    const q = search.trim().toLowerCase();
    return MENU.filter((m) => {
      if (category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return (
        m.name.vi.toLowerCase().includes(q) ||
        m.name.en.toLowerCase().includes(q) ||
        m.description.vi.toLowerCase().includes(q) ||
        m.description.en.toLowerCase().includes(q)
      );
    });
  }, [category, search]);

  const cartCount = cart.reduce((n, c) => n + c.qty, 0);

  return (
    <div className="phone-shell animate-fade-in pb-32">
      <TopHeader
        lang={lang}
        setLang={setLang}
        t={t}
        tableNumber={session.table}
        cartCount={cartCount}
        onOpenCart={onOpenCart}
        scrolled={scrolled}
      />

      {/* Sticky tabs + search */}
      <div className="sticky top-[60px] z-20 bg-stone-50/95 backdrop-blur pt-2 pb-3 px-4 border-b border-stone-200/70">
        <Tabs
          items={CATEGORIES.map((c) => ({ id: c.id, label: lang === 'vi' ? c.name_vi : c.name_en }))}
          value={category}
          onChange={setCategory}
          className="mb-3"
        />
        <div className="relative">
          <Icon
            name="Search"
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full bg-white border border-stone-200 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 pt-4">
        {loading ? (
          <MenuSkeleton />
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-stone-100 inline-flex items-center justify-center text-stone-400">
              <Icon name="SearchX" className="w-7 h-7" />
            </div>
            <p className="mt-3 text-sm text-stone-500">{t('no_results')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                lang={lang}
                t={t}
                onTap={() => item.is_available && setDetailItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom cart bar */}
      {cartCount > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="phone-shell pointer-events-auto px-4 pb-4">
            <button
              onClick={onOpenCart}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg shadow-amber-500/30 active:scale-[0.99] transition-all"
            >
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-white/20 inline-flex items-center justify-center text-white font-bold text-sm tabular-nums">
                  {cartCount}
                </span>
                <span className="font-semibold">{t('view_cart')}</span>
              </span>
              <span className="font-bold tabular-nums">{formatVND(cartTotal)}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Item detail sheet */}
      {detailItem ? (
        <ItemDetail
          item={detailItem}
          lang={lang}
          t={t}
          onClose={() => setDetailItem(null)}
          onAdd={(payload) => {
            onAddItem(payload);
            setDetailItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="w-full aspect-square rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-5 w-20 mt-1" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function MenuItemCard({ item, lang, t, onTap }) {
  const oos = !item.is_available;
  return (
    <button
      onClick={onTap}
      disabled={oos}
      className={
        'group text-left bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden transition-all ' +
        (oos
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-md hover:border-stone-300 active:scale-[0.99]')
      }
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={item.image}
          alt={item.name[lang]}
          loading="lazy"
          className={
            'w-full h-full object-cover transition-transform duration-500 ' +
            (oos ? 'grayscale' : 'group-hover:scale-[1.03]')
          }
        />
        {item.is_bestseller && !oos ? (
          <div className="absolute top-2 left-2">
            <Badge tone="orange" className="shadow-sm">
              <Icon name="Flame" className="w-3 h-3" />
              {t('bestseller')}
            </Badge>
          </div>
        ) : null}
        {oos ? (
          <div className="absolute inset-0 bg-stone-900/30 flex items-center justify-center">
            <Badge tone="stone" className="bg-white/95 backdrop-blur text-stone-800">
              {t('out_of_stock')}
            </Badge>
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <div className="font-semibold text-stone-900 text-[15px] leading-snug line-clamp-1">
          {item.name[lang]}
        </div>
        <div className="mt-1 text-xs text-stone-500 line-clamp-2 leading-relaxed min-h-[2.25rem]">
          {item.description[lang]}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="font-bold text-amber-600 tabular-nums">{formatVND(item.price)}</div>
          {!oos ? (
            <span className="w-7 h-7 rounded-full bg-stone-900 text-white inline-flex items-center justify-center group-hover:bg-amber-500 transition-colors">
              <Icon name="Plus" className="w-4 h-4" />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ========== 3. ITEM DETAIL ==========
function ItemDetail({ item, lang, t, onClose, onAdd }) {
  const [selections, setSelections] = _useState(() => defaultSelections(item));
  const [qty, setQty] = _useState(1);
  const [notes, setNotes] = _useState('');
  const [isDesktop, setIsDesktop] = _useState(() => window.matchMedia('(min-width: 768px)').matches);

  _useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const unitPrice = priceForItem(item, selections);
  const total = unitPrice * qty;

  const handleAdd = () => {
    onAdd({
      itemId: item.id,
      qty,
      selections,
      notes: notes.trim(),
      unitPrice,
    });
  };

  return (
    <Sheet open onClose={onClose} side={isDesktop ? 'center' : 'bottom'}>
      <div className="flex flex-col max-h-[92dvh]">
        {/* Hero */}
        <div className="relative">
          <img src={item.image} alt={item.name[lang]} className="w-full aspect-[16/10] object-cover" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 backdrop-blur shadow-lg inline-flex items-center justify-center text-stone-800 hover:bg-white"
            aria-label="Close"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
          {item.is_bestseller ? (
            <div className="absolute top-3 left-3">
              <Badge tone="orange" className="shadow-sm">
                <Icon name="Flame" className="w-3 h-3" />
                {t('bestseller')}
              </Badge>
            </div>
          ) : null}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-xl font-bold text-stone-900 leading-tight">{item.name[lang]}</h2>
            <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{item.description[lang]}</p>
            <div className="mt-3 text-2xl font-bold text-amber-600 tabular-nums">
              {formatVND(item.price)}
            </div>
          </div>

          <div className="border-t border-stone-100" />

          {/* Option groups */}
          <div className="px-5 py-4 space-y-5">
            {item.option_groups.map((group) => (
              <div key={group.id}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold text-stone-900">
                    {lang === 'vi' ? group.name_vi : group.name_en}
                  </h3>
                  {group.required ? (
                    <span className="text-[11px] text-amber-600 font-semibold">{t('required')}</span>
                  ) : null}
                </div>
                {group.type === 'single' ? (
                  <RadioGroup
                    options={group.options.map((o) => ({
                      id: o.id,
                      label: lang === 'vi' ? o.name_vi : o.name_en,
                      price_modifier: o.price_modifier,
                    }))}
                    value={selections[group.id]}
                    onChange={(v) => setSelections((s) => ({ ...s, [group.id]: v }))}
                    renderRight={(opt) =>
                      opt.price_modifier > 0
                        ? '+' + formatVND(opt.price_modifier)
                        : ''
                    }
                  />
                ) : (
                  <CheckboxGroup
                    options={group.options.map((o) => ({
                      id: o.id,
                      label: lang === 'vi' ? o.name_vi : o.name_en,
                      price_modifier: o.price_modifier,
                    }))}
                    value={selections[group.id]}
                    onChange={(v) => setSelections((s) => ({ ...s, [group.id]: v }))}
                    renderRight={(opt) =>
                      opt.price_modifier > 0
                        ? '+' + formatVND(opt.price_modifier)
                        : ''
                    }
                  />
                )}
              </div>
            ))}

            {/* Notes */}
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-2">{t('notes_label')}</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notes_placeholder')}
                rows={2}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
              />
            </div>

            {/* Qty */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-stone-900">{t('qty')}</span>
              <QtyStepper value={qty} onChange={setQty} />
            </div>
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div className="border-t border-stone-200 bg-white px-5 py-4">
          <Button size="lg" className="w-full" onClick={handleAdd}>
            <span>{t('add_to_cart')}</span>
            <span className="ml-auto tabular-nums">{formatVND(total)}</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ========== 4. CART SHEET ==========
function CartSheet({ open, onClose, cart, setCart, lang, t, onPlace, placing }) {
  const [isDesktop, setIsDesktop] = _useState(() => window.matchMedia('(min-width: 768px)').matches);
  _useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.qty, 0);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  const updateQty = (idx, newQty) => {
    setCart((c) =>
      c
        .map((line, i) => (i === idx ? { ...line, qty: newQty } : line))
        .filter((line) => line.qty > 0)
    );
  };

  const remove = (idx) => setCart((c) => c.filter((_, i) => i !== idx));

  return (
    <Sheet open={open} onClose={onClose} side={isDesktop ? 'right' : 'bottom'}>
      <div className="flex flex-col h-full md:h-[100dvh] max-h-[92dvh] md:max-h-none w-full">
        <SheetHeader
          title={t('your_cart')}
          subtitle={cart.length ? t('items_count', cart.reduce((n, c) => n + c.qty, 0)) : null}
          onClose={onClose}
        />

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 inline-flex items-center justify-center text-stone-400">
              <Icon name="ShoppingBag" className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <p className="mt-4 font-semibold text-stone-900">{t('empty_cart')}</p>
            <p className="mt-1 text-sm text-stone-500">{t('empty_cart_hint')}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {cart.map((line, idx) => {
                const item = MENU.find((m) => m.id === line.itemId);
                const optsSummary = summarizeOptions(item, line.selections, lang);
                return (
                  <Card key={idx} className="p-3 flex gap-3">
                    <img
                      src={item.image}
                      alt={item.name[lang]}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-900 text-[15px] leading-tight truncate">
                            {item.name[lang]}
                          </div>
                          {optsSummary ? (
                            <div className="mt-0.5 text-xs text-stone-500 leading-snug line-clamp-2">
                              {optsSummary}
                            </div>
                          ) : null}
                          {line.notes ? (
                            <div className="mt-1 text-xs text-amber-700 italic line-clamp-1">
                              "{line.notes}"
                            </div>
                          ) : null}
                        </div>
                        <button
                          onClick={() => remove(idx)}
                          className="-mr-1 -mt-1 w-8 h-8 rounded-full inline-flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-600 transition shrink-0"
                          aria-label="Remove"
                        >
                          <Icon name="Trash2" className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <QtyStepper
                          value={line.qty}
                          onChange={(q) => updateQty(idx, q)}
                          size="sm"
                          min={0}
                        />
                        <div className="font-bold text-stone-900 tabular-nums">
                          {formatVND(line.unitPrice * line.qty)}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="border-t border-stone-200 bg-white px-5 py-4 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>{t('subtotal')}</span>
                  <span className="tabular-nums">{formatVND(subtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>{t('vat')}</span>
                  <span className="tabular-nums">{formatVND(vat)}</span>
                </div>
                <div className="flex justify-between text-stone-900 font-bold text-base pt-1.5 border-t border-stone-100 mt-1.5">
                  <span>{t('total')}</span>
                  <span className="tabular-nums">{formatVND(total)}</span>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={cart.length === 0 || placing}
                loading={placing}
                onClick={onPlace}
              >
                {placing ? t('placing_order') : t('place_order')}
                {!placing ? <Icon name="ArrowRight" className="w-5 h-5" /> : null}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ========== 5. ORDER STATUS ==========
const STATUS_SEQUENCE = ['pending', 'preparing', 'ready', 'served'];

function statusBadge(status, t) {
  const map = {
    pending: { tone: 'gray', icon: 'Clock', label: t('status_pending') },
    preparing: { tone: 'amber', icon: 'CookingPot', label: t('status_preparing') },
    ready: { tone: 'green', icon: 'BellRing', label: t('status_ready') },
    served: { tone: 'stone', icon: 'Check', label: t('status_served') },
  };
  return map[status];
}

function OrderStatusScreen({ t, lang, setLang, session, orders, setOrders, onOrderMore, onSummary }) {
  // Find the latest order (it's the one whose items are progressing).
  const latest = orders[orders.length - 1];
  const [scrolled, setScrolled] = _useState(false);
  _useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Simulate progression: every 4–6s, advance one random not-yet-served item by one step.
  _useEffect(() => {
    if (!latest) return;
    let timeoutId;
    const tick = () => {
      setOrders((all) => {
        // operate on the most recent snapshot
        const lastIdx = all.length - 1;
        if (lastIdx < 0) return all;
        const order = all[lastIdx];
        const progressing = order.items
          .map((it, i) => ({ it, i }))
          .filter(({ it }) => it.status !== 'served');
        if (progressing.length === 0) return all;
        const pick = progressing[Math.floor(Math.random() * progressing.length)];
        const currentIdx = STATUS_SEQUENCE.indexOf(pick.it.status);
        const nextStatus = STATUS_SEQUENCE[Math.min(STATUS_SEQUENCE.length - 1, currentIdx + 1)];
        const newItems = order.items.slice();
        newItems[pick.i] = { ...pick.it, status: nextStatus };
        const newOrder = { ...order, items: newItems };
        const out = all.slice();
        out[lastIdx] = newOrder;
        return out;
      });
      timeoutId = setTimeout(tick, 4000 + Math.random() * 2000);
    };
    timeoutId = setTimeout(tick, 4000 + Math.random() * 2000);
    return () => clearTimeout(timeoutId);
  }, [orders.length]); // re-arm whenever a new order is added

  // Flatten items across all orders for display.
  const allItems = orders.flatMap((order, oi) =>
    order.items.map((it, ii) => ({ ...it, _orderIdx: oi, _itemIdx: ii, _placedAt: order.placedAt }))
  );

  return (
    <div className="phone-shell animate-fade-in pb-32">
      <TopHeader
        lang={lang}
        setLang={setLang}
        t={t}
        tableNumber={session.table}
        cartCount={0}
        scrolled={scrolled}
      />

      <div className="px-5 pt-4 pb-2">
        <h1 className="text-xl font-bold text-stone-900">{t('your_order')}</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {t('table')} {session.table} · {t('floor')}
        </p>
      </div>

      {/* Progress summary */}
      <div className="px-5 mt-2">
        <ProgressSummary items={allItems} t={t} />
      </div>

      {/* Timeline */}
      <div className="px-4 pt-4 space-y-2.5">
        {allItems.map((row) => {
          const item = MENU.find((m) => m.id === row.itemId);
          const opts = summarizeOptions(item, row.selections, lang);
          const s = statusBadge(row.status, t);
          return (
            <Card key={`${row._orderIdx}-${row._itemIdx}`} className="p-3 flex gap-3 items-start">
              <img
                src={item.image}
                alt={item.name[lang]}
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-stone-900 text-[15px] leading-tight truncate">
                    {item.name[lang]}
                    <span className="ml-1.5 text-stone-500 font-medium text-sm tabular-nums">
                      × {row.qty}
                    </span>
                  </div>
                </div>
                {opts ? (
                  <div className="mt-0.5 text-xs text-stone-500 leading-snug line-clamp-2">
                    {opts}
                  </div>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={s.tone}>
                    <Icon name={s.icon} className="w-3 h-3" />
                    {s.label}
                  </Badge>
                  <span className="text-[11px] text-stone-400 tabular-nums">
                    {formatTime(row._placedAt)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="phone-shell pointer-events-auto px-4 pb-4 pt-3 bg-gradient-to-t from-stone-50 via-stone-50/95 to-transparent">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={onOrderMore}>
              <Icon name="Plus" className="w-4 h-4" />
              {t('order_more')}
            </Button>
            <Button size="lg" onClick={onSummary}>
              <Icon name="Receipt" className="w-4 h-4" />
              {t('request_bill')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressSummary({ items, t }) {
  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    preparing: items.filter((i) => i.status === 'preparing').length,
    ready: items.filter((i) => i.status === 'ready').length,
    served: items.filter((i) => i.status === 'served').length,
  };
  const total = items.length;
  const tiles = [
    { key: 'preparing', label: t('status_preparing'), icon: 'CookingPot', tone: 'amber' },
    { key: 'ready', label: t('status_ready'), icon: 'BellRing', tone: 'green' },
    { key: 'served', label: t('status_served'), icon: 'Check', tone: 'stone' },
  ];
  return (
    <Card className="p-4">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => {
          const bg = {
            amber: 'bg-amber-50 text-amber-700',
            green: 'bg-emerald-50 text-emerald-700',
            stone: 'bg-stone-100 text-stone-700',
          }[tile.tone];
          return (
            <div key={tile.key} className="text-center">
              <div
                className={`mx-auto w-10 h-10 rounded-xl inline-flex items-center justify-center ${bg}`}
              >
                <Icon name={tile.icon} className="w-5 h-5" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-stone-900 tabular-nums leading-none">
                {counts[tile.key]}
                <span className="text-stone-300 text-base font-medium"> / {total}</span>
              </div>
              <div className="text-[11px] text-stone-500 mt-1 font-medium">{tile.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ========== 6. SESSION SUMMARY ==========
function SessionSummary({ t, lang, setLang, session, orders, onBack, onCallWaiter, onPay }) {
  const now = useNow(30000);
  const [expanded, setExpanded] = _useState(() => orders.map((_, i) => i === orders.length - 1));
  const [scrolled, setScrolled] = _useState(false);
  _useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const allLines = orders.flatMap((o) => o.items);
  const subtotal = allLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  const elapsedMin = Math.max(1, Math.floor((now - session.startedAt) / 60000));

  return (
    <div className="phone-shell animate-fade-in pb-36">
      <TopHeader
        lang={lang}
        setLang={setLang}
        t={t}
        tableNumber={session.table}
        cartCount={0}
        scrolled={scrolled}
        onBack={onBack}
      />

      <div className="px-5 pt-4 pb-2">
        <h1 className="text-xl font-bold text-stone-900">{t('session_summary')}</h1>
      </div>

      {/* Session card */}
      <div className="px-4 mt-2">
        <Card className="p-4 bg-gradient-to-br from-white to-amber-50/40">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('table')}
              </div>
              <div className="mt-0.5 font-bold text-stone-900 text-lg tabular-nums">
                {session.table}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('session_started')}
              </div>
              <div className="mt-0.5 font-bold text-stone-900 text-lg tabular-nums">
                {formatTime(session.startedAt)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('duration')}
              </div>
              <div className="mt-0.5 font-bold text-stone-900 text-lg tabular-nums">
                {elapsedMin} {t('minutes')}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders grouped */}
      <div className="px-4 mt-4">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold px-1 mb-2">
          {t('orders_history')}
        </div>
        <div className="space-y-2">
          {orders.map((order, oi) => {
            const orderSubtotal = order.items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
            const open = expanded[oi];
            return (
              <Card key={oi} className="overflow-hidden">
                <button
                  onClick={() =>
                    setExpanded((e) => e.map((v, i) => (i === oi ? !v : v)))
                  }
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold text-stone-900">
                      {t('submitted_at')} {formatTime(order.placedAt)}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {t('items_count', order.items.reduce((n, l) => n + l.qty, 0))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 tabular-nums text-sm">
                      {formatVND(orderSubtotal)}
                    </span>
                    <Icon
                      name="ChevronDown"
                      className={
                        'w-4 h-4 text-stone-400 transition-transform ' +
                        (open ? 'rotate-180' : '')
                      }
                    />
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-stone-100 px-4 py-3 space-y-2.5">
                    {order.items.map((line, li) => {
                      const item = MENU.find((m) => m.id === line.itemId);
                      const opts = summarizeOptions(item, line.selections, lang);
                      return (
                        <div key={li} className="flex gap-3 items-start">
                          <img
                            src={item.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-sm font-medium text-stone-900 truncate">
                                {item.name[lang]}
                                <span className="text-stone-400 font-normal"> × {line.qty}</span>
                              </div>
                              <div className="text-sm tabular-nums text-stone-700 shrink-0">
                                {formatVND(line.unitPrice * line.qty)}
                              </div>
                            </div>
                            {opts ? (
                              <div className="text-[11px] text-stone-500 leading-snug line-clamp-2">
                                {opts}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Running total */}
      <div className="px-4 mt-5">
        <Card className="p-5 bg-stone-900 text-white border-stone-900">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-stone-300">
              <span>{t('subtotal')}</span>
              <span className="tabular-nums">{formatVND(subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-300">
              <span>{t('vat')}</span>
              <span className="tabular-nums">{formatVND(vat)}</span>
            </div>
            <div className="h-px bg-stone-700 my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-base font-semibold">{t('total')}</span>
              <span className="text-3xl font-bold tabular-nums text-amber-400">
                {formatVND(total)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="phone-shell pointer-events-auto px-4 pb-4 pt-3 bg-gradient-to-t from-stone-50 via-stone-50/95 to-transparent">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={onCallWaiter}>
              <Icon name="Bell" className="w-4 h-4" />
              {t('call_waiter')}
            </Button>
            <Button size="lg" onClick={onPay}>
              <Icon name="CreditCard" className="w-4 h-4" />
              {t('pay_now')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  QRLanding,
  MenuScreen,
  ItemDetail,
  CartSheet,
  OrderStatusScreen,
  SessionSummary,
});
