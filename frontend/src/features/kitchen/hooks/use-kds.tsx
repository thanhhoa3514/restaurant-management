import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { buildInitialTickets, buildRandomNewTicket } from '@/features/kitchen/data/seed'
import { minStatus, nextStatus, urgencyFor } from '@/features/kitchen/helpers'
import type { ItemStatus, KDSStats, Lang, Ticket, Urgency } from '@/features/kitchen/types'

type KdsDictKey = keyof (typeof KDS_DICT)['vi']
type KdsDictFunction = (...args: Array<number | string>) => string

const AUTO_COLLAPSE_MS = 10_000
const FADE_OUT_MS = 1_500

function statusToastKey(status: ItemStatus): KdsDictKey | null {
  switch (status) {
    case 'pending':
      return 'toast_acknowledged'
    case 'acknowledged':
      return 'toast_start'
    case 'preparing':
      return 'toast_ready'
    case 'ready':
      return 'toast_served'
    case 'served':
      return null
  }
}

export interface UseKdsValue {
  tickets: Ticket[]
  sortedTickets: Ticket[]
  now: Date
  timeMultiplier: number
  paused: boolean
  soundOn: boolean
  lang: Lang
  fadingIds: Set<string>
  manageOrderId: string | null
  demoOpen: boolean
  stats: KDSStats
  manageTicket: Ticket | undefined
  lastMessage: string | null
  t: (key: KdsDictKey, ...args: Array<number | string>) => string
  advanceAll: (orderId: string) => void
  advanceItem: (orderId: string, itemId: string) => void
  injectNewTicket: () => void
  setPaused: Dispatch<SetStateAction<boolean>>
  setTimeMultiplier: Dispatch<SetStateAction<number>>
  setSoundOn: Dispatch<SetStateAction<boolean>>
  setLang: (lang: Lang) => void
  setManageOrderId: Dispatch<SetStateAction<string | null>>
  setDemoOpen: Dispatch<SetStateAction<boolean>>
}

export function useKds(): UseKdsValue {
  const [tickets, setTickets] = useState<Ticket[]>(() => buildInitialTickets(new Date()))
  const [now, setNow] = useState(() => new Date())
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [paused, setPaused] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('rest_lang_kds') as Lang) || 'vi')
  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('rest_lang_kds', newLang)
    setLangState(newLang)
  }, [])
  const [fadingIds, setFadingIds] = useState<Set<string>>(() => new Set())
  const [manageOrderId, setManageOrderId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(true)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const nowRef = useRef(now)
  const langRef = useRef(lang)
  const soundOnRef = useRef(soundOn)
  const prevUrgencyRef = useRef<Record<string, Urgency>>({})
  const fadingTimersRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    nowRef.current = now
  }, [now])

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  const t = useCallback((key: KdsDictKey, ...args: Array<number | string>) => {
    const value = KDS_DICT[langRef.current][key]
    if (typeof value === 'function') return (value as unknown as KdsDictFunction)(...args)
    return value ?? key
  }, [])

  const notify = useCallback((message: string) => {
    setLastMessage(message)
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => setDemoOpen(false), AUTO_COLLAPSE_MS)
    return () => window.clearTimeout(timerId)
  }, [])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow((prev) => new Date(prev.getTime() + 1_000 * timeMultiplier))
    }, 1_000)
    return () => window.clearInterval(timerId)
  }, [timeMultiplier])

  const injectNewTicket = useCallback(() => {
    const stamp = new Date(nowRef.current.getTime())
    const ticket = buildRandomNewTicket(stamp)
    setTickets((prev) => [...prev, ticket])
    notify(t('toast_new_order', ticket.table_number))
  }, [notify, t])

  useEffect(() => {
    if (paused) return undefined

    let timerId: number | undefined
    const schedule = () => {
      const delayMs = 20_000 + Math.random() * 10_000
      timerId = window.setTimeout(() => {
        injectNewTicket()
        schedule()
      }, delayMs)
    }

    schedule()
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId)
    }
  }, [injectNewTicket, paused])

  useEffect(() => {
    const nextUrgency: Record<string, Urgency> = {}
    let justWentRed = false

    for (const ticket of tickets) {
      if (fadingIds.has(ticket.order_id)) continue
      if (ticket.items.every((item) => item.status === 'served')) continue

      const waitSec = Math.max(
        0,
        Math.floor((now.getTime() - ticket.submitted_at.getTime()) / 1_000),
      )
      const urgency = urgencyFor(waitSec)
      const previous = prevUrgencyRef.current[ticket.order_id]
      if (previous && previous !== 'red' && urgency === 'red') justWentRed = true
      nextUrgency[ticket.order_id] = urgency
    }

    prevUrgencyRef.current = nextUrgency
    if (justWentRed && soundOnRef.current) {
      notify(
        langRef.current === 'vi'
          ? 'Một đơn vừa chuyển sang khẩn cấp'
          : 'An order just became urgent',
      )
    }
  }, [fadingIds, notify, now, tickets])

  const advanceAll = useCallback(
    (orderId: string) => {
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.order_id !== orderId) return ticket

          const liveItems = ticket.items.filter((item) => item.status !== 'served')
          if (liveItems.length === 0) return ticket

          const lowestStatus = minStatus(liveItems)
          const nextItems = ticket.items.map((item) => {
            if (item.status !== lowestStatus) return item
            const advanced = nextStatus(item.status)
            return {
              ...item,
              status: advanced,
              status_history: [
                ...item.status_history,
                { status: advanced, timestamp: new Date(nowRef.current) },
              ],
            }
          })

          const toastKey = statusToastKey(lowestStatus)
          if (toastKey) notify(t(toastKey, ticket.table_number))

          return { ...ticket, items: nextItems }
        }),
      )
    },
    [notify, t],
  )

  const advanceItem = useCallback(
    (orderId: string, itemId: string) => {
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.order_id !== orderId) return ticket

          let advancedName = ''
          const nextItems = ticket.items.map((item) => {
            if (item.id !== itemId || item.status === 'served') return item
            const advanced = nextStatus(item.status)
            advancedName = langRef.current === 'vi' ? item.name_vi : item.name_en
            return {
              ...item,
              status: advanced,
              status_history: [
                ...item.status_history,
                { status: advanced, timestamp: new Date(nowRef.current) },
              ],
            }
          })

          if (advancedName) notify(t('toast_item_advanced', advancedName))
          return { ...ticket, items: nextItems }
        }),
      )
    },
    [notify, t],
  )

  useEffect(() => {
    for (const ticket of tickets) {
      if (fadingIds.has(ticket.order_id)) continue
      if (fadingTimersRef.current.has(ticket.order_id)) continue
      if (ticket.items.length === 0) continue
      if (!ticket.items.every((item) => item.status === 'served')) continue

      fadingTimersRef.current.add(ticket.order_id)
      window.setTimeout(() => {
        setFadingIds((current) => new Set(current).add(ticket.order_id))
        window.setTimeout(() => {
          setTickets((prev) => prev.filter((item) => item.order_id !== ticket.order_id))
          setFadingIds((current) => {
            const next = new Set(current)
            next.delete(ticket.order_id)
            return next
          })
          fadingTimersRef.current.delete(ticket.order_id)
        }, FADE_OUT_MS)
      }, 0)
    }
  }, [fadingIds, tickets])

  const stats = useMemo<KDSStats>(() => {
    return tickets.reduce(
      (acc, ticket) => {
        for (const item of ticket.items) {
          if (item.status === 'pending' || item.status === 'acknowledged') acc.pending += 1
          if (item.status === 'preparing') acc.preparing += 1
          if (item.status === 'ready') acc.ready += 1
        }
        return acc
      },
      { pending: 0, preparing: 0, ready: 0 },
    )
  }, [tickets])

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => a.submitted_at.getTime() - b.submitted_at.getTime()),
    [tickets],
  )

  const manageTicket = useMemo(
    () => sortedTickets.find((ticket) => ticket.order_id === manageOrderId),
    [manageOrderId, sortedTickets],
  )

  return {
    tickets,
    sortedTickets,
    now,
    timeMultiplier,
    paused,
    soundOn,
    lang,
    fadingIds,
    manageOrderId,
    demoOpen,
    stats,
    manageTicket,
    lastMessage,
    t,
    advanceAll,
    advanceItem,
    injectNewTicket,
    setPaused,
    setTimeMultiplier,
    setSoundOn,
    setLang,
    setManageOrderId,
    setDemoOpen,
  }
}
