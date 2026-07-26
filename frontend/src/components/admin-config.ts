import {
  BarChart3,
  ChefHat,
  Clock,
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

export type NavHref =
  | '/admin'
  | '/admin/table-qrs'
  | '/admin/sessions'
  | '/admin/catalog'
  | '/admin/staff'
  | '/admin/reports'
  | '/admin/settings'
export type AdminView = 'dashboard' | 'cashier' | 'waiter' | 'kitchen'
export type ManageRoute = 'table-qrs' | 'sessions' | 'catalog' | 'staff' | 'reports' | 'settings'
export type StaffView = AdminView | ManageRoute

export type NavGroup = 'manage' | 'operate'

export interface NavItem {
  id: string
  group: NavGroup
  href: NavHref
  view?: AdminView
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
  {
    id: 'dashboard',
    group: 'manage',
    href: '/admin',
    view: 'dashboard',
    icon: LayoutDashboard,
    permission: 'identity.manage',
  },
  {
    id: 'table-qrs',
    group: 'manage',
    href: '/admin/table-qrs',
    icon: QrCode,
    permission: 'dining.manage',
  },
  {
    id: 'sessions',
    group: 'manage',
    href: '/admin/sessions',
    icon: Clock,
    permission: 'dining.manage',
  },
  {
    id: 'catalog',
    group: 'manage',
    href: '/admin/catalog',
    icon: ClipboardList,
    permission: 'catalog.manage',
  },
  {
    id: 'staff',
    group: 'manage',
    href: '/admin/staff',
    icon: UsersRound,
    permission: 'identity.manage',
  },
  {
    id: 'reports',
    group: 'manage',
    href: '/admin/reports',
    icon: BarChart3,
    permission: 'identity.manage',
  },
  {
    id: 'settings',
    group: 'manage',
    href: '/admin/settings',
    icon: Settings,
    permission: 'identity.manage',
  },

  {
    id: 'cashier',
    group: 'operate',
    href: '/admin',
    view: 'cashier',
    icon: CreditCard,
    permission: 'billing.process',
  },
  {
    id: 'waiter',
    group: 'operate',
    href: '/admin',
    view: 'waiter',
    icon: Table2,
    permission: 'dining.serve',
  },
  {
    id: 'kitchen',
    group: 'operate',
    href: '/admin',
    view: 'kitchen',
    icon: ChefHat,
    permission: 'kitchen.operate',
  },
]
