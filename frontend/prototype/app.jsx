// Main App — manages currentScreen state and global app state.

const { useState: __useState, useCallback: __useCallback, useEffect: __useEffect } = React;

function App() {
  const [lang, setLang] = __useState('vi');
  const [screen, setScreen] = __useState('qr'); // 'qr' | 'menu' | 'order' | 'summary'
  const [cartOpen, setCartOpen] = __useState(false);
  const [placing, setPlacing] = __useState(false);

  const [session] = __useState(() => ({
    token: 'tbl-12-' + Math.random().toString(36).slice(2, 8),
    table: 12,
    startedAt: new Date(),
  }));

  // Cart line: { itemId, qty, selections, notes, unitPrice }
  const [cart, setCart] = __useState([]);

  // Orders: [{ placedAt, items: [{ itemId, qty, selections, notes, unitPrice, status }] }]
  const [orders, setOrders] = __useState([]);

  const { toast } = useToast();

  const t = __useCallback(
    (key, ...args) => {
      const entry = DICT[lang][key];
      if (typeof entry === 'function') return entry(...args);
      return entry ?? key;
    },
    [lang]
  );

  // Scroll to top on screen change
  __useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0);

  const handleAddItem = (payload) => {
    // Merge with identical existing line (same item + selections + notes), otherwise append.
    setCart((cur) => {
      const keyOf = (l) =>
        l.itemId +
        '|' +
        JSON.stringify(l.selections) +
        '|' +
        (l.notes || '');
      const newKey = keyOf(payload);
      const idx = cur.findIndex((l) => keyOf(l) === newKey);
      if (idx >= 0) {
        const next = cur.slice();
        next[idx] = { ...next[idx], qty: next[idx].qty + payload.qty };
        return next;
      }
      return [...cur, payload];
    });
    toast(t('toast_added'), { icon: 'Check' });
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    setPlacing(true);
    setTimeout(() => {
      setOrders((prev) => [
        ...prev,
        {
          placedAt: new Date(),
          items: cart.map((line) => ({ ...line, status: 'pending' })),
        },
      ]);
      setCart([]);
      setPlacing(false);
      setCartOpen(false);
      setScreen('order');
      toast(t('toast_order_placed'), { icon: 'CookingPot' });
    }, 1000);
  };

  const handleCallWaiter = () => toast(t('toast_waiter'), { icon: 'Bell' });
  const handleRequestBill = () => toast(t('toast_bill'), { icon: 'CreditCard' });

  return (
    <>
      {screen === 'qr' ? (
        <QRLanding
          t={t}
          lang={lang}
          setLang={setLang}
          session={session}
          onStart={() => setScreen('menu')}
        />
      ) : null}

      {screen === 'menu' ? (
        <MenuScreen
          t={t}
          lang={lang}
          setLang={setLang}
          session={session}
          cart={cart}
          cartTotal={cartTotal}
          onAddItem={handleAddItem}
          onOpenCart={() => setCartOpen(true)}
        />
      ) : null}

      {screen === 'order' ? (
        <OrderStatusScreen
          t={t}
          lang={lang}
          setLang={setLang}
          session={session}
          orders={orders}
          setOrders={setOrders}
          onOrderMore={() => setScreen('menu')}
          onSummary={() => setScreen('summary')}
        />
      ) : null}

      {screen === 'summary' ? (
        <SessionSummary
          t={t}
          lang={lang}
          setLang={setLang}
          session={session}
          orders={orders}
          onBack={() => setScreen('order')}
          onCallWaiter={handleCallWaiter}
          onPay={handleRequestBill}
        />
      ) : null}

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        setCart={setCart}
        lang={lang}
        t={t}
        placing={placing}
        onPlace={handlePlaceOrder}
      />
    </>
  );
}

function Root() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
