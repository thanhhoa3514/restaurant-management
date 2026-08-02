// A per-device identifier the guest client sends when joining a table. The
// backend gates ordering on the *device* being approved by a waiter, so this id
// locates its device row while an unknown phone (a shared link opened elsewhere)
// lands in the waiting queue. It is deliberately NOT a security credential — a
// returning phone must also prove possession of its server-issued resume token.
const DEVICE_KEY = 'rm_device_id'

// In-memory fallback for private-mode / blocked storage so a device still gets a
// stable id for the lifetime of the tab.
let memoryDeviceId = ''

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    if (!memoryDeviceId) memoryDeviceId = randomId()
    return memoryDeviceId
  }
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = randomId()
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    if (!memoryDeviceId) memoryDeviceId = randomId()
    return memoryDeviceId
  }
}
