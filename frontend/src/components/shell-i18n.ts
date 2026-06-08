import type { Lang } from '@/lib/use-lang'
import type { StaffRole } from '@/lib/auth'

/**
 * Chrome strings for the staff shell (sidebar nav, header, profile, command
 * palette, settings). Kept in one place so the shell is bilingual and survives
 * the future single-shell collapse. Page-specific copy lives in each feature's
 * own dict (e.g. features/admin/data/i18n.ts).
 */
export interface ShellStrings {
  roleLabel: Record<StaffRole, string>
  navGroup: Record<'manage' | 'operate', string>
  navLabel: Record<string, string>
  navDesc: Record<string, string>
  staffOs: string
  search: string
  searchPlaceholder: string
  searchEmpty: string
  searchAria: string
  closeSearchAria: string
  openNavAria: string
  openProfileAria: string
  openSettingsAria: string
  navAria: string
  staffFallback: string
  logout: string
  settingsTitle: string
  displayMode: string
  navFilteredBy: (role: string) => string
}

const SHELL: Record<Lang, ShellStrings> = {
  vi: {
    roleLabel: { admin: 'Quản trị', cashier: 'Thu ngân', waiter: 'Phục vụ', kitchen: 'Bếp' },
    navGroup: { manage: 'Quản lý', operate: 'Vận hành' },
    navLabel: {
      dashboard: 'Tổng quan',
      'table-qrs': 'Mã QR bàn',
      catalog: 'Danh mục món',
      staff: 'Nhân sự',
      reports: 'Báo cáo',
      settings: 'Cài đặt',
      cashier: 'Thanh toán',
      waiter: 'Sơ đồ bàn',
      kitchen: 'Bếp KDS',
    },
    navDesc: {
      dashboard: 'Tổng quan vận hành',
      'table-qrs': 'Tạo và xoay mã QR gọi món',
      catalog: 'Ẩn/hiện món và cập nhật giá',
      staff: 'Vai trò và ca trực',
      reports: 'Doanh thu và vận hành',
      settings: 'Nhà hàng và giao diện',
      cashier: 'Hóa đơn và POS',
      waiter: 'Phòng ăn và yêu cầu',
      kitchen: 'Hàng đợi món',
    },
    staffOs: 'Staff OS',
    search: 'Tìm kiếm',
    searchPlaceholder: 'Tìm trang, báo cáo, thao tác...',
    searchEmpty: 'Không tìm thấy tác vụ phù hợp.',
    searchAria: 'Tìm kiếm tác vụ',
    closeSearchAria: 'Đóng tìm kiếm',
    openNavAria: 'Mở điều hướng nhân viên',
    openProfileAria: 'Mở menu hồ sơ',
    openSettingsAria: 'Mở cài đặt giao diện',
    navAria: 'Điều hướng nhân viên',
    staffFallback: 'Nhân viên',
    logout: 'Đăng xuất',
    settingsTitle: 'Cấu hình giao diện',
    displayMode: 'Chế độ hiển thị',
    navFilteredBy: (role) => `Điều hướng lọc theo quyền của ${role}.`,
  },
  en: {
    roleLabel: { admin: 'Management', cashier: 'Cashier', waiter: 'Service', kitchen: 'Kitchen' },
    navGroup: { manage: 'Manage', operate: 'Operate' },
    navLabel: {
      dashboard: 'Overview',
      'table-qrs': 'Table QR codes',
      catalog: 'Menu catalog',
      staff: 'Staff',
      reports: 'Reports',
      settings: 'Settings',
      cashier: 'Payments',
      waiter: 'Floor plan',
      kitchen: 'Kitchen KDS',
    },
    navDesc: {
      dashboard: 'Operations overview',
      'table-qrs': 'Create & rotate ordering QR codes',
      catalog: 'Toggle items & update prices',
      staff: 'Roles & shifts',
      reports: 'Revenue & operations',
      settings: 'Restaurant & appearance',
      cashier: 'Invoices & POS',
      waiter: 'Dining room & requests',
      kitchen: 'Order queue',
    },
    staffOs: 'Staff OS',
    search: 'Search',
    searchPlaceholder: 'Search pages, reports, actions...',
    searchEmpty: 'No matching actions.',
    searchAria: 'Search actions',
    closeSearchAria: 'Close search',
    openNavAria: 'Open staff navigation',
    openProfileAria: 'Open profile menu',
    openSettingsAria: 'Open appearance settings',
    navAria: 'Staff navigation',
    staffFallback: 'Staff',
    logout: 'Log out',
    settingsTitle: 'Appearance',
    displayMode: 'Display mode',
    navFilteredBy: (role) => `Navigation filtered by ${role} permissions.`,
  },
}

export const shellStrings = (lang: Lang): ShellStrings => SHELL[lang]
