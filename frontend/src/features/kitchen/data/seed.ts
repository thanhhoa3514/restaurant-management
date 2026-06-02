import type { Dish, Area, KDSItem, Ticket } from '../types'
import { buildHistory } from '../helpers'

const DISHES: Dish[] = [
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
]

const AREAS: Area[] = [
  { vi: 'Tầng 1', en: '1st Floor' },
  { vi: 'Tầng 2', en: '2nd Floor' },
  { vi: 'Tầng 2 — Cửa sổ', en: '2nd Floor — Window' },
  { vi: 'Sân vườn', en: 'Garden' },
  { vi: 'VIP — Phòng riêng', en: 'VIP — Private room' },
]

function getDish(id: string): Dish {
  return DISHES.find((d) => d.id === id)!
}

function pickArea(seed: number): Area {
  return AREAS[seed % AREAS.length]
}

function makeItem(
  dish: Dish,
  qty: number,
  status: KDSItem['status'],
  submittedAt: Date,
  opts: { options_text_vi?: string; options_text_en?: string; notes?: string } = {},
): KDSItem {
  const now = new Date(submittedAt.getTime() + 10000) // slight offset for history
  return {
    id: dish.id + '-' + Math.random().toString(36).slice(2, 7),
    name_vi: dish.name_vi,
    name_en: dish.name_en,
    qty,
    options_text_vi: opts.options_text_vi ?? dish.opts_vi,
    options_text_en: opts.options_text_en ?? dish.opts_en,
    notes: opts.notes || '',
    status,
    status_history: buildHistory(status, submittedAt, now),
  }
}

export function buildInitialTickets(now: Date = new Date()): Ticket[] {
  const at = (secAgo: number) => new Date(now.getTime() - secAgo * 1000)
  const tickets: Ticket[] = []

  // 1) Just-arrived, pending, ~25s
  {
    const sub = at(25)
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
    })
  }

  // 2) Pending, ~1:30
  {
    const sub = at(90)
    tickets.push({
      order_id: '#B7K9',
      table_number: 14,
      area_name_vi: 'Tầng 2 — Cửa sổ',
      area_name_en: '2nd Floor — Window',
      submitted_at: sub,
      items: [
        makeItem(getDish('banh-mi'), 1, 'pending', sub, { notes: 'Không hành, ít muối' }),
        makeItem(getDish('tra-dao'), 1, 'pending', sub),
      ],
    })
  }

  // 3) Preparing, ~6:20
  {
    const sub = at(6 * 60 + 20)
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
    })
  }

  // 4) Preparing, ~7:50
  {
    const sub = at(7 * 60 + 50)
    tickets.push({
      order_id: '#D9N1',
      table_number: 9,
      area_name_vi: 'Sân vườn',
      area_name_en: 'Garden',
      submitted_at: sub,
      items: [
        makeItem(getDish('com-tam-suon-bi-cha'), 2, 'preparing', sub, { notes: 'Một phần không cay' }),
        makeItem(getDish('banh-xeo'), 1, 'preparing', sub),
        makeItem(getDish('nuoc-cam'), 3, 'preparing', sub),
      ],
    })
  }

  // 5) All ready, ~9:10
  {
    const sub = at(9 * 60 + 10)
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
    })
  }

  // 6) Mixed states, ~5:00
  {
    const sub = at(5 * 60)
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
        makeItem(getDish('tra-dao'), 2, 'acknowledged', sub, { notes: 'Tách ra hai ly' }),
      ],
    })
  }

  return tickets
}

export function buildRandomNewTicket(now: Date = new Date()): Ticket {
  const itemCount = 1 + Math.floor(Math.random() * 4)
  const usedDishes = new Set<string>()
  const items: KDSItem[] = []
  for (let i = 0; i < itemCount; i++) {
    let dish: Dish
    let guard = 0
    do {
      dish = DISHES[Math.floor(Math.random() * DISHES.length)]
      guard++
    } while (usedDishes.has(dish.id) && guard < 8)
    usedDishes.add(dish.id)
    const qty = Math.random() < 0.65 ? 1 : 1 + Math.floor(Math.random() * 3)
    const withNote = Math.random() < 0.18
    items.push(makeItem(dish, qty, 'pending', now, {
      notes: withNote ? (Math.random() < 0.5 ? 'Ít cay' : 'Không hành') : '',
    }))
  }
  const tableNumber = 1 + Math.floor(Math.random() * 30)
  const area = pickArea(tableNumber)
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '0123456789'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const orderId = '#' + pick(letters) + pick(digits) + pick(letters) + pick(digits)

  return {
    order_id: orderId,
    table_number: tableNumber,
    area_name_vi: area.vi,
    area_name_en: area.en,
    submitted_at: now,
    items,
  }
}
