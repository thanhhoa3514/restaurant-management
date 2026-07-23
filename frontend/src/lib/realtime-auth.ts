const GUEST_REALTIME_TOKEN_KEY = 'guest_realtime_token:v1'
const GUEST_REALTIME_TOKEN_EVENT = 'guest-realtime-token-changed'

export function getGuestRealtimeToken(): string | null {
  return sessionStorage.getItem(GUEST_REALTIME_TOKEN_KEY)
}

export function setGuestRealtimeToken(token: string): void {
  const normalized = token.trim()
  if (normalized) {
    sessionStorage.setItem(GUEST_REALTIME_TOKEN_KEY, normalized)
  } else {
    sessionStorage.removeItem(GUEST_REALTIME_TOKEN_KEY)
  }
  window.dispatchEvent(new Event(GUEST_REALTIME_TOKEN_EVENT))
}

export function subscribeGuestRealtimeToken(listener: () => void): () => void {
  window.addEventListener(GUEST_REALTIME_TOKEN_EVENT, listener)
  return () => window.removeEventListener(GUEST_REALTIME_TOKEN_EVENT, listener)
}
