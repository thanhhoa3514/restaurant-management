import type { Session } from './types'

// Guest session persistence. The bearer token used to live in the URL (`?s=`)
// so a page refresh survived — but that also meant sharing the link handed a
// working credential to anyone. We keep the token on the device in localStorage
// instead: a refresh still restores the session, yet a shared link carries only
// the table's QR token (`?t=`) and forces the friend's phone through the
// device-approval gate. NOT shareable, NOT a security guarantee on its own —
// the backend still gates every order on the device being APPROVED.
const KEY = 'rm_guest_session'
const DEVICE_RESUME_KEY = 'rm_guest_device_resume'

// Drop a persisted session older than this so a stale token from a previous
// visit doesn't strand a returning guest on a broken menu.
const MAX_AGE_MS = 12 * 60 * 60 * 1000

interface StoredSession {
  accessToken: string
  table: string
  sessionId?: string
  tableId?: string
  status?: string
  startedAt: string
}

interface StoredDeviceResume {
  qrToken: string
  deviceAccessToken: string
  savedAt: string
}

// One-release localStorage compatibility only. The HTTP/API contract no longer
// accepts the legacy name; this prevents browsers already waiting for approval
// from losing the secret needed to resume their existing device row.
type LegacyStoredSession = Partial<StoredSession> & { token?: string }
type LegacyStoredDeviceResume = Partial<StoredDeviceResume> & { sessionToken?: string }

export function saveSession(s: Session): void {
  try {
    const startedAt = s.startedAt instanceof Date ? s.startedAt.toISOString() : String(s.startedAt)
    const payload: StoredSession = {
      accessToken: s.accessToken,
      table: s.table,
      sessionId: s.sessionId,
      tableId: s.tableId,
      status: s.status,
      startedAt,
    }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // storage blocked (private mode) — session simply won't survive a refresh
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as LegacyStoredSession
    const accessToken = p.accessToken ?? p.token
    if (!accessToken || !p.table || !p.startedAt) return null
    const started = new Date(p.startedAt)
    if (Number.isNaN(started.getTime()) || Date.now() - started.getTime() > MAX_AGE_MS) {
      clearSession()
      return null
    }
    return {
      accessToken,
      table: p.table,
      sessionId: p.sessionId,
      tableId: p.tableId,
      status: p.status,
      startedAt: started,
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

// A device id identifies the browser but is intentionally not a credential.
// Keep the server-issued device token separately so a refresh can prove it is
// resuming the same pending/approved device without the backend reissuing a
// bearer token to anyone who merely knows device_id.
export function saveDeviceAccessToken(qrToken: string, deviceAccessToken: string): void {
  try {
    const payload: StoredDeviceResume = {
      qrToken,
      deviceAccessToken,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(DEVICE_RESUME_KEY, JSON.stringify(payload))
  } catch {
    // storage blocked — the current tab still keeps the token in memory
  }
}

export function loadDeviceAccessToken(qrToken: string): string | undefined {
  try {
    const raw = localStorage.getItem(DEVICE_RESUME_KEY)
    if (!raw) return undefined
    const payload = JSON.parse(raw) as LegacyStoredDeviceResume
    const deviceAccessToken = payload.deviceAccessToken ?? payload.sessionToken
    if (!payload.savedAt) return undefined
    const savedAt = new Date(payload.savedAt)
    if (
      payload.qrToken !== qrToken ||
      !deviceAccessToken ||
      Number.isNaN(savedAt.getTime()) ||
      Date.now() - savedAt.getTime() > MAX_AGE_MS
    ) {
      return undefined
    }
    return deviceAccessToken
  } catch {
    return undefined
  }
}
