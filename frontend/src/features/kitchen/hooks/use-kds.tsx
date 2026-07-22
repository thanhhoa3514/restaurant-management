import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { toast } from 'sonner'

import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { minStatus, nextStatus, urgencyFor } from '@/features/kitchen/helpers'
import type { ItemStatus, KDSStats, Lang, Ticket, Urgency } from '@/features/kitchen/types'
import { ApiError, errorMessage } from '@/lib/api'
import {
  reviewCancelRequest,
  updateKitchenOrderItemStatus,
  type CancelRequestDTO,
} from '@/features/kitchen/api'
import { useKdsQueue } from '@/features/kitchen/queries/use-kds-queue'
import { useCancelRequests } from '@/features/kitchen/queries/use-cancel-requests'

type KdsDictKey = keyof (typeof KDS_DICT)['vi']
type KdsDictFunction = (...args: Array<number | string>) => string

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
    case 'placed':
    case 'cancelled':
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
  cancelRequests: CancelRequestDTO[]
  t: (key: KdsDictKey, ...args: Array<number | string>) => string
  advanceAll: (orderId: string) => void
  advanceItem: (orderId: string, itemId: string) => void
  reviewCancel: (cancelRequestId: string, action: 'approve' | 'reject') => void
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

  const { tickets, refetch: refetchQueue } = useKdsQueue(paused)
  const { cancelRequests, refetch: refetchCancelRequests } = useCancelRequests(paused)

  const langRef = useRef(lang)
  const soundOnRef = useRef(soundOn)
  const prevUrgencyRef = useRef<Record<string, Urgency>>({})
  const ticketsRef = useRef(tickets)
  const fadingIdsRef = useRef(fadingIds)

  useEffect(() => {
    langRef.current = lang
  }, [lang])
  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])
  useEffect(() => {
    ticketsRef.current = tickets
  }, [tickets])
  useEffect(() => {
    fadingIdsRef.current = fadingIds
  }, [fadingIds])

  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('rest_lang_kds', newLang)
    setLangState(newLang)
  }, [])

  const t = useCallback((key: KdsDictKey, ...args: Array<number | string>) => {
    const value = KDS_DICT[langRef.current][key]
    if (typeof value === 'function') return (value as unknown as KdsDictFunction)(...args)
    return value ?? key
  }, [])

  const notify = useCallback((message: string, isError = false) => {
    if (isError) {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [])

  // ── Timer: urgency tracking ────────────────────────────────────────────────
  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow((prev) => {
        const nextNow = new Date(prev.getTime() + 1_000 * timeMultiplier)
        const nextUrgency: Record<string, Urgency> = {}
        let justWentRed = false

        for (const ticket of ticketsRef.current) {
          if (fadingIdsRef.current.has(ticket.order_id)) continue
          if (ticket.items.every((item) => item.status === 'served')) continue

          const waitSec = Math.max(
            0,
            Math.floor((nextNow.getTime() - ticket.submitted_at.getTime()) / 1_000),
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
        return nextNow
      })
    }, 1_000)
    return () => window.clearInterval(timerId)
  }, [timeMultiplier, notify])

  // ── Advance all items in an order ───────────────────────────────────────────
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
        ticket.items.reduce((acc, item) => {
          if (item.status === lowestStatus) {
            acc.push(updateKitchenOrderItemStatus(item.id, target))
          }
          return acc
        }, [] as Promise<unknown>[]),
      )
        .then(() => {
          if (toastKey) notify(t(toastKey, ticket.table_number))
          refetchQueue()
        })
        .catch((err) => {
          notify(err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ', true)
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
      void updateKitchenOrderItemStatus(item.id, target)
        .then(() => {
          notify(t('toast_item_advanced', advancedName))
          refetchQueue()
        })
        .catch((err) => {
          notify(errorMessage(err, 'Không thể kết nối máy chủ'), true)
        })
    },
    [notify, refetchQueue, t, tickets],
  )

  const reviewCancel = useCallback(
    (cancelRequestId: string, action: 'approve' | 'reject') => {
      void reviewCancelRequest(cancelRequestId, action)
        .then(() => {
          notify(t(action === 'approve' ? 'cancel_approved' : 'cancel_rejected'))
          refetchCancelRequests()
          refetchQueue()
        })
        .catch((err) => {
          notify(errorMessage(err, 'Không thể kết nối máy chủ'), true)
        })
    },
    [notify, refetchCancelRequests, refetchQueue, t],
  )

  useEffect(() => {
    for (const ticket of tickets) {
      if (fadingIdsRef.current.has(ticket.order_id)) continue
      if (ticket.items.length === 0) continue
      if (!ticket.items.every((item) => item.status === 'served')) continue

      setFadingIds((current) => new Set(current).add(ticket.order_id))
      window.setTimeout(() => {
        setFadingIds((current) => {
          const next = new Set(current)
          next.delete(ticket.order_id)
          return next
        })
        refetchQueue()
      }, FADE_OUT_MS)
    }
  }, [tickets, refetchQueue])

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
    () => tickets.toSorted((a, b) => a.submitted_at.getTime() - b.submitted_at.getTime()),
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
    cancelRequests,
    t,
    advanceAll,
    advanceItem,
    reviewCancel,
    injectNewTicket: refetchQueue,
    setPaused,
    setTimeMultiplier,
    setSoundOn,
    setLang,
    setManageOrderId,
    setDemoOpen,
  }
}
