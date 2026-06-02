export type StaffRole = 'admin' | 'cashier' | 'waiter' | 'kitchen'

export interface StaffSession {
  code: string
  role: StaffRole
  name: string
  token: string
}

// Pre-defined demo credentials
export const DEMO_CREDENTIALS: Record<StaffRole, { code: string; pass: string; name: string }> = {
  admin: { code: 'ADMIN001', pass: 'adminpassword', name: 'Nguyễn Quản Trị' },
  cashier: { code: 'CASH001', pass: 'cashierpassword', name: 'Trần Thu Ngân' },
  waiter: { code: 'WAIT001', pass: 'waiterpassword', name: 'Lê Phục Vụ' },
  kitchen: { code: 'KITCH001', pass: 'kitchenpassword', name: 'Phạm Đầu Bếp' },
}

export function loginStaff(code: string, pass: string, role: StaffRole): StaffSession | null {
  const target = DEMO_CREDENTIALS[role]
  if (target && target.code.toLowerCase() === code.trim().toLowerCase() && target.pass === pass) {
    const session: StaffSession = {
      code: target.code,
      role,
      name: target.name,
      token: `staff_jwt_mock_${role}_${Date.now()}`,
    }
    localStorage.setItem('staff_session', JSON.stringify(session))
    return session
  }
  return null
}

export function logoutStaff(): void {
  localStorage.removeItem('staff_session')
}

export function getStaffSession(): StaffSession | null {
  const raw = localStorage.getItem('staff_session')
  if (!raw) return null
  try {
    return JSON.parse(raw) as StaffSession
  } catch {
    return null
  }
}

export function isStaffAuthenticated(role?: StaffRole): boolean {
  const session = getStaffSession()
  if (!session) return false
  if (role && session.role !== role && session.role !== 'admin') {
    // Admin has superuser access to all views
    return false
  }
  return true
}
