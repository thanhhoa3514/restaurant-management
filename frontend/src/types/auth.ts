export type StaffRole = 'admin' | 'cashier' | 'waiter' | 'kitchen'

export type BackendStaffRole = 'MANAGER' | 'CASHIER' | 'SERVER' | 'KITCHEN'

export interface StaffSession {
  code: string
  role: StaffRole
  backendRole: BackendStaffRole
  name: string
  token: string
  refreshToken: string
  userId: string
  expiresAt: string
  permissions: PermissionCode[]
}

export type PermissionCode =
  | 'billing.process'
  | 'identity.manage'
  | 'ordering.operate'
  | 'ordering.staff'
  | 'kitchen.operate'
  | 'dining.serve'
  | 'dining.cashier'
  | 'dining.manage'
  | 'catalog.manage'
