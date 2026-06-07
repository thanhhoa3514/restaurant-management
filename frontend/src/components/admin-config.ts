import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  QrCode,
  Settings,
  Table2,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionCode, StaffRole } from '@/lib/auth'

export type NavHref = '/admin' | '/admin/table-qrs'
export type AdminView = 'dashboard' | 'cashier' | 'waiter' | 'kitchen'
export type StaffView = AdminView | 'table-qrs'

export interface NavItem {
  id: string
  href: NavHref
  view?: AdminView
  icon: LucideIcon
  permission: PermissionCode
}

export interface ToolItem {
  id: string
  icon: LucideIcon
  permission: PermissionCode
}

export const roleTint: Record<StaffRole, string> = {
  admin: 'var(--system-purple)',
  cashier: 'var(--system-green)',
  waiter: 'var(--system-blue)',
  kitchen: 'var(--system-orange)',
}

export const navItems: NavItem[] = [
  { id: 'dashboard', href: '/admin', view: 'dashboard', icon: LayoutDashboard, permission: 'identity.manage' },
  { id: 'table-qrs', href: '/admin/table-qrs', icon: QrCode, permission: 'dining.manage' },
  { id: 'cashier', href: '/admin', view: 'cashier', icon: CreditCard, permission: 'billing.process' },
  { id: 'waiter', href: '/admin', view: 'waiter', icon: Table2, permission: 'dining.serve' },
  { id: 'kitchen', href: '/admin', view: 'kitchen', icon: ChefHat, permission: 'kitchen.operate' },
]

export const adminTools: ToolItem[] = [
  { id: 'catalog', icon: ClipboardList, permission: 'catalog.manage' },
  { id: 'staff', icon: UsersRound, permission: 'identity.manage' },
  { id: 'reports', icon: BarChart3, permission: 'identity.manage' },
  { id: 'settings', icon: Settings, permission: 'identity.manage' },
]
