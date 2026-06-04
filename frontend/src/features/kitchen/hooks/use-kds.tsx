import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { minStatus, nextStatus, urgencyFor } from '@/features/kitchen/helpers'
import type { ItemStatus, KDSStats, Lang, Ticket, Urgency } from '@/features/kitchen/types'
import { fetchKitchenQueue, updateKitchenOrderItemStatus } from '@/features/staff/api'
import { toKdsTickets } from '@/features/staff/mappers'

type KdsDictKey = keyof (typeof KDS_DICT)['vi']
type KdsDictFunction = (...args: Array<number | string>) => string

const FADE_OUT_MS = 1_500
const KITCHEN_QUEUE_QUERY_KEY = ['kitchen', 'queue'] as const

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
  const [now, setNow] = useState(() => new Date())
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [paused, setPaused] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('rest_lang_kds') as Lang) || 'vi',
  )
  const [fadingIds, setFadingIds] = useState<Set<string>>(() => new Set())
  const [manageOrderId, setManageOrderId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const queueQuery = useQuery({
    queryKey: KITCHEN_QUEUE_QUERY_KEY,
    queryFn: fetchKitchenQueue,
    refetchInterval: paused ? false : 5_000,
  })

  const tickets = useMemo(() => toKdsTickets(queueQuery.data?.tickets ?? []), [queueQuery.data])

  const langRef = useRef(lang)
  const soundOnRef = useRef(soundOn)
  const prevUrgencyRef = useRef<Record<string, Urgency>>({})

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])

  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('rest_lang_kds', newLang)
    setLangState(newLang)
  }, [])

  const t = useCallback((key: KdsDictKey, ...args: Array<number | string>) => {
    const value = KDS_DICT[langRef.current][key]
    if (typeof value === 'function') return (value as unknown as KdsDictFunction)(...args)
    return value ?? key
  }, [])

  const notify = useCallback((message: string) => {
    setLastMessage(message)
  }, [])

  const refetchQueue = useCallback(() => {
    void queueQuery.refetch()
  }, [queueQuery])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow((prev) => new Date(prev.getTime() + 1_000 * timeMultiplier))
    }, 1_000)
    return () => window.clearInterval(timerId)
  }, [timeMultiplier])

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
      const ticket = tickets.find((item) => item.order_id === orderId)
      if (!ticket) return
      const liveItems = ticket.items.filter((item) => item.status !== 'served')
      if (liveItems.length === 0) return
      const lowestStatus = minStatus(liveItems)
      const target = nextStatus(lowestStatus).toUpperCase()
      const toastKey = statusToastKey(lowestStatus)
      void Promise.all(
        ticket.items
          .filter((item) => item.status === lowestStatus)
          .map((item) => updateKitchenOrderItemStatus(item.id, target)),
      ).then(() => {
        if (toastKey) notify(t(toastKey, ticket.table_number))
        refetchQueue()
      })
    },
    [notify, refetchQueue, t, tickets],
  )

  const advanceItem = useCallback(
    (_orderId: string, itemId: string) => {
      const item = tickets
        .flatMap((ticket) => ticket.items)
        .find((candidate) => candidate.id === itemId)
      if (!item || item.status === 'served') return
      const target = nextStatus(item.status).toUpperCase()
      const advancedName = langRef.current === 'vi' ? item.name_vi : item.name_en
      void updateKitchenOrderItemStatus(item.id, target).then(() => {
        notify(t('toast_item_advanced', advancedName))
        refetchQueue()
      })
    },
    [notify, refetchQueue, t, tickets],
  )

  useEffect(() => {
    for (const ticket of tickets) {
      if (fadingIds.has(ticket.order_id)) continue
      if (ticket.items.length === 0) continue
      if (!ticket.items.every((item) => item.status === 'served')) continue

      window.setTimeout(() => {
        setFadingIds((current) => new Set(current).add(ticket.order_id))
        window.setTimeout(() => {
          setFadingIds((current) => {
            const next = new Set(current)
            next.delete(ticket.order_id)
            return next
          })
          refetchQueue()
        }, FADE_OUT_MS)
      }, 0)
    }
  }, [fadingIds, refetchQueue, tickets])

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
    injectNewTicket: refetchQueue,
    setPaused,
    setTimeMultiplier,
    setSoundOn,
    setLang,
    setManageOrderId,
    setDemoOpen,
  }
}
