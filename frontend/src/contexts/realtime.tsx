import { useEffect, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const PING_INTERVAL = 25_000
const INACTIVITY_TIMEOUT = 60_000

interface RealtimeEvent {
  type: string
  payload?: unknown
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

function shouldInvalidateStaff(type: string): boolean {
  return (
    type.startsWith('ordering.') ||
    type.startsWith('dining.') ||
    type.startsWith('billing.') ||
    type.startsWith('cancel_request.') ||
    type.startsWith('catalog.')
  )
}

function shouldInvalidateKitchen(type: string): boolean {
  return (
    type.startsWith('ordering.') ||
    type.startsWith('cancel_request.') ||
    type.startsWith('catalog.')
  )
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

  const invalidateFor = (event: RealtimeEvent) => {
    if (shouldInvalidateStaff(event.type)) {
      void queryClient.invalidateQueries({ queryKey: ['staff'] })
      void queryClient.invalidateQueries({ queryKey: ['dining'] })
    }
    if (shouldInvalidateKitchen(event.type)) {
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    }
    if (event.type.startsWith('catalog.')) {
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
    }
    if (event.type.startsWith('ordering.') || event.type.startsWith('dining.')) {
      void queryClient.invalidateQueries({ queryKey: ['guest-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['guest-items'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
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

    const socket = new WebSocket(realtimeURL())
    socketRef.current = socket

    socket.onopen = () => {
      attemptRef.current = 0
      lastActivityRef.current = Date.now()

      // Gửi ping định kỳ để server biết mình còn sống (và ngược lại)
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
          // event _ping / _pong là internal, không broadcast
          invalidateFor(event)
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
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return children
}
