import { useState } from 'react'
import {
  Clock,
  Search,
  Calendar,
  Eye,
  CheckCircle2,
  Utensils,
  Receipt,
  CreditCard,
  MapPin,
  X,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import { useShellConfig } from '@/components/admin-shell'
import {
  useDailySessionsQuery,
  useSessionDetailQuery,
} from '@/features/dining/queries/useDailySessionsQuery'

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

export function SessionHistoryManagement() {
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateISO(new Date()))
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState<string>('')
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null)

  useShellConfig({
    title: 'Nhật ký phiên ăn',
    subtitle: 'Theo dõi chi tiết tất cả các phiên ăn trong ngày',
  })

  const { data, isLoading, refetch, isFetching } = useDailySessionsQuery({
    date: selectedDate,
    status: statusFilter,
    search: search.trim(),
  })

  const sessions = data?.sessions ?? []
  const stats = data?.stats ?? {
    total_sessions: 0,
    active_sessions: 0,
    closed_sessions: 0,
    total_revenue_vnd: 0,
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Đang phục vụ
          </span>
        )
      case 'AWAITING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="size-2 rounded-full bg-amber-500" />
            Chờ thanh toán
          </span>
        )
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-grouped)] text-[var(--text-secondary)] border border-[var(--separator)]/30">
            <CheckCircle2 size={12} />
            Đã hoàn thành
          </span>
        )
      case 'PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Clock size={12} />
            Chờ duyệt bàn
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-grouped)] text-[var(--text-tertiary)]">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-4 sm:p-5 rounded-2xl border border-[var(--separator)]/40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center shrink-0">
            <Clock className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] tracking-tight">
              Tra cứu phiên ăn theo ngày
            </h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              Quản lý lịch sử bàn ăn, món gọi & doanh thu thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(formatDateISO(new Date()))}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              selectedDate === formatDateISO(new Date())
                ? 'bg-[var(--system-blue)] text-white border-transparent shadow-sm'
                : 'bg-[var(--surface-grouped)] text-[var(--text-secondary)] border-[var(--separator)] hover:bg-[var(--surface-grouped)]/80'
            }`}
          >
            Hôm nay
          </button>

          <div className="relative flex items-center">
            <Calendar className="absolute left-3 size-4 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface-grouped)] border border-[var(--separator)]/60 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--system-blue)]"
            />
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl bg-[var(--surface-grouped)] text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--separator)]/60 transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--separator)]/40 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1.5">
            <Utensils className="size-3.5 text-[var(--system-blue)]" />
            Tổng phiên trong ngày
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[var(--text)] tracking-tight">
              {stats.total_sessions}
            </span>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">bàn ăn</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--separator)]/40 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Đang phục vụ / Chờ
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-500 tracking-tight">
              {stats.active_sessions}
            </span>
            <span className="text-xs font-semibold text-emerald-500/80">phiên active</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--separator)]/40 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-blue-500" />
            Đã thanh toán (Đóng)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-500 tracking-tight">
              {stats.closed_sessions}
            </span>
            <span className="text-xs font-semibold text-blue-500/80">đã hoàn thành</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--separator)]/40 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)] flex items-center gap-1.5">
            <Receipt className="size-3.5 text-purple-500" />
            Doanh thu phiên
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {formatVND(stats.total_revenue_vnd)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'ACTIVE', label: 'Đang ăn' },
            { id: 'AWAITING_PAYMENT', label: 'Chờ tính tiền' },
            { id: 'CLOSED', label: 'Đã hoàn thành' },
            { id: 'PENDING_VERIFICATION', label: 'Chờ duyệt' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[var(--text)] text-[var(--bg)] shadow-sm'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)] border border-[var(--separator)]/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo số bàn, mã phiên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-xl bg-[var(--surface)] border border-[var(--separator)]/60 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--system-blue)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--separator)]/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-semibold text-[var(--text-tertiary)] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="size-6 animate-spin text-[var(--system-blue)]" />
            Đang tải nhật ký phiên ăn...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <div className="size-16 rounded-full bg-[var(--surface-grouped)] flex items-center justify-center text-[var(--text-tertiary)]">
              <Clock className="size-8 stroke-[1.5]" />
            </div>
            <p className="text-sm font-bold text-[var(--text)]">Không tìm thấy phiên ăn nào</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
              Thử thay đổi ngày chọn hoặc bộ lọc trạng thái để xem thông tin lịch sử phiên ăn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-grouped)]/60 border-b border-[var(--separator)]/40 text-[var(--text-tertiary)] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Mã phiên / Bàn</th>
                  <th className="py-3 px-4">Khu vực</th>
                  <th className="py-3 px-4">Khách / Hình thức</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Người mở / Đóng</th>
                  <th className="py-3 px-4 text-right">Số món</th>
                  <th className="py-3 px-4 text-right">Tổng tiền</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--separator)]/30">
                {sessions.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--surface-grouped)]/40 transition-colors group cursor-pointer"
                    onClick={() => setDetailSessionId(item.id)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--text)] text-sm group-hover:text-[var(--system-blue)] transition-colors">
                          {item.table_name || item.table_code}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                          {item.session_code || `#${item.id.slice(0, 8)}`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] font-medium">
                        <MapPin size={12} className="text-[var(--text-tertiary)]" />
                        {item.area_name}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--text)]">
                          {item.customer_name || 'Khách tại bàn'}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {item.opened_via === 'QR_SCAN' ? '📱 Khách quét QR' : '👤 Nhân viên mở'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{statusBadge(item.status)}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-semibold text-[var(--text-secondary)]">
                          {formatTime(item.opened_at)}{' '}
                          {item.closed_at ? `→ ${formatTime(item.closed_at)}` : ''}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {item.duration_minutes} phút
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-medium text-[var(--text-secondary)]">
                          {item.opened_by_name}
                        </span>
                        {item.closed_by_name && (
                          <span className="text-[10px] text-[var(--text-tertiary)]">
                            Thu: {item.closed_by_name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--surface-grouped)] font-bold text-[var(--text-secondary)] text-xs">
                        {item.total_items_count} món
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-sm text-[var(--text)]">
                        {formatVND(item.total_amount_vnd)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDetailSessionId(item.id)
                        }}
                        className="p-1.5 rounded-lg bg-[var(--system-blue)]/10 text-[var(--system-blue)] hover:bg-[var(--system-blue)] hover:text-white transition-all cursor-pointer"
                        title="Xem chi tiết phiên ăn"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {detailSessionId && (
        <SessionDetailModal sessionId={detailSessionId} onClose={() => setDetailSessionId(null)} />
      )}
    </div>
  )
}

function SessionDetailModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: detail, isLoading } = useSessionDetailQuery(sessionId)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] w-full max-w-2xl rounded-3xl border border-[var(--separator)]/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--separator)]/40 flex items-center justify-between bg-[var(--surface-grouped)]/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center font-black text-base">
              <Utensils size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[var(--text)] tracking-tight">
                  {detail?.table_name || detail?.table_code || 'Chi tiết phiên ăn'}
                </h3>
                {detail && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--surface-grouped)] text-[var(--text-tertiary)] border border-[var(--separator)]/30">
                    {detail.session_code || `#${detail.id.slice(0, 8)}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Khu vực: {detail?.area_name ?? '--'} | Mở lúc:{' '}
                {formatTime(detail?.opened_at ?? null)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)] hover:text-[var(--text)] flex items-center justify-center border border-[var(--separator)]/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {isLoading || !detail ? (
            <div className="p-12 text-center text-xs font-semibold text-[var(--text-tertiary)] flex items-center justify-center gap-2">
              <RefreshCw className="size-5 animate-spin text-[var(--system-blue)]" />
              Đang tải chi tiết phiên ăn...
            </div>
          ) : (
            <>
              {/* Session Overview Stats */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--surface-grouped)]/40 border border-[var(--separator)]/30 text-xs">
                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] block">
                    Thời gian phục vụ
                  </span>
                  <span className="font-bold text-[var(--text)]">
                    {detail.duration_minutes} phút ({formatTime(detail.opened_at)} →{' '}
                    {formatTime(detail.closed_at)})
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] block">
                    Người mở bàn
                  </span>
                  <span className="font-bold text-[var(--text)]">{detail.opened_by_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-tertiary)] block">
                    Thu ngân chốt đơn
                  </span>
                  <span className="font-bold text-[var(--text)]">
                    {detail.closed_by_name || 'Chưa đóng'}
                  </span>
                </div>
              </div>

              {/* Orders Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-[var(--system-blue)]" />
                  Món ăn đã gọi ({detail.orders.reduce((sum, o) => sum + o.items.length, 0)} món)
                </h4>

                {detail.orders.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] italic p-4 text-center bg-[var(--surface-grouped)]/30 rounded-xl">
                    Chưa có món nào được gọi trong phiên ăn này.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detail.orders.map((ord, idx) => (
                      <div
                        key={ord.order_id}
                        className="rounded-2xl border border-[var(--separator)]/40 bg-[var(--surface-grouped)]/20 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--separator)]/30">
                          <span className="font-bold text-[var(--text)]">
                            Đợt #{idx + 1} ({ord.order_number || ord.order_id.slice(0, 6)})
                          </span>
                          <span className="text-[11px] text-[var(--text-tertiary)]">
                            Gửi lúc: {formatTime(ord.submitted_at)}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {ord.items.map((item) => (
                            <div
                              key={item.order_item_id}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="size-5 rounded-md bg-[var(--system-blue)]/10 text-[var(--system-blue)] font-extrabold text-[11px] flex items-center justify-center">
                                  x{item.quantity}
                                </span>
                                <div>
                                  <span className="font-semibold text-[var(--text)]">
                                    {item.menu_item_name}
                                  </span>
                                  {item.variant_name && (
                                    <span className="text-[11px] text-[var(--text-tertiary)] ml-1.5">
                                      ({item.variant_name})
                                    </span>
                                  )}
                                  {item.note && (
                                    <p className="text-[10px] text-amber-500 italic">
                                      Ghi chú: {item.note}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <span className="font-bold text-[var(--text)]">
                                {formatVND(item.subtotal_vnd)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invoices Section */}
              {detail.invoices.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={14} className="text-emerald-500" />
                    Hóa đơn & Thanh toán
                  </h4>

                  <div className="space-y-2">
                    {detail.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <CreditCard size={16} className="text-emerald-500" />
                          <div>
                            <span className="font-bold text-[var(--text)]">
                              {inv.invoice_number}
                            </span>
                            <span className="text-[11px] text-[var(--text-tertiary)] block">
                              Phương thức: {inv.payment_method || 'Tiền mặt'} |{' '}
                              {formatTime(inv.paid_at)}
                            </span>
                          </div>
                        </div>

                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatVND(inv.grand_total_vnd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Total */}
        {detail && (
          <div className="p-4 bg-[var(--surface-grouped)] border-t border-[var(--separator)]/40 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              Tổng doanh thu phiên này:
            </span>
            <span className="text-xl font-black text-[var(--text)]">
              {formatVND(detail.total_amount_vnd)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
