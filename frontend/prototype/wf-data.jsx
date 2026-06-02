// Waiter Floor View — data, dictionary, seed tables, helpers.

const WF_DICT = {
  vi: {
    floor_view: 'Phòng phục vụ',
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    shift: 'Ca chiều',
    calls: 'Gọi nhân viên',
    ready: 'Sẵn sàng phục vụ',
    bills: 'Yêu cầu thanh toán',
    view_plan: 'Sơ đồ',
    view_grid: 'Lưới',
    occupied_summary: (occ, total) => `${occ}/${total} bàn có khách`,
    table: 'Bàn',
    empty: 'Bàn trống',
    guests: (n) => `${n} khách`,
    opened_at: 'Mở lúc',
    minutes: 'phút',
    waiting: 'Đã chờ',
    landmark_entrance: 'Cửa vào',
    landmark_cashier: 'Quầy thu ngân',
    landmark_kitchen: 'Cửa bếp',
    landmark_bar: 'Quầy bar',
    signal_call: 'Khách gọi nhân viên',
    signal_bill: 'Khách yêu cầu thanh toán',
    btn_acknowledge: 'Xác nhận',
    btn_notify_cashier: 'Báo thu ngân',
    ready_section: (n) => `Sẵn sàng phục vụ (${n} món)`,
    ready_since: 'Sẵn sàng',
    btn_mark_served: 'Đã phục vụ',
    btn_mark_all_served: 'Đã phục vụ tất cả',
    order_history: 'Lịch sử gọi món',
    order_placed_at: 'Gọi lúc',
    session_info: 'Thông tin phiên',
    subtotal_label: 'Tổng tạm tính',
    orders_placed: 'Số lượt gọi món',
    btn_request_bill: 'Yêu cầu thanh toán',
    confirm_bill_title: 'Yêu cầu thanh toán?',
    confirm_bill_desc: 'Hệ thống sẽ gửi yêu cầu đến thu ngân và đánh dấu phiên này đang chờ thanh toán.',
    cancel: 'Huỷ',
    confirm: 'Xác nhận',
    empty_table_cta: 'Mở phiên gọi món',
    open_session_title: 'Mở phiên cho khách walk-in',
    guest_count_label: 'Số khách',
    notes_label: 'Ghi chú',
    notes_placeholder: 'Ví dụ: khách quen, dị ứng hải sản...',
    btn_open_session: 'Mở phiên',
    // status names
    status_pending: 'Chờ',
    status_acknowledged: 'Đã nhận',
    status_preparing: 'Đang làm',
    status_ready: 'Sẵn sàng',
    status_served: 'Đã phục vụ',
    // toasts
    toast_acknowledged: (n) => `Đã xác nhận — đang đến bàn ${n}`,
    toast_bill_sent: 'Đã chuyển yêu cầu đến thu ngân',
    toast_served: (name, n) => `Đã phục vụ ${name} cho Bàn ${n}`,
    toast_all_served: (n) => `Đã phục vụ tất cả món cho Bàn ${n}`,
    toast_session_opened: (n) => `Đã mở phiên cho Bàn ${n}`,
    toast_event_call: (n) => `Bàn ${n} gọi nhân viên`,
    toast_event_ready: (n) => `Bàn ${n} có món sẵn sàng`,
    toast_event_bill: (n) => `Bàn ${n} yêu cầu thanh toán`,
    toast_event_new_session: (n) => `Khách mới ngồi Bàn ${n}`,
    // demo
    demo_title: 'Demo controls',
    demo_subtitle: 'chỉ hiện trong môi trường demo',
    demo_inject_ready: 'Inject: món sẵn sàng',
    demo_inject_call: 'Inject: gọi nhân viên',
    demo_inject_bill: 'Inject: yêu cầu thanh toán',
    demo_inject_session: 'Inject: phiên mới',
    demo_auto: 'Tự động',
    demo_speed: 'Tốc độ',
  },
  en: {
    floor_view: 'Floor View',
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    shift: 'Evening shift',
    calls: 'Calls',
    ready: 'Ready',
    bills: 'Bills',
    view_plan: 'Floor plan',
    view_grid: 'Grid',
    occupied_summary: (occ, total) => `${occ} of ${total} tables occupied`,
    table: 'Table',
    empty: 'Table empty',
    guests: (n) => `${n} guests`,
    opened_at: 'Opened at',
    minutes: 'min',
    waiting: 'Waiting',
    landmark_entrance: 'Entrance',
    landmark_cashier: 'Cashier counter',
    landmark_kitchen: 'Kitchen door',
    landmark_bar: 'Bar',
    signal_call: 'Customer called waiter',
    signal_bill: 'Customer requested bill',
    btn_acknowledge: 'Acknowledge',
    btn_notify_cashier: 'Notify cashier',
    ready_section: (n) => `Ready to serve (${n} items)`,
    ready_since: 'Ready',
    btn_mark_served: 'Mark served',
    btn_mark_all_served: 'Mark all served',
    order_history: 'Order history',
    order_placed_at: 'Placed at',
    session_info: 'Session info',
    subtotal_label: 'Subtotal',
    orders_placed: 'Orders placed',
    btn_request_bill: 'Request bill',
    confirm_bill_title: 'Request the bill?',
    confirm_bill_desc: 'This sends a request to the cashier and marks this session as awaiting payment.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    empty_table_cta: 'Open session',
    open_session_title: 'Open session for walk-in',
    guest_count_label: 'Guest count',
    notes_label: 'Notes',
    notes_placeholder: 'e.g. regular customer, seafood allergy...',
    btn_open_session: 'Open session',
    status_pending: 'Pending',
    status_acknowledged: 'Acknowledged',
    status_preparing: 'Preparing',
    status_ready: 'Ready',
    status_served: 'Served',
    toast_acknowledged: (n) => `Acknowledged — heading to Table ${n}`,
    toast_bill_sent: 'Bill request forwarded to cashier',
    toast_served: (name, n) => `Served ${name} for Table ${n}`,
    toast_all_served: (n) => `All items served for Table ${n}`,
    toast_session_opened: (n) => `Opened session for Table ${n}`,
    toast_event_call: (n) => `Table ${n} called waiter`,
    toast_event_ready: (n) => `Table ${n} has an item ready`,
    toast_event_bill: (n) => `Table ${n} requested the bill`,
    toast_event_new_session: (n) => `New guests at Table ${n}`,
    demo_title: 'Demo controls',
    demo_subtitle: 'visible only in demo mode',
    demo_inject_ready: 'Inject: item ready',
    demo_inject_call: 'Inject: call waiter',
    demo_inject_bill: 'Inject: bill request',
    demo_inject_session: 'Inject: new session',
    demo_auto: 'Auto events',
    demo_speed: 'Speed',
  },
};

// ---------- Status flow (matches kitchen) ----------
const WF_STATUS_FLOW = ['pending', 'acknowledged', 'preparing', 'ready', 'served'];

// ---------- Menu pool ----------
const WF_MENU = [
  { id: 'pho_bo_tai', name_vi: 'Phở bò tái', name_en: 'Rare beef pho',
    opts_vi: 'Tô lớn • Nhiều hành', opts_en: 'Large • Extra scallion', price: 75000 },
  { id: 'com_tam_suon', name_vi: 'Cơm tấm sườn nướng bì chả', name_en: 'Special broken rice',
    opts_vi: 'Thêm trứng • Nước mắm pha', opts_en: 'Extra egg • House fish sauce', price: 85000 },
  { id: 'bun_bo_hue', name_vi: 'Bún bò Huế', name_en: 'Huế-style beef noodle',
    opts_vi: 'Cay vừa • Thêm chả Huế', opts_en: 'Medium spice • Extra Huế sausage', price: 80000 },
  { id: 'banh_xeo', name_vi: 'Bánh xèo miền Tây', name_en: 'Mekong sizzling pancake',
    opts_vi: 'Tôm + thịt', opts_en: 'Shrimp + pork', price: 90000 },
  { id: 'mi_quang', name_vi: 'Mì Quảng', name_en: 'Quảng-style noodle',
    opts_vi: 'Gà + tôm', opts_en: 'Chicken + shrimp', price: 70000 },
  { id: 'goi_cuon', name_vi: 'Gỏi cuốn tôm thịt', name_en: 'Shrimp & pork spring rolls',
    opts_vi: 'Nước chấm đậu phộng', opts_en: 'Peanut dipping sauce', price: 50000 },
  { id: 'banh_mi', name_vi: 'Bánh mì thịt nướng', name_en: 'Grilled pork banh mi',
    opts_vi: 'Pate đặc biệt', opts_en: 'House pâté', price: 45000 },
  { id: 'cafe_sua_da', name_vi: 'Cà phê sữa đá', name_en: 'Iced milk coffee',
    opts_vi: 'Đá vừa • Ngọt 70%', opts_en: 'Normal ice • 70% sugar', price: 35000 },
  { id: 'tra_dao', name_vi: 'Trà đào cam sả', name_en: 'Peach lemongrass tea',
    opts_vi: 'Đá ít • Ngọt 50%', opts_en: 'Less ice • 50% sugar', price: 45000 },
  { id: 'nuoc_cam', name_vi: 'Nước cam tươi', name_en: 'Fresh orange juice',
    opts_vi: 'Không đường', opts_en: 'No sugar', price: 35000 },
  { id: 'sinh_to_bo', name_vi: 'Sinh tố bơ', name_en: 'Avocado smoothie',
    opts_vi: 'Sữa đặc', opts_en: 'Condensed milk', price: 50000 },
];

function wfDish(id) {
  return WF_MENU.find((m) => m.id === id);
}

// ---------- Table position layout (% of canvas) ----------
const WF_TABLE_LAYOUT = [
  // number, capacity, x%, y%
  { number: 1, capacity: 2, x: 22, y: 18 },
  { number: 2, capacity: 2, x: 34, y: 18 },
  { number: 3, capacity: 2, x: 64, y: 18 },
  { number: 4, capacity: 2, x: 76, y: 18 },
  { number: 5, capacity: 2, x: 88, y: 32 },
  { number: 6, capacity: 2, x: 88, y: 48 },
  { number: 7, capacity: 4, x: 24, y: 36 },
  { number: 8, capacity: 4, x: 36, y: 36 },
  { number: 9, capacity: 4, x: 50, y: 36 },
  { number: 10, capacity: 4, x: 64, y: 36 },
  { number: 11, capacity: 4, x: 76, y: 66 },
  { number: 12, capacity: 4, x: 24, y: 52 },
  { number: 13, capacity: 4, x: 36, y: 52 },
  { number: 14, capacity: 4, x: 50, y: 52 },
  { number: 15, capacity: 4, x: 64, y: 52 },
  { number: 16, capacity: 4, x: 76, y: 52 },
  { number: 17, capacity: 4, x: 50, y: 68 },
  { number: 18, capacity: 6, x: 22, y: 68 },
  { number: 19, capacity: 6, x: 22, y: 84 },
  { number: 20, capacity: 6, x: 38, y: 84 },
];

const WF_LANDMARKS = [
  // labelKey, x%, y%, w%, h%
  { key: 'landmark_kitchen', x: 40, y: 4, w: 20, h: 6, tone: 'stone' },
  { key: 'landmark_bar', x: 2, y: 30, w: 8, h: 36, tone: 'stone' },
  { key: 'landmark_entrance', x: 42, y: 94, w: 16, h: 5, tone: 'stone' },
  { key: 'landmark_cashier', x: 80, y: 86, w: 16, h: 10, tone: 'stone' },
];

// ---------- Status history helper ----------
function wfBuildHistory(currentStatus, submittedAt, now = new Date()) {
  const endIdx = WF_STATUS_FLOW.indexOf(currentStatus);
  if (endIdx < 0) return [{ status: 'pending', timestamp: new Date(submittedAt) }];
  const elapsed = Math.max(1, now - submittedAt);
  const step = elapsed / (endIdx + 1);
  const history = [];
  for (let i = 0; i <= endIdx; i++) {
    const ts = new Date(submittedAt.getTime() + Math.round(step * i));
    history.push({ status: WF_STATUS_FLOW[i], timestamp: ts });
  }
  return history;
}

let _wfItemId = 1;
function wfMakeItem(dishId, qty, status, submittedAt, opts = {}, readyAtOverride) {
  const dish = wfDish(dishId);
  const history = wfBuildHistory(status, submittedAt);
  // If we want a specific "ready" timestamp (so the waiter sees how long it's been waiting), override.
  if (readyAtOverride && status === 'ready') {
    const readyEntry = history.find((h) => h.status === 'ready');
    if (readyEntry) readyEntry.timestamp = readyAtOverride;
  }
  return {
    id: 'i' + _wfItemId++,
    name_vi: dish.name_vi,
    name_en: dish.name_en,
    qty,
    options_text_vi: opts.options_text_vi ?? dish.opts_vi,
    options_text_en: opts.options_text_en ?? dish.opts_en,
    notes: opts.notes || '',
    status,
    status_history: history,
    unit_price: dish.price,
  };
}

let _wfOrderId = 100;
function wfMakeOrder(submittedAt, items) {
  return {
    id: 'O' + _wfOrderId++,
    submitted_at: submittedAt,
    items,
  };
}

let _wfSessionId = 1000;
function wfMakeSession({ startedAt, guestCount, waiterCalledAt = null, billRequestedAt = null, orders = [] }) {
  return {
    id: 'S' + _wfSessionId++,
    started_at: startedAt,
    guest_count: guestCount,
    waiter_called_at: waiterCalledAt,
    bill_requested_at: billRequestedAt,
    orders,
  };
}

// ---------- Seed: 20 tables ----------
function wfBuildInitialTables(now = new Date()) {
  const at = (secAgo) => new Date(now.getTime() - secAgo * 1000);
  const tables = WF_TABLE_LAYOUT.map((t) => ({
    id: 'T' + t.number,
    number: t.number,
    capacity: t.capacity,
    position: { x_pct: t.x, y_pct: t.y },
    status: 'empty',
    session: null,
  }));

  const setSession = (num, session) => {
    const t = tables.find((x) => x.number === num);
    t.status = 'occupied';
    t.session = session;
  };

  // --- 6 occupied normal (no urgent signals, items mostly pre-ready) ---

  // T3: 2-top, small order, 15 min in
  setSession(3, wfMakeSession({
    startedAt: at(15 * 60),
    guestCount: 2,
    orders: [
      wfMakeOrder(at(14 * 60), [
        wfMakeItem('banh_mi', 1, 'preparing', at(14 * 60)),
        wfMakeItem('cafe_sua_da', 1, 'preparing', at(14 * 60)),
      ]),
    ],
  }));

  // T7: 4-top, medium 25 min
  setSession(7, wfMakeSession({
    startedAt: at(25 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(24 * 60), [
        wfMakeItem('com_tam_suon', 2, 'preparing', at(24 * 60)),
        wfMakeItem('pho_bo_tai', 1, 'preparing', at(24 * 60)),
        wfMakeItem('tra_dao', 3, 'acknowledged', at(24 * 60)),
      ]),
    ],
  }));

  // T8: 4-top, just ordered (5 min in)
  setSession(8, wfMakeSession({
    startedAt: at(5 * 60),
    guestCount: 3,
    orders: [
      wfMakeOrder(at(4 * 60 + 30), [
        wfMakeItem('mi_quang', 2, 'pending', at(4 * 60 + 30)),
        wfMakeItem('nuoc_cam', 2, 'pending', at(4 * 60 + 30)),
      ]),
    ],
  }));

  // T12: 4-top, ~30 min, two orders
  setSession(12, wfMakeSession({
    startedAt: at(30 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(28 * 60), [
        wfMakeItem('goi_cuon', 2, 'served', at(28 * 60)),
        wfMakeItem('banh_xeo', 1, 'served', at(28 * 60)),
      ]),
      wfMakeOrder(at(8 * 60), [
        wfMakeItem('bun_bo_hue', 2, 'preparing', at(8 * 60)),
        wfMakeItem('sinh_to_bo', 2, 'acknowledged', at(8 * 60)),
      ]),
    ],
  }));

  // T13: 4-top, 12 min, mid-meal
  setSession(13, wfMakeSession({
    startedAt: at(12 * 60),
    guestCount: 3,
    orders: [
      wfMakeOrder(at(11 * 60), [
        wfMakeItem('com_tam_suon', 3, 'preparing', at(11 * 60), { notes: 'Một phần không cay' }),
        wfMakeItem('cafe_sua_da', 3, 'preparing', at(11 * 60)),
      ]),
    ],
  }));

  // T15: 4-top, 22 min
  setSession(15, wfMakeSession({
    startedAt: at(22 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(21 * 60), [
        wfMakeItem('pho_bo_tai', 2, 'preparing', at(21 * 60)),
        wfMakeItem('banh_mi', 1, 'preparing', at(21 * 60)),
        wfMakeItem('tra_dao', 2, 'acknowledged', at(21 * 60)),
      ]),
    ],
  }));

  // --- 3 occupied with items ready (waiter focus) ---

  // T10: 4-top, 2 ready items waiting ~2 min
  setSession(10, wfMakeSession({
    startedAt: at(18 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(17 * 60), [
        wfMakeItem('pho_bo_tai', 2, 'ready', at(17 * 60), {}, at(2 * 60 + 15)),
        wfMakeItem('cafe_sua_da', 2, 'ready', at(17 * 60), {}, at(1 * 60 + 50)),
      ]),
    ],
  }));

  // T14: 4-top, 3 ready items, fresh ~30s
  setSession(14, wfMakeSession({
    startedAt: at(11 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(10 * 60 + 30), [
        wfMakeItem('com_tam_suon', 2, 'ready', at(10 * 60 + 30), {}, at(30)),
        wfMakeItem('goi_cuon', 1, 'ready', at(10 * 60 + 30), {}, at(45)),
        wfMakeItem('tra_dao', 2, 'ready', at(10 * 60 + 30), {}, at(20)),
      ]),
    ],
  }));

  // T20: 6-top, 1 ready item + remaining still preparing
  setSession(20, wfMakeSession({
    startedAt: at(20 * 60),
    guestCount: 6,
    orders: [
      wfMakeOrder(at(19 * 60), [
        wfMakeItem('banh_xeo', 2, 'ready', at(19 * 60), {}, at(4 * 60 + 10)),
        wfMakeItem('mi_quang', 2, 'preparing', at(19 * 60)),
        wfMakeItem('bun_bo_hue', 2, 'preparing', at(19 * 60), { notes: 'Cay nhiều' }),
        wfMakeItem('cafe_sua_da', 4, 'preparing', at(19 * 60)),
      ]),
    ],
  }));

  // --- 2 with call-waiter active ---

  // T4: 2-top, fresh call ~10s
  setSession(4, Object.assign(
    wfMakeSession({
      startedAt: at(8 * 60),
      guestCount: 2,
      orders: [
        wfMakeOrder(at(7 * 60), [
          wfMakeItem('bun_bo_hue', 2, 'preparing', at(7 * 60)),
          wfMakeItem('nuoc_cam', 2, 'preparing', at(7 * 60)),
        ]),
      ],
    }),
    { waiter_called_at: at(10) }
  ));

  // T17: 4-top, urgent call ~2 min
  setSession(17, Object.assign(
    wfMakeSession({
      startedAt: at(28 * 60),
      guestCount: 4,
      orders: [
        wfMakeOrder(at(27 * 60), [
          wfMakeItem('pho_bo_tai', 2, 'served', at(27 * 60)),
          wfMakeItem('com_tam_suon', 2, 'served', at(27 * 60)),
          wfMakeItem('cafe_sua_da', 4, 'served', at(27 * 60)),
        ]),
      ],
    }),
    { waiter_called_at: at(2 * 60 + 5) }
  ));

  // --- 1 with bill requested ---

  // T5: 2-top, bill requested
  setSession(5, Object.assign(
    wfMakeSession({
      startedAt: at(35 * 60),
      guestCount: 2,
      orders: [
        wfMakeOrder(at(34 * 60), [
          wfMakeItem('mi_quang', 2, 'served', at(34 * 60)),
          wfMakeItem('tra_dao', 2, 'served', at(34 * 60)),
        ]),
      ],
    }),
    { bill_requested_at: at(45) }
  ));

  return tables;
}

// ---------- Priority logic ----------
// Returns one of: 'call', 'ready', 'bill', 'idle', 'occupied', 'empty'
function wfPriorityOf(table, now) {
  if (table.status === 'empty' || !table.session) return 'empty';
  const s = table.session;
  if (s.waiter_called_at) return 'call';
  // Any items ready?
  const anyReady = s.orders.some((o) => o.items.some((it) => it.status === 'ready'));
  if (anyReady) return 'ready';
  if (s.bill_requested_at) return 'bill';
  // Idle = no activity in last 20 min (no order placed, no signal)
  const lastOrder = s.orders.length ? s.orders[s.orders.length - 1].submitted_at : s.started_at;
  if (now - lastOrder > 20 * 60 * 1000) return 'idle';
  return 'occupied';
}

// Sort key for grid view (lower = more urgent)
function wfPriorityRank(priority) {
  return ({ call: 0, ready: 1, bill: 2, idle: 3, occupied: 4, empty: 5 })[priority] ?? 6;
}

// Time-since-most-urgent-signal in seconds (for the bottom-of-tile time on the grid).
function wfTimeSinceSignal(table, priority, now) {
  if (!table.session) return null;
  const s = table.session;
  if (priority === 'call' && s.waiter_called_at)
    return Math.max(0, Math.floor((now - s.waiter_called_at) / 1000));
  if (priority === 'bill' && s.bill_requested_at)
    return Math.max(0, Math.floor((now - s.bill_requested_at) / 1000));
  if (priority === 'ready') {
    // earliest "ready since" across ready items
    let earliest = Infinity;
    for (const o of s.orders) {
      for (const it of o.items) {
        if (it.status === 'ready') {
          const h = it.status_history.find((x) => x.status === 'ready');
          if (h && h.timestamp.getTime() < earliest) earliest = h.timestamp.getTime();
        }
      }
    }
    if (earliest === Infinity) return null;
    return Math.max(0, Math.floor((now - earliest) / 1000));
  }
  if (priority === 'occupied' || priority === 'idle') {
    return Math.max(0, Math.floor((now - s.started_at) / 1000));
  }
  return null;
}

// ---------- Time formatting ----------
function wfFmtClock(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function wfFmtTimestamp(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function wfFmtHMS(seconds) {
  if (seconds == null) return '';
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function wfFmtMin(seconds) {
  return Math.max(0, Math.round(seconds / 60));
}

function wfFmtVND(amount) {
  const r = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r + 'đ';
}

// ---------- Web Audio chimes ----------
let _wfAudioCtx = null;
function wfAudio() {
  if (typeof window === 'undefined') return null;
  if (!_wfAudioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { _wfAudioCtx = new Ctor(); } catch (e) { return null; }
  }
  if (_wfAudioCtx.state === 'suspended') _wfAudioCtx.resume().catch(() => {});
  return _wfAudioCtx;
}

function wfPlayTones(notes) {
  const ctx = wfAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.value = n.freq;
    gain.gain.setValueAtTime(0.0001, now + n.start);
    gain.gain.exponentialRampToValueAtTime(n.peak ?? 0.18, now + n.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.dur + 0.02);
  }
}

// Urgent ding for "call waiter"
function wfPlayCallChime() {
  wfPlayTones([
    { freq: 1046.5, start: 0, dur: 0.09, peak: 0.22 }, // C6
    { freq: 1568, start: 0.1, dur: 0.13, peak: 0.22 }, // G6
  ]);
}
// Soft chime for "ready"
function wfPlayReadyChime() {
  wfPlayTones([
    { freq: 880, start: 0, dur: 0.13, peak: 0.16, type: 'sine' }, // A5
    { freq: 659.25, start: 0.13, dur: 0.18, peak: 0.16, type: 'sine' }, // E5
  ]);
}
// Neutral mid tone for "bill"
function wfPlayBillChime() {
  wfPlayTones([
    { freq: 783.99, start: 0, dur: 0.22, peak: 0.13, type: 'triangle' }, // G5
  ]);
}

Object.assign(window, {
  WF_DICT,
  WF_STATUS_FLOW,
  WF_MENU,
  WF_TABLE_LAYOUT,
  WF_LANDMARKS,
  wfDish,
  wfMakeItem,
  wfMakeOrder,
  wfMakeSession,
  wfBuildInitialTables,
  wfBuildHistory,
  wfPriorityOf,
  wfPriorityRank,
  wfTimeSinceSignal,
  wfFmtClock,
  wfFmtTimestamp,
  wfFmtHMS,
  wfFmtMin,
  wfFmtVND,
  wfPlayCallChime,
  wfPlayReadyChime,
  wfPlayBillChime,
});
