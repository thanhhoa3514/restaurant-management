import { useEffect, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { playNewOrderSound, playKitchenReadySound, playCallWaiterSound } from '@/lib/sound'
import { getStaffSession, subscribeStaffSession } from '@/lib/auth'
import { getGuestRealtimeToken, subscribeGuestRealtimeToken } from '@/lib/realtime-auth'

const PING_INTERVAL = 25_000
const INACTIVITY_TIMEOUT = 60_000

export interface RealtimeEvent {
  type: string
  payload?: any
}

function realtimeURL(): string {
  const explicit = import.meta.env.VITE_WS_URL
  if (explicit) return explicit

  const apiURL = import.meta.env.VITE_API_URL
  if (apiURL) {
    const url = new URL(apiURL, window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/ws'
    url.search = ''
    url.hash = ''
    return url.toString()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

function realtimeAuthMessage():
  | { type: '_auth'; access_token: string }
  | { type: '_auth'; session_token: string }
  | null {
  const staffToken = getStaffSession()?.token
  if (staffToken) return { type: '_auth', access_token: staffToken }

  const guestToken = getGuestRealtimeToken() ?? new URLSearchParams(window.location.search).get('s')
  if (guestToken) return { type: '_auth', session_token: guestToken }
  return null
}

// `order.updated` / `order.cancelled` (khách sửa/huỷ món) dùng prefix `order.`, không phải `ordering.`
function isOrderEvent(type: string): boolean {
  return type.startsWith('ordering.') || type.startsWith('order.')
}

function shouldInvalidateStaff(type: string): boolean {
  return (
    isOrderEvent(type) ||
    type.startsWith('dining.') ||
    type.startsWith('billing.') ||
    type.startsWith('cancel_request.') ||
    type.startsWith('catalog.')
  )
}

function shouldInvalidateKitchen(type: string): boolean {
  return isOrderEvent(type) || type.startsWith('cancel_request.') || type.startsWith('catalog.')
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)
  const stoppedRef = useRef(false)
  const attemptRef = useRef(0)
  const reconnectTimerRef = useRef<number | undefined>(undefined)
  const pingTimerRef = useRef<number | undefined>(undefined)
  const activityTimerRef = useRef<number | undefined>(undefined)
  const lastActivityRef = useRef(Date.now())

  const invalidateAndNotify = (event: RealtimeEvent) => {
    const type = event.type || ''
    const payload = event.payload || {}

    // Invalidate TanStack Query caches
    if (shouldInvalidateStaff(type)) {
      void queryClient.invalidateQueries({ queryKey: ['staff'] })
      void queryClient.invalidateQueries({ queryKey: ['dining'] })
      void queryClient.invalidateQueries({ queryKey: ['cashier'] })
      // Dashboard đếm đơn/doanh thu — trước đây chỉ dựa vào poll 30s
      void queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
    }
    if (shouldInvalidateKitchen(type)) {
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    }
    if (type.startsWith('identity.')) {
      void queryClient.invalidateQueries({ queryKey: ['identity'] })
    }
    if (type.startsWith('catalog.')) {
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['guest-categories'] })
      void queryClient.invalidateQueries({ queryKey: ['guest-items'] })
      void queryClient.invalidateQueries({ queryKey: ['guest-item'] })
    }
    if (isOrderEvent(type) || type.startsWith('dining.')) {
      void queryClient.invalidateQueries({ queryKey: ['guest-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['guest-items'] })
    }
    if (type.startsWith('billing.') || type === 'dining.session_reopened') {
      void queryClient.invalidateQueries({ queryKey: ['guest-payment'] })
    }

    // Toast/chuông tách theo người xem: máy nhân viên và máy khách nghe hai thứ khác nhau
    if (getStaffSession()) notifyStaff(type, payload)
    else notifyGuest(type, payload)
  }

  const notifyStaff = (type: string, payload: any) => {
    if (type === 'ordering.order_placed') {
      playNewOrderSound()
      const tableName = payload?.table_code || payload?.table_number || payload?.table_id
      toast.info(tableName ? `Đơn mới từ Bàn ${tableName}` : 'Có đơn hàng mới!', {
        description: 'Hệ thống đã tự động cập nhật danh sách đơn.',
      })
    } else if (type === 'ordering.item_status_updated' && payload?.status === 'READY') {
      playKitchenReadySound()
      const tableName = payload?.table_code || payload?.table_number
      const itemName = payload?.item_name || 'Món ăn'
      toast.success(
        tableName
          ? `Bếp báo món "${itemName}" của Bàn ${tableName} đã xong!`
          : `Món "${itemName}" đã sẵn sàng!`,
        {
          description: 'Vui lòng nhận món và phục vụ cho khách.',
        },
      )
    } else if (type === 'dining.waiter_called') {
      playCallWaiterSound()
      const tableName = payload?.table_code || payload?.table_number
      toast.warning(tableName ? `Bàn ${tableName} gọi phục vụ!` : 'Có yêu cầu trợ giúp tại bàn!', {
        description: payload?.reason || 'Vui lòng kiểm tra bàn khách.',
      })
    } else if (type === 'dining.bill_requested') {
      playCallWaiterSound()
      const tableName = payload?.table_code || payload?.table_number
      toast.warning(
        tableName ? `Bàn ${tableName} yêu cầu thanh toán!` : 'Khách vừa yêu cầu thanh toán!',
        {
          description: 'Đã báo quầy thu ngân.',
        },
      )
    } else if (type === 'dining.qr_scanned') {
      playNewOrderSound()
      const tableName = payload?.table_code || payload?.table_number
      if (tableName) {
        toast.info(`Bàn ${tableName} vừa mở phiên gọi món.`)
      }
    }
  }

  // Khách chỉ quan tâm món của mình: duyệt / bếp nhận / xong / bị từ chối / hết món.
  // PREPARING và SERVED cố tình im — bếp bấm liên tục sẽ spam, còn SERVED thì món đã ở trước mặt.
  const notifyGuest = (type: string, payload: any) => {
    const vi = ((localStorage.getItem('rest_lang_customer') as string) || 'vi') === 'vi'
    const name = payload?.item_name || (vi ? 'Món' : 'Item')
    const reason = payload?.reason

    if (type === 'ordering.item_confirmed') {
      toast.success(vi ? `Đã duyệt "${name}"` : `"${name}" approved`, {
        description: vi ? 'Món đã được chuyển xuống bếp.' : 'Sent to the kitchen.',
      })
    } else if (type === 'ordering.item_rejected') {
      toast.error(vi ? `"${name}" bị từ chối` : `"${name}" was rejected`, { description: reason })
    } else if (type === 'ordering.item_unavailable') {
      toast.warning(vi ? `"${name}" đã hết` : `"${name}" is sold out`, { description: reason })
    } else if (type === 'ordering.item_status_updated') {
      if (payload?.status === 'ACKNOWLEDGED') {
        toast.info(vi ? `Bếp đã nhận "${name}"` : `Kitchen accepted "${name}"`)
      } else if (payload?.status === 'READY') {
        playKitchenReadySound()
        toast.success(vi ? `"${name}" đã xong` : `"${name}" is ready`, {
          description: vi ? 'Nhân viên đang mang ra bàn.' : 'A server is bringing it over.',
        })
      }
    } else if (type === 'cancel_request.reviewed') {
      const approved = payload?.status === 'APPROVED'
      toast.info(
        approved
          ? vi
            ? 'Yêu cầu huỷ món được chấp nhận'
            : 'Cancellation approved'
          : vi
            ? 'Yêu cầu huỷ món bị từ chối'
            : 'Cancellation rejected',
      )
    }
  }

  const startActivityMonitor = () => {
    clearInterval(activityTimerRef.current)
    activityTimerRef.current = window.setInterval(() => {
      if (stoppedRef.current) return
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        socketRef.current?.close()
      }
    }, 10_000)
  }

  const clearTimers = () => {
    clearInterval(pingTimerRef.current)
    clearInterval(activityTimerRef.current)
    clearTimeout(reconnectTimerRef.current)
  }

  const connect = () => {
    if (stoppedRef.current) return
    if (!realtimeAuthMessage()) return

    const socket = new WebSocket(realtimeURL())
    socketRef.current = socket

    socket.onopen = () => {
      const authMessage = realtimeAuthMessage()
      if (!authMessage) {
        socket.close(1000, 'authentication unavailable')
        return
      }
      socket.send(JSON.stringify(authMessage))
      attemptRef.current = 0
      lastActivityRef.current = Date.now()

      // Send periodic ping to keep connection alive
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: '_ping' }))
        }
      }, PING_INTERVAL)

      startActivityMonitor()
    }

    socket.onmessage = (message) => {
      lastActivityRef.current = Date.now()
      try {
        const event = JSON.parse(message.data) as RealtimeEvent
        if (event.type && !event.type.startsWith('_')) {
          invalidateAndNotify(event)
          window.dispatchEvent(new CustomEvent(event.type, { detail: event.payload }))
        }
      } catch {
        // Ignore malformed realtime messages; REST polling remains fallback.
      }
    }

    socket.onclose = () => {
      clearTimers()
      if (stoppedRef.current) return
      const delay = Math.min(30_000, 1_000 * 2 ** attemptRef.current)
      attemptRef.current += 1
      reconnectTimerRef.current = window.setTimeout(connect, delay)
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  useEffect(() => {
    stoppedRef.current = false

    connect()

    const handleOnline = () => {
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        attemptRef.current = 0
        connect()
      }
    }
    window.addEventListener('online', handleOnline)

    const restartForAuthChange = () => {
      clearTimeout(reconnectTimerRef.current)
      attemptRef.current = 0
      if (socketRef.current) {
        socketRef.current.close(1000, 'authentication changed')
      } else {
        connect()
      }
    }
    const unsubscribeStaff = subscribeStaffSession(restartForAuthChange)
    const unsubscribeGuest = subscribeGuestRealtimeToken(restartForAuthChange)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          connect()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stoppedRef.current = true
      clearTimers()
      socketRef.current?.close()
      window.removeEventListener('online', handleOnline)
      unsubscribeStaff()
      unsubscribeGuest()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return children
}
