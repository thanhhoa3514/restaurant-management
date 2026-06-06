import type { Lang } from '@/lib/use-lang'

type DictValue = string | ((...args: never[]) => string)

/** Page-level strings for admin routes (dashboard, table-QR manager). */
export const ADMIN_DICT: Record<Lang, Record<string, DictValue>> = {
  vi: {
    dashboard_title: 'Tổng quan vận hành',

    metric_revenue: 'Doanh thu hôm nay',
    metric_tables: 'Bàn đang hoạt động',
    metric_kitchen: 'Món chờ bếp',
    metric_payments: 'Yêu cầu thanh toán',

    staff_on_shift: 'Ca trực nhân viên',
    active_count: (n: number) => `${n} đang hoạt động`,
    col_staff: 'Nhân viên',
    col_code: 'Mã số',
    col_dept: 'Bộ phận',
    col_status: 'Trạng thái',
    col_time: 'Thời gian',
    on_duty: 'Đang trực',

    quick_actions: 'Lệnh nhanh',
    action_report: 'Xem báo cáo doanh thu',
    action_report_desc: 'Xuất file tài chính ngày',
    action_floor: 'Cấu hình sơ đồ bàn',
    action_floor_desc: 'Chỉnh phân khu và sức chứa',
    action_menu: 'Quản lý danh mục món',
    action_menu_desc: 'Đổi giá, ẩn/hiện món',

    qr_title: 'Mã QR theo bàn',
    qr_subtitle: 'Tạo và xoay mã QR gọi món cho từng bàn',
    qr_summary: (withQr: number, total: number) => `${withQr}/${total} bàn có mã QR`,
    qr_loading: 'Đang tải danh sách bàn…',
    qr_load_error: 'Không tải được danh sách bàn',
    qr_unknown_error: 'lỗi không xác định',
    qr_empty: 'Chưa có bàn nào. Thêm bàn ở phần quản lý sơ đồ trước.',
    qr_has: 'Đã có mã QR',
    qr_none: 'Chưa tạo mã',
    qr_link: 'Liên kết gọi món',
    qr_generating: 'Đang tạo mã…',
    qr_copy: 'Chép link',
    qr_copied: 'Đã chép',
    qr_download: 'Tải PNG',
    qr_rotate: 'Xoay mã QR mới',
    qr_create_hint: 'Bàn này chưa có mã QR. Tạo mã để khách quét và gọi món.',
    qr_create: 'Tạo mã QR',
    qr_creating: 'Đang tạo…',
    qr_action_failed: 'Thao tác thất bại',
    qr_rotate_title: 'Xoay mã QR',
    qr_rotate_desc: (name: string) =>
      `Tạo mã QR mới cho ${name} sẽ vô hiệu hóa mã đang in/dán tại bàn. Khách dùng mã cũ sẽ không gọi món được. Hành động này không thể hoàn tác.`,
    qr_rotate_confirm: 'Xoay mã',
    qr_cancel: 'Hủy',
    qr_confirm_placeholder: (code: string) => `Nhập mã bàn "${code}" để xác nhận`,
  },
  en: {
    dashboard_title: 'Operations overview',

    metric_revenue: "Today's revenue",
    metric_tables: 'Active tables',
    metric_kitchen: 'Items in kitchen',
    metric_payments: 'Payment requests',

    staff_on_shift: 'Staff on shift',
    active_count: (n: number) => `${n} active`,
    col_staff: 'Staff',
    col_code: 'Code',
    col_dept: 'Department',
    col_status: 'Status',
    col_time: 'Time',
    on_duty: 'On duty',

    quick_actions: 'Quick actions',
    action_report: 'View revenue report',
    action_report_desc: 'Export daily financials',
    action_floor: 'Configure floor plan',
    action_floor_desc: 'Adjust zones & capacity',
    action_menu: 'Manage menu catalog',
    action_menu_desc: 'Edit prices, toggle items',

    qr_title: 'Table QR codes',
    qr_subtitle: 'Create and rotate ordering QR codes per table',
    qr_summary: (withQr: number, total: number) => `${withQr}/${total} tables have a QR code`,
    qr_loading: 'Loading tables…',
    qr_load_error: 'Could not load tables',
    qr_unknown_error: 'unknown error',
    qr_empty: 'No tables yet. Add tables in floor management first.',
    qr_has: 'QR code active',
    qr_none: 'No QR yet',
    qr_link: 'Ordering link',
    qr_generating: 'Generating…',
    qr_copy: 'Copy link',
    qr_copied: 'Copied',
    qr_download: 'Download PNG',
    qr_rotate: 'Rotate QR code',
    qr_create_hint: 'This table has no QR code yet. Create one for guests to scan and order.',
    qr_create: 'Create QR code',
    qr_creating: 'Creating…',
    qr_action_failed: 'Action failed',
    qr_rotate_title: 'Rotate QR code',
    qr_rotate_desc: (name: string) =>
      `Generating a new QR code for ${name} will invalidate the one printed at the table. Guests using the old code cannot order. This cannot be undone.`,
    qr_rotate_confirm: 'Rotate',
    qr_cancel: 'Cancel',
    qr_confirm_placeholder: (code: string) => `Enter table code "${code}" to confirm`,
  },
}

export type AdminT = (key: string, ...args: Array<string | number>) => string

export function makeAdminT(lang: Lang): AdminT {
  return (key, ...args) => {
    const value = ADMIN_DICT[lang][key]
    if (typeof value === 'function') return value(...(args as never[]))
    return value ?? key
  }
}
