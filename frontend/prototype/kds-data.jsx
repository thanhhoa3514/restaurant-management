// KDS data + helpers — i18n dictionary, mock tickets, sound (Web Audio), Icon wrapper.

const KDS_DICT = {
  vi: {
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    kitchen_display: 'Màn hình bếp',
    pending_count: 'Đang chờ',
    preparing_count: 'Đang làm',
    ready_count: 'Sẵn sàng',
    empty_title: 'Chưa có đơn nào',
    empty_hint: 'Đơn mới sẽ xuất hiện tại đây',
    table: 'Bàn',
    area: 'Khu vực',
    // urgency
    urg_new: 'Mới',
    urg_normal: 'Bình thường',
    urg_urgent: 'Khẩn cấp',
    // item statuses
    status_pending: 'Chờ',
    status_acknowledged: 'Đã nhận',
    status_preparing: 'Đang làm',
    status_ready: 'Sẵn sàng',
    status_served: 'Đã phục vụ',
    // history labels
    hist_pending: 'Tạo đơn',
    hist_acknowledged: 'Đã nhận',
    hist_preparing: 'Bắt đầu chế biến',
    hist_ready: 'Sẵn sàng',
    hist_served: 'Đã phục vụ',
    // bulk action buttons
    btn_acknowledge: 'Xác nhận đơn',
    btn_start: 'Bắt đầu chế biến',
    btn_ready: 'Đánh dấu sẵn sàng',
    btn_served: 'Đã phục vụ',
    btn_manage: 'Quản lý từng món',
    // dialog
    dlg_title: (table, oid) => `Bàn ${table} — ${oid}`,
    dlg_advance: 'Chuyển trạng thái',
    dlg_timeline: 'Lịch sử trạng thái',
    dlg_no_advance: 'Đã hoàn tất',
    // toasts
    toast_new_order: (table) => `Đơn mới từ Bàn ${table}`,
    toast_acknowledged: (table) => `Đã xác nhận đơn Bàn ${table}`,
    toast_start: (table) => `Đã bắt đầu chế biến Bàn ${table}`,
    toast_ready: (table) => `Bàn ${table} sẵn sàng phục vụ`,
    toast_served: (table) => `Bàn ${table} đã phục vụ`,
    toast_item_advanced: (name) => `${name} chuyển trạng thái`,
    // demo controls
    demo_title: 'Demo controls',
    demo_subtitle: 'không hiện trong production',
    demo_inject: 'Tạo đơn mới',
    demo_speed: 'Tốc độ',
    demo_pause: 'Tạm dừng tự động',
    demo_resume: 'Bật tự động',
  },
  en: {
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    kitchen_display: 'Kitchen Display',
    pending_count: 'Pending',
    preparing_count: 'Preparing',
    ready_count: 'Ready',
    empty_title: 'No orders yet',
    empty_hint: 'New orders will appear here',
    table: 'Table',
    area: 'Area',
    urg_new: 'New',
    urg_normal: 'Normal',
    urg_urgent: 'Urgent',
    status_pending: 'Pending',
    status_acknowledged: 'Acknowledged',
    status_preparing: 'Preparing',
    status_ready: 'Ready',
    status_served: 'Served',
    hist_pending: 'Order created',
    hist_acknowledged: 'Acknowledged',
    hist_preparing: 'Started preparing',
    hist_ready: 'Ready',
    hist_served: 'Served',
    btn_acknowledge: 'Acknowledge order',
    btn_start: 'Start preparing',
    btn_ready: 'Mark ready',
    btn_served: 'Mark served',
    btn_manage: 'Manage items individually',
    dlg_title: (table, oid) => `Table ${table} — ${oid}`,
    dlg_advance: 'Advance',
    dlg_timeline: 'Status history',
    dlg_no_advance: 'Completed',
    toast_new_order: (table) => `New order from Table ${table}`,
    toast_acknowledged: (table) => `Acknowledged Table ${table}`,
    toast_start: (table) => `Started preparing Table ${table}`,
    toast_ready: (table) => `Table ${table} ready for pickup`,
    toast_served: (table) => `Table ${table} served`,
    toast_item_advanced: (name) => `${name} status advanced`,
    demo_title: 'Demo controls',
    demo_subtitle: 'hidden in production',
    demo_inject: 'Inject new order',
    demo_speed: 'Time',
    demo_pause: 'Pause auto-injection',
    demo_resume: 'Resume auto-injection',
  },
};

const STATUS_FLOW = ['pending', 'acknowledged', 'preparing', 'ready', 'served'];

function nextStatus(s) {
  const idx = STATUS_FLOW.indexOf(s);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return s;
  return STATUS_FLOW[idx + 1];
}

function minStatus(items) {
  // Returns the earliest (lowest index) status among the items.
  let minIdx = STATUS_FLOW.length;
  for (const it of items) {
    const i = STATUS_FLOW.indexOf(it.status);
    if (i < minIdx) minIdx = i;
  }
  return STATUS_FLOW[minIdx];
}

// Dish catalog — names + typical option strings to draw from for new injected orders.
const DISHES = [
  { id: 'pho-bo-tai', name_vi: 'Phở bò tái', name_en: 'Rare beef pho',
    opts_vi: 'Tô lớn • Nhiều hành', opts_en: 'Large • Extra scallion' },
  { id: 'com-tam-suon-bi-cha', name_vi: 'Cơm tấm sườn nướng bì chả', name_en: 'Special broken rice',
    opts_vi: 'Thêm trứng ốp la • Nước mắm pha', opts_en: 'Extra fried egg • House fish sauce' },
  { id: 'bun-bo-hue', name_vi: 'Bún bò Huế', name_en: 'Huế-style beef noodle',
    opts_vi: 'Cay vừa • Thêm chả Huế', opts_en: 'Medium spice • Extra Huế sausage' },
  { id: 'banh-xeo', name_vi: 'Bánh xèo miền Tây', name_en: 'Mekong sizzling pancake',
    opts_vi: 'Tôm + thịt • Rau sống nhiều', opts_en: 'Shrimp + pork • Extra herbs' },
  { id: 'mi-quang', name_vi: 'Mì Quảng', name_en: 'Quảng-style noodle',
    opts_vi: 'Gà + tôm • Bánh tráng nướng', opts_en: 'Chicken + shrimp • With rice cracker' },
  { id: 'goi-cuon', name_vi: 'Gỏi cuốn tôm thịt', name_en: 'Shrimp & pork spring rolls',
    opts_vi: 'Nước chấm đậu phộng', opts_en: 'Peanut sauce on side' },
  { id: 'banh-mi', name_vi: 'Bánh mì thịt nướng', name_en: 'Grilled pork banh mi',
    opts_vi: 'Pate đặc biệt • Ít rau', opts_en: 'House pâté • Less veg' },
  { id: 'cafe-sua-da', name_vi: 'Cà phê sữa đá', name_en: 'Iced milk coffee',
    opts_vi: 'Đá vừa • Ngọt 70%', opts_en: 'Normal ice • 70% sugar' },
  { id: 'tra-dao', name_vi: 'Trà đào cam sả', name_en: 'Peach lemongrass tea',
    opts_vi: 'Đá ít • Ngọt 50%', opts_en: 'Less ice • 50% sugar' },
  { id: 'nuoc-cam', name_vi: 'Nước cam tươi', name_en: 'Fresh orange juice',
    opts_vi: 'Không đường • Đá ít', opts_en: 'No sugar • Less ice' },
  { id: 'sinh-to-bo', name_vi: 'Sinh tố bơ', name_en: 'Avocado smoothie',
    opts_vi: 'Sữa đặc • Đậm vị', opts_en: 'Condensed milk • Rich' },
];

const AREAS = [
  { vi: 'Tầng 1', en: '1st Floor' },
  { vi: 'Tầng 2', en: '2nd Floor' },
  { vi: 'Tầng 2 — Cửa sổ', en: '2nd Floor — Window' },
  { vi: 'Sân vườn', en: 'Garden' },
  { vi: 'VIP — Phòng riêng', en: 'VIP — Private room' },
];

function pickArea(seed) {
  return AREAS[seed % AREAS.length];
}

function randomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  return '#' + pick(letters) + pick(digits) + pick(letters) + pick(digits);
}

// Build a status history given the final current status and the submitted time.
// Spreads transitions evenly across the elapsed window.
function buildHistory(currentStatus, submittedAt, now = new Date()) {
  const endIdx = STATUS_FLOW.indexOf(currentStatus);
  if (endIdx < 0) return [{ status: 'pending', timestamp: new Date(submittedAt) }];
  const elapsed = Math.max(1, now - submittedAt);
  const step = elapsed / (endIdx + 1); // leave a bit of headroom past the last transition
  const history = [];
  for (let i = 0; i <= endIdx; i++) {
    const ts = new Date(submittedAt.getTime() + Math.round(step * i));
    history.push({ status: STATUS_FLOW[i], timestamp: ts });
  }
  return history;
}

function makeItem(dish, qty, status, submittedAt, opts = {}) {
  return {
    id: dish.id + '-' + Math.random().toString(36).slice(2, 7),
    name_vi: dish.name_vi,
    name_en: dish.name_en,
    qty,
    options_text_vi: opts.options_text_vi ?? dish.opts_vi,
    options_text_en: opts.options_text_en ?? dish.opts_en,
    notes: opts.notes || '',
    status,
    status_history: buildHistory(status, submittedAt),
  };
}

function getDish(id) {
  return DISHES.find((d) => d.id === id);
}

// Seed: 6 tickets with the brief's exact composition.
function buildInitialTickets(now = new Date()) {
  const at = (secAgo) => new Date(now.getTime() - secAgo * 1000);
  const tickets = [];

  // 1) Just-arrived, pending, ~25s
  {
    const sub = at(25);
    tickets.push({
      order_id: '#A3F2',
      table_number: 7,
      area_name_vi: 'Tầng 1',
      area_name_en: '1st Floor',
      submitted_at: sub,
      items: [
        makeItem(getDish('pho-bo-tai'), 2, 'pending', sub),
        makeItem(getDish('cafe-sua-da'), 2, 'pending', sub, {
          options_text_vi: 'Đá vừa • Ngọt 100%',
          options_text_en: 'Normal ice • 100% sugar',
        }),
      ],
    });
  }

  // 2) Pending, ~1:30, still green
  {
    const sub = at(90);
    tickets.push({
      order_id: '#B7K9',
      table_number: 14,
      area_name_vi: 'Tầng 2 — Cửa sổ',
      area_name_en: '2nd Floor — Window',
      submitted_at: sub,
      items: [
        makeItem(getDish('banh-mi'), 1, 'pending', sub, {
          notes: 'Không hành, ít muối',
        }),
        makeItem(getDish('tra-dao'), 1, 'pending', sub),
      ],
    });
  }

  // 3) Preparing, ~6:20, amber
  {
    const sub = at(6 * 60 + 20);
    tickets.push({
      order_id: '#C2M4',
      table_number: 3,
      area_name_vi: 'Tầng 1',
      area_name_en: '1st Floor',
      submitted_at: sub,
      items: [
        makeItem(getDish('bun-bo-hue'), 1, 'preparing', sub, {
          options_text_vi: 'Cay nhiều • Thêm chả Huế',
          options_text_en: 'Extra spicy • Extra Huế sausage',
        }),
        makeItem(getDish('goi-cuon'), 2, 'preparing', sub),
      ],
    });
  }

  // 4) Preparing, ~7:50, amber
  {
    const sub = at(7 * 60 + 50);
    tickets.push({
      order_id: '#D9N1',
      table_number: 9,
      area_name_vi: 'Sân vườn',
      area_name_en: 'Garden',
      submitted_at: sub,
      items: [
        makeItem(getDish('com-tam-suon-bi-cha'), 2, 'preparing', sub, {
          notes: 'Một phần không cay',
        }),
        makeItem(getDish('banh-xeo'), 1, 'preparing', sub),
        makeItem(getDish('nuoc-cam'), 3, 'preparing', sub),
      ],
    });
  }

  // 5) All ready, ~9:10 (amber border because of time)
  {
    const sub = at(9 * 60 + 10);
    tickets.push({
      order_id: '#E5P8',
      table_number: 5,
      area_name_vi: 'Tầng 2',
      area_name_en: '2nd Floor',
      submitted_at: sub,
      items: [
        makeItem(getDish('mi-quang'), 2, 'ready', sub),
        makeItem(getDish('sinh-to-bo'), 2, 'ready', sub),
      ],
    });
  }

  // 6) Mixed states, ~5:00 — ready + preparing + acknowledged
  {
    const sub = at(5 * 60);
    tickets.push({
      order_id: '#F8Q3',
      table_number: 11,
      area_name_vi: 'Tầng 1',
      area_name_en: '1st Floor',
      submitted_at: sub,
      items: [
        makeItem(getDish('com-tam-suon-bi-cha'), 1, 'ready', sub),
        makeItem(getDish('bun-bo-hue'), 1, 'preparing', sub, {
          options_text_vi: 'Cay vừa',
          options_text_en: 'Medium spice',
        }),
        makeItem(getDish('tra-dao'), 2, 'acknowledged', sub, {
          notes: 'Tách ra hai ly',
        }),
      ],
    });
  }

  return tickets;
}

// Generate a new ticket "live" (used by the event loop + manual inject).
function buildRandomNewTicket(now = new Date()) {
  // 1-4 items, random dishes, random table number 1-30.
  const itemCount = 1 + Math.floor(Math.random() * 4);
  const usedDishes = new Set();
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    let dish;
    let guard = 0;
    do {
      dish = DISHES[Math.floor(Math.random() * DISHES.length)];
      guard++;
    } while (usedDishes.has(dish.id) && guard < 8);
    usedDishes.add(dish.id);
    const qty = Math.random() < 0.65 ? 1 : 1 + Math.floor(Math.random() * 3);
    const withNote = Math.random() < 0.18;
    items.push(
      makeItem(dish, qty, 'pending', now, {
        notes: withNote ? (Math.random() < 0.5 ? 'Ít cay' : 'Không hành') : '',
      })
    );
  }
  const tableNumber = 1 + Math.floor(Math.random() * 30);
  const area = pickArea(tableNumber);
  return {
    order_id: randomCode(),
    table_number: tableNumber,
    area_name_vi: area.vi,
    area_name_en: area.en,
    submitted_at: now,
    items,
  };
}

// ---------- Time helpers ----------
function fmtClock(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function fmtHMS(seconds) {
  // Always show m:ss; fall back to h:mm:ss past one hour.
  const sign = seconds < 0 ? '-' : '';
  seconds = Math.abs(Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function fmtTimestamp(date) {
  // e.g. 14:23:11
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Urgency bucket based on wait seconds. < 5 min green, 5–10 amber, > 10 red.
function urgencyFor(waitSec) {
  if (waitSec < 5 * 60) return 'green';
  if (waitSec < 10 * 60) return 'amber';
  return 'red';
}

// ---------- Web Audio sounds ----------
let _audioCtx = null;
function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      _audioCtx = new Ctor();
    } catch (e) {
      return null;
    }
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

// "Two quick notes" chime for new tickets — bright, brief, ~200ms total.
function playNewOrderChime() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const tones = [
    { freq: 880, start: 0, dur: 0.09 }, // A5
    { freq: 1318.51, start: 0.1, dur: 0.13 }, // E6
  ];
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(0.22, now + tone.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.dur + 0.02);
  }
}

// Softer single tone for "just went red" — lower pitch, longer fade.
function playUrgencyChime() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 523.25; // C5, softer than the bright chime
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

// ---------- Lucide icon helper ----------
function KIcon({ name, className = 'w-5 h-5', strokeWidth = 2 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
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

Object.assign(window, {
  KDS_DICT,
  STATUS_FLOW,
  nextStatus,
  minStatus,
  DISHES,
  buildInitialTickets,
  buildRandomNewTicket,
  fmtClock,
  fmtHMS,
  fmtTimestamp,
  urgencyFor,
  playNewOrderChime,
  playUrgencyChime,
  KIcon,
});
