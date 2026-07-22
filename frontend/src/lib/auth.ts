import type { BackendStaffRole, PermissionCode, StaffRole, StaffSession } from '@/types/auth'
export type { BackendStaffRole, PermissionCode, StaffRole, StaffSession }

interface AuthEnvelope<T> {
  data: T | null
  meta?: unknown
  error?: { code: string; message: string } | null
}

interface AuthenticateResponse {
  token: string
  refresh_token: string
  user_id: string
  role: string
  name: string
  permissions: PermissionCode[]
  expires_at: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const STAFF_SESSION_EVENT = 'staff-session-changed'

const BACKEND_TO_ROLE: Record<BackendStaffRole, StaffRole> = {
  MANAGER: 'admin',
  CASHIER: 'cashier',
  SERVER: 'waiter',
  KITCHEN: 'kitchen',
}

// Seeded backend credentials from `backend/cmd/seed`.
export const DEMO_CREDENTIALS: Record<
  StaffRole,
  { code: string; pass: string; name: string }
> = {
  admin: { code: 'manager', pass: 'demo1234', name: 'Demo Manager' },
  cashier: { code: 'cashier', pass: 'demo1234', name: 'Demo Cashier' },
  waiter: { code: 'server', pass: 'demo1234', name: 'Demo Server' },
  kitchen: { code: 'kitchen', pass: 'demo1234', name: 'Demo Kitchen' },
}

function normalizeBackendRole(role: string): BackendStaffRole | null {
  const normalized = role.trim().toUpperCase()
  if (
    normalized === 'MANAGER' ||
    normalized === 'CASHIER' ||
    normalized === 'SERVER' ||
    normalized === 'KITCHEN'
  ) {
    return normalized
  }
  return null
}

function displayNameFor(username: string, backendRole: BackendStaffRole): string {
  const credential = Object.values(DEMO_CREDENTIALS).find(
    (item) => item.code.toLowerCase() === username.trim().toLowerCase(),
  )
  return credential?.name ?? (username.trim() || BACKEND_TO_ROLE[backendRole])
}

export async function loginStaff(
  code: string,
  pass: string,
): Promise<StaffSession | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/restaurant/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: code.trim(),
      password: pass,
    }),
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(res.ok ? 'Phản hồi đăng nhập không hợp lệ' : `Lỗi máy chủ (${res.status})`)
  }

  const envelope = (await res.json()) as AuthEnvelope<AuthenticateResponse>
  if (!res.ok || envelope.error || !envelope.data) {
    if (res.status === 401) return null
    throw new Error(envelope.error?.message ?? `Lỗi máy chủ (${res.status})`)
  }

  const backendRole = normalizeBackendRole(envelope.data.role)
  if (!backendRole) throw new Error('Vai trò người dùng không hợp lệ')

  const session: StaffSession = {
    code: code.trim(),
    role: BACKEND_TO_ROLE[backendRole],
    backendRole,
    name: envelope.data.name || displayNameFor(code, backendRole),
    token: envelope.data.token,
    refreshToken: envelope.data.refresh_token,
    userId: envelope.data.user_id,
    expiresAt: envelope.data.expires_at,
    permissions: envelope.data.permissions ?? [],
  }
  localStorage.setItem('staff_session:v1', JSON.stringify(session))
  window.dispatchEvent(new Event(STAFF_SESSION_EVENT))
  return session
}

// clearStaffSession is the synchronous local-only cleanup (no API call).
// Used in contexts where await is not possible (e.g. useReducer initializer).
export function clearStaffSession(): void {
  localStorage.removeItem('staff_session:v1')
  window.dispatchEvent(new Event(STAFF_SESSION_EVENT))
}

export async function logoutStaff(): Promise<void> {
  const session = getStaffSession()
  if (session?.token) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/restaurant/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
      })
    } catch {
      // Network error — still clear local state.
    }
  }
  clearStaffSession()
}

export function getStaffSession(): StaffSession | null {
  const raw = localStorage.getItem('staff_session:v1')
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<StaffSession>
    if (!session.token || !session.role || !session.expiresAt) return null
    session.permissions = Array.isArray(session.permissions) ? session.permissions : []
    return session as StaffSession
  } catch {
    return null
  }
}

export function isStaffAuthenticated(): boolean {
  const session = getStaffSession()
  if (!session) return false
  if (
    Number.isNaN(Date.parse(session.expiresAt)) ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    logoutStaff()
    return false
  }
  return true
}

export function hasStaffPermission(permission: PermissionCode): boolean {
  const session = getStaffSession()
  return Boolean(session?.permissions.includes(permission))
}

// RefreshResponse matches the backend POST /api/v1/restaurant/auth/refresh response.
interface RefreshResponse {
  token: string
  refresh_token: string
  expires_at: string
}

// Refresh the JWT using the stored refresh token.
// Returns the updated session or null if the refresh failed.
export async function refreshStaffSession(): Promise<StaffSession | null> {
  const current = getStaffSession()
  if (!current?.refreshToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/restaurant/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    })
    if (!res.ok) return null
    const envelope = (await res.json()) as AuthEnvelope<RefreshResponse>
    if (!envelope.data) return null

    const updated: StaffSession = {
      ...current,
      token: envelope.data.token,
      refreshToken: envelope.data.refresh_token,
      expiresAt: envelope.data.expires_at,
    }
    localStorage.setItem('staff_session:v1', JSON.stringify(updated))
    window.dispatchEvent(new Event(STAFF_SESSION_EVENT))
    return updated
  } catch {
    return null
  }
}

export function updateStaffSession(
  updates: Partial<Pick<StaffSession, 'name' | 'backendRole' | 'role' | 'permissions'>>,
): StaffSession | null {
  const current = getStaffSession()
  if (!current) return null
  const next = { ...current, ...updates }
  localStorage.setItem('staff_session:v1', JSON.stringify(next))
  window.dispatchEvent(new Event(STAFF_SESSION_EVENT))
  return next
}

export function subscribeStaffSession(listener: (session: StaffSession | null) => void): () => void {
  const handleChange = () => listener(getStaffSession())
  window.addEventListener(STAFF_SESSION_EVENT, handleChange)
  window.addEventListener('storage', handleChange)
  return () => {
    window.removeEventListener(STAFF_SESSION_EVENT, handleChange)
    window.removeEventListener('storage', handleChange)
  }
}
