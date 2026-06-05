import type {
  CashierSession,
  LineItem,
  Order,
  Invoice,
  PaymentRecord,
  SubMethod,
} from '../types'
import { calcInvoice, makeTxnId } from '../helpers'

// ---------- Menu pool ----------
const CS_MENU = [
  { id: 'pho_bo_tai', name_vi: 'Phở bò tái', name_en: 'Rare beef pho', opts_vi: 'Tô lớn', opts_en: 'Large', price: 75000 },
  { id: 'com_tam_suon', name_vi: 'Cơm tấm sườn nướng bì chả', name_en: 'Special broken rice', opts_vi: 'Thêm trứng ốp la', opts_en: 'Extra fried egg', price: 85000 },
  { id: 'bun_bo_hue', name_vi: 'Bún bò Huế', name_en: 'Huế-style beef noodle', opts_vi: 'Cay vừa', opts_en: 'Medium spice', price: 80000 },
  { id: 'banh_xeo', name_vi: 'Bánh xèo miền Tây', name_en: 'Mekong sizzling pancake', opts_vi: 'Tôm + thịt', opts_en: 'Shrimp + pork', price: 90000 },
  { id: 'mi_quang', name_vi: 'Mì Quảng', name_en: 'Quảng-style noodle', opts_vi: 'Gà + tôm', opts_en: 'Chicken + shrimp', price: 70000 },
  { id: 'goi_cuon', name_vi: 'Gỏi cuốn tôm thịt', name_en: 'Shrimp & pork spring rolls', opts_vi: 'Nước chấm đậu phộng', opts_en: 'Peanut sauce', price: 50000 },
  { id: 'banh_mi', name_vi: 'Bánh mì thịt nướng', name_en: 'Grilled pork banh mi', opts_vi: 'Pate đặc biệt', opts_en: 'House pâté', price: 45000 },
  { id: 'cafe_sua_da', name_vi: 'Cà phê sữa đá', name_en: 'Iced milk coffee', opts_vi: 'Ngọt 70%', opts_en: '70% sugar', price: 35000 },
  { id: 'tra_dao', name_vi: 'Trà đào cam sả', name_en: 'Peach lemongrass tea', opts_vi: 'Đá ít', opts_en: 'Less ice', price: 45000 },
  { id: 'nuoc_cam', name_vi: 'Nước cam tươi', name_en: 'Fresh orange juice', opts_vi: 'Không đường', opts_en: 'No sugar', price: 35000 },
  { id: 'sinh_to_bo', name_vi: 'Sinh tố bơ', name_en: 'Avocado smoothie', opts_vi: 'Sữa đặc', opts_en: 'Condensed milk', price: 50000 },
]

function csDish(id: string) {
  return CS_MENU.find((m) => m.id === id)!
}

// ---------- ID counters ----------
let _csItemId = 1
let _csOrderId = 200
let _csInvoiceCounter = 41
let _csSessionId = 5000

function csMakeLine(dishId: string, qty: number, opts: { notes?: string; options_text_vi?: string; options_text_en?: string } = {}): LineItem {
  const dish = csDish(dishId)
  return {
    id: 'L' + _csItemId++,
    name_snapshot_vi: dish.name_vi,
    name_snapshot_en: dish.name_en,
    options_text_vi: opts.options_text_vi ?? dish.opts_vi,
    options_text_en: opts.options_text_en ?? dish.opts_en,
    notes: opts.notes || '',
    qty,
    unit_price_snapshot: dish.price,
    line_total: dish.price * qty,
  }
}

function csMakeOrder(submittedAt: Date, items: LineItem[]): Order {
  return { id: 'O' + _csOrderId++, submitted_at: submittedAt, items }
}

function csMakeInvoice(orders: Order[], createdAt: Date): Invoice {
  const num = String(_csInvoiceCounter++).padStart(4, '0')
  const d = createdAt
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const calc = calcInvoice(orders, null)
  return {
    number: `HD-${dateStr}-${num}`,
    created_at: createdAt,
    items: orders.flatMap((o) =>
      o.items.map((it) => ({ ...it, _order_id: o.id, _order_submitted_at: o.submitted_at }))
    ),
    orders,
    status: 'LOCAL_DRAFT',
    subtotal: calc.subtotal,
    service_charge_amount: 0,
    service_charge_basis_points: 0,
    vat_amount: calc.vat_amount,
    vat_basis_points: 1000,
    discount: null,
    total: calc.total,
    paid_amount: 0,
    change_amount: 0,
    discount_history: [],
  }
}

function csMakeSession({
  tableNumber,
  areaVi,
  areaEn,
  guestCount,
  startedAt,
  status,
  billRequestedAt = null,
  orders,
  payment = null,
}: {
  tableNumber: number
  areaVi: string
  areaEn: string
  guestCount: number
  startedAt: Date
  status: CashierSession['status']
  billRequestedAt?: Date | null
  orders: Order[]
  payment?: PaymentRecord | null
}): CashierSession {
  const invoice = csMakeInvoice(orders, startedAt)
  return {
    id: 'S' + _csSessionId++,
    table_number: tableNumber,
    area_name_vi: areaVi,
    area_name_en: areaEn,
    guest_count: guestCount,
    started_at: startedAt,
    bill_requested_at: billRequestedAt,
    status,
    invoice,
    payment,
  }
}

export function buildInitialSessions(now: Date = new Date()): CashierSession[] {
  const at = (secAgo: number) => new Date(now.getTime() - secAgo * 1000)

  return [
    // 1) Bill requested ~3 min ago — Bàn 8
    csMakeSession({
      tableNumber: 8,
      areaVi: 'Tầng 1',
      areaEn: '1st Floor',
      guestCount: 2,
      startedAt: at(25 * 60),
      status: 'bill_requested',
      billRequestedAt: at(3 * 60 + 5),
      orders: [
        csMakeOrder(at(24 * 60), [
          csMakeLine('pho_bo_tai', 1),
          csMakeLine('banh_mi', 1),
          csMakeLine('cafe_sua_da', 2),
        ]),
      ],
    }),

    // 2) Bill requested ~30s ago — Bàn 15
    csMakeSession({
      tableNumber: 15,
      areaVi: 'Sân vườn',
      areaEn: 'Garden',
      guestCount: 4,
      startedAt: at(40 * 60),
      status: 'bill_requested',
      billRequestedAt: at(35),
      orders: [
        csMakeOrder(at(39 * 60), [
          csMakeLine('com_tam_suon', 2, { notes: 'Một phần không cay' }),
          csMakeLine('bun_bo_hue', 1),
          csMakeLine('goi_cuon', 2),
          csMakeLine('tra_dao', 4),
        ]),
      ],
    }),

    // 3) Dining — Bàn 4
    csMakeSession({
      tableNumber: 4,
      areaVi: 'Tầng 2',
      areaEn: '2nd Floor',
      guestCount: 2,
      startedAt: at(20 * 60),
      status: 'dining',
      orders: [
        csMakeOrder(at(19 * 60), [
          csMakeLine('mi_quang', 1),
          csMakeLine('banh_xeo', 1),
          csMakeLine('cafe_sua_da', 2),
        ]),
      ],
    }),

    // 4) Dining — Bàn 12 (larger group, 2 orders)
    csMakeSession({
      tableNumber: 12,
      areaVi: 'Tầng 2 — Cửa sổ',
      areaEn: '2nd Floor — Window',
      guestCount: 4,
      startedAt: at(45 * 60),
      status: 'dining',
      orders: [
        csMakeOrder(at(44 * 60), [
          csMakeLine('pho_bo_tai', 2),
          csMakeLine('banh_xeo', 1),
        ]),
        csMakeOrder(at(18 * 60), [
          csMakeLine('com_tam_suon', 2),
          csMakeLine('tra_dao', 4),
          csMakeLine('sinh_to_bo', 2),
        ]),
      ],
    }),

    // 5) In payment (e-wallet pending) — Bàn 6
    (() => {
      const sess = csMakeSession({
        tableNumber: 6,
        areaVi: 'Tầng 1',
        areaEn: '1st Floor',
        guestCount: 3,
        startedAt: at(50 * 60),
        status: 'in_payment',
        billRequestedAt: at(5 * 60),
        orders: [
          csMakeOrder(at(49 * 60), [
            csMakeLine('bun_bo_hue', 2, { notes: 'Cay nhiều' }),
            csMakeLine('banh_xeo', 1),
            csMakeLine('nuoc_cam', 3),
          ]),
        ],
      })
      sess.payment = {
        method: 'ewallet',
        sub_method: 'momo' as SubMethod,
        status: 'pending',
        transaction_id: makeTxnId(at(30)),
        initiated_at: at(30),
        completed_at: null,
        amount_tendered: null,
        change: null,
        last4: null,
        bank: null,
      }
      return sess
    })(),
  ]
}
