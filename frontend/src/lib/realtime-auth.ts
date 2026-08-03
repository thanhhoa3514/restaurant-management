const GUEST_DEVICE_ACCESS_KEY = 'guest_device_access:v1'
const GUEST_DEVICE_ACCESS_EVENT = 'guest-device-access-changed'

export function getGuestDeviceAccessToken(): string | null {
  return sessionStorage.getItem(GUEST_DEVICE_ACCESS_KEY)
}

export function setGuestDeviceAccessToken(token: string): void {
  const normalized = token.trim()
  if (normalized) {
    sessionStorage.setItem(GUEST_DEVICE_ACCESS_KEY, normalized)
  } else {
    sessionStorage.removeItem(GUEST_DEVICE_ACCESS_KEY)
  }
  window.dispatchEvent(new Event(GUEST_DEVICE_ACCESS_EVENT))
}

export function subscribeGuestDeviceAccessToken(listener: () => void): () => void {
  window.addEventListener(GUEST_DEVICE_ACCESS_EVENT, listener)
  return () => window.removeEventListener(GUEST_DEVICE_ACCESS_EVENT, listener)
}
