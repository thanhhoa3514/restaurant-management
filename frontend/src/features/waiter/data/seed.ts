import type {
  WFTable,
  WFSession,
  WFOrder,
  WFItem,
  Landmark,
  MenuItemOption,
  ItemStatus,
} from '../types'
import { wfBuildHistory } from '../helpers'

const WF_MENU: MenuItemOption[] = [
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
]

const WF_TABLE_LAYOUT = [
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
]

export const WF_LANDMARKS: Landmark[] = [
  { key: 'landmark_kitchen', x: 40, y: 4, w: 20, h: 6, tone: 'stone' },
  { key: 'landmark_bar', x: 2, y: 30, w: 8, h: 36, tone: 'stone' },
  { key: 'landmark_entrance', x: 42, y: 94, w: 16, h: 5, tone: 'stone' },
  { key: 'landmark_cashier', x: 80, y: 86, w: 16, h: 10, tone: 'stone' },
]

function wfDish(id: string): MenuItemOption {
  return WF_MENU.find((m) => m.id === id)!
}

let _wfItemId = 1
let _wfOrderId = 100
let _wfSessionId = 1000

function wfMakeItem(
  dishId: string,
  qty: number,
  status: ItemStatus,
  submittedAt: Date,
  opts: { options_text_vi?: string; options_text_en?: string; notes?: string } = {},
  readyAtOverride?: Date,
): WFItem {
  const dish = wfDish(dishId)
  const history = wfBuildHistory(status, submittedAt)
  if (readyAtOverride && status === 'ready') {
    const readyEntry = history.find((h) => h.status === 'ready')
    if (readyEntry) readyEntry.timestamp = readyAtOverride
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
  }
}

function wfMakeOrder(submittedAt: Date, items: WFItem[]): WFOrder {
  return { id: 'O' + _wfOrderId++, submitted_at: submittedAt, items }
}

function wfMakeSession({
  startedAt,
  guestCount,
  waiterCalledAt = null,
  billRequestedAt = null,
  orders = [],
}: {
  startedAt: Date
  guestCount: number
  waiterCalledAt?: Date | null
  billRequestedAt?: Date | null
  orders?: WFOrder[]
}): WFSession {
  return {
    id: 'S' + _wfSessionId++,
    started_at: startedAt,
    guest_count: guestCount,
    waiter_called_at: waiterCalledAt,
    bill_requested_at: billRequestedAt,
    orders,
  }
}

export function buildInitialTables(now: Date = new Date()): WFTable[] {
  const at = (secAgo: number) => new Date(now.getTime() - secAgo * 1000)
  const tables: WFTable[] = WF_TABLE_LAYOUT.map((t) => ({
    id: 'T' + t.number,
    number: t.number,
    capacity: t.capacity,
    position: { x_pct: t.x, y_pct: t.y },
    status: 'empty',
    session: null,
  }))

  const setSession = (num: number, session: WFSession) => {
    const tbl = tables.find((x) => x.number === num)!
    tbl.status = 'occupied'
    tbl.session = session
  }

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
  }))

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
  }))

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
  }))

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
  }))

  // T13: 4-top, 12 min
  setSession(13, wfMakeSession({
    startedAt: at(12 * 60),
    guestCount: 3,
    orders: [
      wfMakeOrder(at(11 * 60), [
        wfMakeItem('com_tam_suon', 3, 'preparing', at(11 * 60), { notes: 'Một phần không cay' }),
        wfMakeItem('cafe_sua_da', 3, 'preparing', at(11 * 60)),
      ]),
    ],
  }))

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
  }))

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
  }))

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
  }))

  // T20: 6-top, 1 ready + remaining preparing
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
  }))

  // T4: 2-top, fresh call ~10s
  const t4 = wfMakeSession({
    startedAt: at(8 * 60),
    guestCount: 2,
    orders: [
      wfMakeOrder(at(7 * 60), [
        wfMakeItem('bun_bo_hue', 2, 'preparing', at(7 * 60)),
        wfMakeItem('nuoc_cam', 2, 'preparing', at(7 * 60)),
      ]),
    ],
  })
  t4.waiter_called_at = at(10)
  setSession(4, t4)

  // T17: 4-top, urgent call ~2 min
  const t17 = wfMakeSession({
    startedAt: at(28 * 60),
    guestCount: 4,
    orders: [
      wfMakeOrder(at(27 * 60), [
        wfMakeItem('pho_bo_tai', 2, 'served', at(27 * 60)),
        wfMakeItem('com_tam_suon', 2, 'served', at(27 * 60)),
        wfMakeItem('cafe_sua_da', 4, 'served', at(27 * 60)),
      ]),
    ],
  })
  t17.waiter_called_at = at(2 * 60 + 5)
  setSession(17, t17)

  // T5: 2-top, bill requested
  const t5 = wfMakeSession({
    startedAt: at(35 * 60),
    guestCount: 2,
    orders: [
      wfMakeOrder(at(34 * 60), [
        wfMakeItem('mi_quang', 2, 'served', at(34 * 60)),
        wfMakeItem('tra_dao', 2, 'served', at(34 * 60)),
      ]),
    ],
  })
  t5.bill_requested_at = at(45)
  setSession(5, t5)

  return tables
}
