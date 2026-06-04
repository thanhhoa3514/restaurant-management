export type StaffRole = 'admin' | 'cashier' | 'waiter' | 'kitchen'

type BackendStaffRole = 'MANAGER' | 'CASHIER' | 'SERVER' | 'KITCHEN'

export interface StaffSession {
  code: string
  restaurantCode: string
  role: StaffRole
  backendRole: BackendStaffRole
  name: string
  token: string
  userId: string
  restaurantId: string
  expiresAt: string
}

interface AuthEnvelope<T> {
  data: T | null
  meta?: unknown
  error?: { code: string; message: string } | null
}

interface AuthenticateResponse {
  token: string
  user_id: string
  role: string
  restaurant_id: string
  expires_at: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const ROLE_TO_BACKEND: Record<StaffRole, BackendStaffRole> = {
  admin: 'MANAGER',
  cashier: 'CASHIER',
  waiter: 'SERVER',
  kitchen: 'KITCHEN',
}

const BACKEND_TO_ROLE: Record<BackendStaffRole, StaffRole> = {
  MANAGER: 'admin',
  CASHIER: 'cashier',
  SERVER: 'waiter',
  KITCHEN: 'kitchen',
}

// Seeded backend credentials from `backend/cmd/seed`.
export const DEMO_CREDENTIALS: Record<
  StaffRole,
  { restaurantCode: string; code: string; pass: string; name: string }
> = {
  admin: { restaurantCode: 'DEMO', code: 'manager', pass: 'demo1234', name: 'Demo Manager' },
  cashier: { restaurantCode: 'DEMO', code: 'cashier', pass: 'demo1234', name: 'Demo Cashier' },
  waiter: { restaurantCode: 'DEMO', code: 'server', pass: 'demo1234', name: 'Demo Server' },
  kitchen: { restaurantCode: 'DEMO', code: 'kitchen', pass: 'demo1234', name: 'Demo Kitchen' },
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
  restaurantCode: string,
  code: string,
  pass: string,
  expectedRole: StaffRole,
): Promise<StaffSession | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/identity/authenticate`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_code: restaurantCode.trim(),
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
  if (backendRole !== ROLE_TO_BACKEND[expectedRole]) return null

  const session: StaffSession = {
    code: code.trim(),
    restaurantCode: restaurantCode.trim(),
    role: BACKEND_TO_ROLE[backendRole],
    backendRole,
    name: displayNameFor(code, backendRole),
    token: envelope.data.token,
    userId: envelope.data.user_id,
    restaurantId: envelope.data.restaurant_id,
    expiresAt: envelope.data.expires_at,
  }
  localStorage.setItem('staff_session', JSON.stringify(session))
  return session
}

export function logoutStaff(): void {
  localStorage.removeItem('staff_session')
}

export function getStaffSession(): StaffSession | null {
  const raw = localStorage.getItem('staff_session')
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<StaffSession>
    if (!session.token || !session.role || !session.expiresAt) return null
    return session as StaffSession
  } catch {
    return null
  }
}

export function isStaffAuthenticated(role?: StaffRole): boolean {
  const session = getStaffSession()
  if (!session) return false
  if (
    Number.isNaN(Date.parse(session.expiresAt)) ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    logoutStaff()
    return false
  }
  if (role && session.role !== role && session.role !== 'admin') {
    // Admin/manager has superuser access to all staff views.
    return false
  }
  return true
}
