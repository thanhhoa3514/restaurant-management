import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { WF_DICT } from '@/features/waiter/data/i18n'
import { buildInitialTables } from '@/features/waiter/data/seed'
import { wfBuildHistory } from '@/features/waiter/helpers'
import type { ItemStatus, Lang, WFCounts, WFItem, WFOrder, WFSession, WFTable } from '@/features/waiter/types'

export type WaiterView = 'plan' | 'grid'

type DictArgs = Array<string | number>

interface DemoDish {
  id: string
  name_vi: string
  name_en: string
  opts_vi: string
  opts_en: string
  price: number
}

const DEMO_MENU: DemoDish[] = [
  { id: 'pho_bo_tai', name_vi: 'Phở bò tái', name_en: 'Rare beef pho', opts_vi: 'Tô lớn • Nhiều hành', opts_en: 'Large • Extra scallion', price: 75000 },
  { id: 'com_tam_suon', name_vi: 'Cơm tấm sườn nướng bì chả', name_en: 'Special broken rice', opts_vi: 'Thêm trứng • Nước mắm pha', opts_en: 'Extra egg • House fish sauce', price: 85000 },
  { id: 'bun_bo_hue', name_vi: 'Bún bò Huế', name_en: 'Huế-style beef noodle', opts_vi: 'Cay vừa • Thêm chả Huế', opts_en: 'Medium spice • Extra Huế sausage', price: 80000 },
  { id: 'banh_xeo', name_vi: 'Bánh xèo miền Tây', name_en: 'Mekong sizzling pancake', opts_vi: 'Tôm + thịt', opts_en: 'Shrimp + pork', price: 90000 },
  { id: 'mi_quang', name_vi: 'Mì Quảng', name_en: 'Quảng-style noodle', opts_vi: 'Gà + tôm', opts_en: 'Chicken + shrimp', price: 70000 },
  { id: 'goi_cuon', name_vi: 'Gỏi cuốn tôm thịt', name_en: 'Shrimp & pork spring rolls', opts_vi: 'Nước chấm đậu phộng', opts_en: 'Peanut dipping sauce', price: 50000 },
  { id: 'banh_mi', name_vi: 'Bánh mì thịt nướng', name_en: 'Grilled pork banh mi', opts_vi: 'Pate đặc biệt', opts_en: 'House pâté', price: 45000 },
  { id: 'cafe_sua_da', name_vi: 'Cà phê sữa đá', name_en: 'Iced milk coffee', opts_vi: 'Đá vừa • Ngọt 70%', opts_en: 'Normal ice • 70% sugar', price: 35000 },
  { id: 'tra_dao', name_vi: 'Trà đào cam sả', name_en: 'Peach lemongrass tea', opts_vi: 'Đá ít • Ngọt 50%', opts_en: 'Less ice • 50% sugar', price: 45000 },
  { id: 'nuoc_cam', name_vi: 'Nước cam tươi', name_en: 'Fresh orange juice', opts_vi: 'Không đường', opts_en: 'No sugar', price: 35000 },
  { id: 'sinh_to_bo', name_vi: 'Sinh tố bơ', name_en: 'Avocado smoothie', opts_vi: 'Sữa đặc', opts_en: 'Condensed milk', price: 50000 },
]

let itemId = 10_000
let orderId = 20_000
let sessionId = 30_000

function pickOne<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

function makeItem(dish: DemoDish, qty: number, status: ItemStatus, submittedAt: Date): WFItem {
  return {
    id: `wi${itemId++}`,
    name_vi: dish.name_vi,
    name_en: dish.name_en,
    qty,
    options_text_vi: dish.opts_vi,
    options_text_en: dish.opts_en,
    notes: '',
    status,
    status_history: wfBuildHistory(status, submittedAt, submittedAt),
    unit_price: dish.price,
  }
}

function makeOrder(submittedAt: Date, items: WFItem[]): WFOrder {
  return { id: `WO${orderId++}`, submitted_at: submittedAt, items }
}

function makeSession(startedAt: Date, guestCount: number, orders: WFOrder[] = []): WFSession {
  return {
    id: `WS${sessionId++}`,
    started_at: startedAt,
    guest_count: guestCount,
    waiter_called_at: null,
    bill_requested_at: null,
    orders,
  }
}

export interface WaiterState {
  tables: WFTable[]
  now: Date
  timeMultiplier: number
  autoOn: boolean
  lang: Lang
  soundOn: boolean
  view: WaiterView
  selectedTableId: string | null
  justChangedIds: Set<string>
  demoOpen: boolean
}

export interface WaiterActions {
  selectTable: (tableId: string | null) => void
  acknowledgeCall: (tableId: string) => void
  notifyCashier: (tableId: string) => void
  markItemServed: (tableId: string, itemId: string) => void
  markAllServed: (tableId: string) => void
  requestBill: (tableId: string) => void
  openSession: (tableId: string, guestCount: number, notes: string) => void
  injectItemReady: () => void
  injectCall: () => void
  injectBill: () => void
  injectNewSession: () => void
  setAutoOn: Dispatch<SetStateAction<boolean>>
  setTimeMultiplier: Dispatch<SetStateAction<number>>
  setLang: (lang: Lang) => void
  setSoundOn: Dispatch<SetStateAction<boolean>>
  setView: Dispatch<SetStateAction<WaiterView>>
  setDemoOpen: Dispatch<SetStateAction<boolean>>
}

export interface UseWaiterValue {
  state: WaiterState
  actions: WaiterActions
  counts: WFCounts
  selectedTable: WFTable | null
  t: (key: string, ...args: DictArgs) => string
}

export function useWaiter(): UseWaiterValue {
  const initialNow = useMemo(() => new Date(), [])
  const [tables, setTables] = useState<WFTable[]>(() => buildInitialTables(initialNow))
  const [now, setNow] = useState<Date>(initialNow)
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [autoOn, setAutoOn] = useState(true)
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('rest_lang_waiter') as Lang) || 'vi')
  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('rest_lang_waiter', newLang)
    setLangState(newLang)
  }, [])
  const [soundOn, setSoundOn] = useState(true)
  const [view, setView] = useState<WaiterView>('plan')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [justChangedIds, setJustChangedIds] = useState<Set<string>>(() => new Set())
  const [demoOpen, setDemoOpen] = useState(true)

  const t = useCallback(
    (key: string, ...args: DictArgs): string => {
      const value = WF_DICT[lang][key]
      if (typeof value === 'function') return value(...(args as never[]))
      return value ?? key
    },
    [lang],
  )

  const markJustChanged = useCallback((tableId: string) => {
    setJustChangedIds((current) => new Set(current).add(tableId))
    window.setTimeout(() => {
      setJustChangedIds((current) => {
        const next = new Set(current)
        next.delete(tableId)
        return next
      })
    }, 500)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDemoOpen(false), 10_000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((current) => new Date(current.getTime() + 1000 * timeMultiplier))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timeMultiplier])

  const selectTable = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId)
  }, [])

  const acknowledgeCall = useCallback((tableId: string) => {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId && table.session?.waiter_called_at
          ? { ...table, session: { ...table.session, waiter_called_at: null } }
          : table,
      ),
    )
  }, [])

  const notifyCashier = useCallback((tableId: string) => {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId && table.session?.bill_requested_at
          ? { ...table, session: { ...table.session, bill_requested_at: null } }
          : table,
      ),
    )
  }, [])

  const markItemServed = useCallback(
    (tableId: string, targetItemId: string) => {
      const stamp = new Date(now)
      setTables((current) =>
        current.map((table) => {
          if (table.id !== tableId || !table.session) return table
          return {
            ...table,
            session: {
              ...table.session,
              orders: table.session.orders.map((order) => ({
                ...order,
                items: order.items.map((item) =>
                  item.id === targetItemId
                    ? {
                        ...item,
                        status: 'served',
                        status_history: [...item.status_history, { status: 'served', timestamp: stamp }],
                      }
                    : item,
                ),
              })),
            },
          }
        }),
      )
      markJustChanged(tableId)
    },
    [markJustChanged, now],
  )

  const markAllServed = useCallback(
    (tableId: string) => {
      const stamp = new Date(now)
      setTables((current) =>
        current.map((table) => {
          if (table.id !== tableId || !table.session) return table
          return {
            ...table,
            session: {
              ...table.session,
              orders: table.session.orders.map((order) => ({
                ...order,
                items: order.items.map((item) =>
                  item.status === 'ready'
                    ? {
                        ...item,
                        status: 'served',
                        status_history: [...item.status_history, { status: 'served', timestamp: stamp }],
                      }
                    : item,
                ),
              })),
            },
          }
        }),
      )
      markJustChanged(tableId)
    },
    [markJustChanged, now],
  )

  const requestBill = useCallback(
    (tableId: string) => {
      const stamp = new Date(now)
      setTables((current) =>
        current.map((table) =>
          table.id === tableId && table.session && !table.session.bill_requested_at
            ? { ...table, session: { ...table.session, bill_requested_at: stamp } }
            : table,
        ),
      )
      markJustChanged(tableId)
    },
    [markJustChanged, now],
  )

  const openSession = useCallback(
    (tableId: string, guestCount: number) => {
      const stamp = new Date(now)
      setTables((current) =>
        current.map((table) => {
          if (table.id !== tableId || table.status !== 'empty') return table
          return {
            ...table,
            status: 'occupied',
            session: makeSession(stamp, Math.max(1, Math.min(table.capacity, guestCount))),
          }
        }),
      )
      markJustChanged(tableId)
    },
    [markJustChanged, now],
  )

  const injectItemReady = useCallback(() => {
    const stamp = new Date(now)
    let changedId: string | null = null
    setTables((current) => {
      const candidates = current.flatMap((table) =>
        table.session
          ? table.session.orders.flatMap((order) =>
              order.items
                .filter((item) => item.status === 'preparing' || item.status === 'acknowledged' || item.status === 'pending')
                .map((item) => ({ tableId: table.id, itemId: item.id })),
            )
          : [],
      )
      const choice = pickOne(candidates)
      if (!choice) return current
      changedId = choice.tableId
      return current.map((table) => {
        if (table.id !== choice.tableId || !table.session) return table
        return {
          ...table,
          session: {
            ...table.session,
            orders: table.session.orders.map((order) => ({
              ...order,
              items: order.items.map((item) =>
                item.id === choice.itemId
                  ? { ...item, status: 'ready', status_history: [...item.status_history, { status: 'ready', timestamp: stamp }] }
                  : item,
              ),
            })),
          },
        }
      })
    })
    if (changedId) markJustChanged(changedId)
  }, [markJustChanged, now])

  const injectCall = useCallback(() => {
    const stamp = new Date(now)
    let changedId: string | null = null
    setTables((current) => {
      const choice = pickOne(current.filter((table) => table.status === 'occupied' && table.session && !table.session.waiter_called_at))
      if (!choice || !choice.session) return current
      changedId = choice.id
      return current.map((table) =>
        table.id === choice.id && table.session
          ? { ...table, session: { ...table.session, waiter_called_at: stamp } }
          : table,
      )
    })
    if (changedId) markJustChanged(changedId)
  }, [markJustChanged, now])

  const injectBill = useCallback(() => {
    const stamp = new Date(now)
    let changedId: string | null = null
    setTables((current) => {
      const choice = pickOne(current.filter((table) => table.status === 'occupied' && table.session && !table.session.bill_requested_at))
      if (!choice || !choice.session) return current
      changedId = choice.id
      return current.map((table) =>
        table.id === choice.id && table.session
          ? { ...table, session: { ...table.session, bill_requested_at: stamp } }
          : table,
      )
    })
    if (changedId) markJustChanged(changedId)
  }, [markJustChanged, now])

  const injectNewSession = useCallback(() => {
    const stamp = new Date(now)
    let changedId: string | null = null
    setTables((current) => {
      const choice = pickOne(current.filter((table) => table.status === 'empty'))
      if (!choice) return current
      changedId = choice.id
      const usedIds = new Set<string>()
      const items = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
        const dish = pickOne(DEMO_MENU.filter((menuItem) => !usedIds.has(menuItem.id))) ?? DEMO_MENU[0]
        usedIds.add(dish.id)
        return makeItem(dish, 1 + Math.floor(Math.random() * 2), 'pending', stamp)
      })
      const orders = [makeOrder(stamp, items)]
      return current.map((table) =>
        table.id === choice.id
          ? {
              ...table,
              status: 'occupied',
              session: makeSession(stamp, Math.max(1, Math.min(choice.capacity, 1 + Math.floor(Math.random() * choice.capacity))), orders),
            }
          : table,
      )
    })
    if (changedId) markJustChanged(changedId)
  }, [markJustChanged, now])

  useEffect(() => {
    if (!autoOn) return undefined
    let timer: number | undefined
    const schedule = () => {
      timer = window.setTimeout(() => {
        const roll = Math.random()
        if (roll < 0.3) injectItemReady()
        else if (roll < 0.45) injectCall()
        else if (roll < 0.55) injectBill()
        else if (roll < 0.8) injectNewSession()
        schedule()
      }, 8000 + Math.random() * 7000)
    }
    schedule()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [autoOn, injectBill, injectCall, injectItemReady, injectNewSession])

  const counts = useMemo<WFCounts>(() => {
    return tables.reduce(
      (acc, table) => {
        if (table.status === 'occupied' && table.session) {
          acc.occupied += 1
          if (table.session.waiter_called_at) acc.calls += 1
          if (table.session.bill_requested_at) acc.bills += 1
          acc.ready += table.session.orders.reduce(
            (sum, order) => sum + order.items.filter((item) => item.status === 'ready').length,
            0,
          )
        }
        return acc
      },
      { calls: 0, ready: 0, bills: 0, occupied: 0, total: tables.length },
    )
  }, [tables])

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tables],
  )

  return {
    state: { tables, now, timeMultiplier, autoOn, lang, soundOn, view, selectedTableId, justChangedIds, demoOpen },
    actions: {
      selectTable,
      acknowledgeCall,
      notifyCashier,
      markItemServed,
      markAllServed,
      requestBill,
      openSession,
      injectItemReady,
      injectCall,
      injectBill,
      injectNewSession,
      setAutoOn,
      setTimeMultiplier,
      setLang,
      setSoundOn,
      setView,
      setDemoOpen,
    },
    counts,
    selectedTable,
    t,
  }
}
