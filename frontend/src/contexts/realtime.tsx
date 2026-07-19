import { useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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

  useEffect(() => {
    let socket: WebSocket | null = null
    let stopped = false
    let reconnectTimer: number | undefined
    let attempts = 0

    const invalidateFor = (event: RealtimeEvent) => {
      if (shouldInvalidateStaff(event.type)) {
        void queryClient.invalidateQueries({ queryKey: ['staff'] })
      }
      if (shouldInvalidateKitchen(event.type)) {
        void queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      }
      if (event.type.startsWith('catalog.')) {
        void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      }
      if (event.type.startsWith('ordering.') || event.type.startsWith('dining.')) {
        void queryClient.invalidateQueries({ queryKey: ['guest-orders'] })
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    }

    const connect = () => {
      if (stopped) return
      socket = new WebSocket(realtimeURL())

      socket.onopen = () => {
        attempts = 0
      }

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent
          if (event.type) {
            invalidateFor(event)
            window.dispatchEvent(new CustomEvent(event.type, { detail: event.payload }))
          }
        } catch {
          // Ignore malformed realtime messages; REST polling remains fallback.
        }
      }

      socket.onclose = () => {
        if (stopped) return
        const delay = Math.min(30_000, 1_000 * 2 ** attempts)
        attempts += 1
        reconnectTimer = window.setTimeout(connect, delay)
      }

      socket.onerror = () => {
        socket?.close()
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [queryClient])

  return children
}
