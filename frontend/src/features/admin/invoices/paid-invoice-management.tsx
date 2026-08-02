import { useDeferredValue, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileSearch,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react'

import { useShellConfig } from '@/components/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api'
import { usePaidInvoiceDetail, usePaidInvoices } from './queries'
import type { PaidInvoiceDetail, PaidInvoiceListItem } from './types'
import './invoice-management.css'

const pageSize = 20

function localISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function dateTime(value: string | null): string {
  if (!value) return 'Chưa ghi nhận'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function methodLabel(invoice: PaidInvoiceListItem): string {
  return invoice.payment_method_names.join(' + ') || 'Chưa xác định'
}

function SummaryStrip({
  count,
  revenue,
  discount,
  average,
  loading,
}: {
  count: number
  revenue: number
  discount: number
  average: number
  loading: boolean
}) {
  const metrics = [
    { label: 'Hóa đơn', value: count.toLocaleString('vi-VN') },
    { label: 'Doanh thu', value: money(revenue) },
    { label: 'Giảm giá', value: money(discount) },
    { label: 'Trung bình', value: money(average) },
  ]

  return (
    <section className="invoice-summary" aria-label="Tổng hợp hóa đơn đã lọc">
      {metrics.map((metric) => (
        <div className="invoice-summary__item" key={metric.label}>
          <span>{metric.label}</span>
          {loading ? <Skeleton className="h-7 w-28" /> : <strong>{metric.value}</strong>}
        </div>
      ))}
    </section>
  )
}

function InvoiceDetailContent({
  detail,
  loading,
  error,
  onRetry,
}: {
  detail: PaidInvoiceDetail | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="invoice-detail__loading" aria-label="Đang tải chi tiết hóa đơn">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="invoice-state invoice-state--compact" role="alert">
        <CircleAlert aria-hidden="true" />
        <strong>Không tải được chi tiết hóa đơn</strong>
        <p>{errorMessage(error, 'Vui lòng thử tải lại.')}</p>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw />
          Thử lại
        </Button>
      </div>
    )
  }

  const { invoice, context } = detail
  const completedPayments = invoice.payments.filter((payment) => payment.status === 'COMPLETED')
  return (
    <div className="invoice-detail">
      <section className="invoice-detail__identity" aria-label="Thông tin hóa đơn">
        <div>
          <span>Mã hóa đơn</span>
          <strong className="invoice-mono">{invoice.invoice_number}</strong>
        </div>
        <Badge variant="success">Đã thanh toán</Badge>
        <dl>
          <div>
            <dt>Thời gian</dt>
            <dd>{dateTime(invoice.paid_at)}</dd>
          </div>
          <div>
            <dt>Bàn / loại đơn</dt>
            <dd>{context.table_label || 'Không xác định'}</dd>
          </div>
          <div>
            <dt>Phiên / đơn</dt>
            <dd className="invoice-mono">{context.session_reference || '—'}</dd>
          </div>
          <div>
            <dt>Khách hàng</dt>
            <dd>{context.customer_name || 'Khách lẻ'}</dd>
          </div>
          {context.customer_phone && (
            <div>
              <dt>Số điện thoại</dt>
              <dd>{context.customer_phone}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="invoice-detail__section">
        <div className="invoice-detail__section-heading">
          <h3>Món đã tính tiền</h3>
          <span>{invoice.items.reduce((sum, item) => sum + item.quantity, 0)} món</span>
        </div>
        <div className="invoice-lines">
          {invoice.items.map((item) => (
            <div className="invoice-line" key={item.id}>
              <div>
                <strong>{item.name_snapshot}</strong>
                <span>
                  {item.quantity} × {money(item.unit_price_vnd)}
                </span>
              </div>
              <span>{money(item.total_amount_vnd)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="invoice-detail__section">
        <h3>Thanh toán</h3>
        <div className="invoice-payments">
          {completedPayments.map((payment) => (
            <div className="invoice-payment" key={payment.id}>
              <div>
                <strong>{payment.method_code.toUpperCase()}</strong>
                <span className="invoice-mono">{payment.payment_number}</span>
                <span>{dateTime(payment.processed_at)}</span>
              </div>
              <strong>{money(payment.amount_vnd)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="invoice-totals" aria-label="Tổng tiền hóa đơn">
        <div>
          <span>Tạm tính</span>
          <span>{money(invoice.subtotal_vnd)}</span>
        </div>
        {invoice.discount_amount_vnd > 0 && (
          <div>
            <span>Giảm giá</span>
            <span>−{money(invoice.discount_amount_vnd)}</span>
          </div>
        )}
        {invoice.service_charge_amount_vnd > 0 && (
          <div>
            <span>Phí phục vụ</span>
            <span>{money(invoice.service_charge_amount_vnd)}</span>
          </div>
        )}
        {invoice.vat_amount_vnd > 0 && (
          <div>
            <span>VAT</span>
            <span>{money(invoice.vat_amount_vnd)}</span>
          </div>
        )}
        <div className="invoice-totals__grand">
          <strong>Tổng thanh toán</strong>
          <strong>{money(invoice.total_amount_vnd)}</strong>
        </div>
      </section>
    </div>
  )
}

export function PaidInvoiceManagement() {
  const today = localISODate(new Date())
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInvoiceID, setSelectedInvoiceID] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim())

  useShellConfig({
    eyebrow: 'Tài chính',
    title: 'Hóa đơn đã thanh toán',
    subtitle: 'Tra cứu giao dịch hoàn tất và đối soát doanh thu',
    contentClassName: 'invoice-shell',
  })

  const filters = {
    page,
    pageSize,
    search: deferredSearch,
    from,
    to,
    paymentMethod,
  }
  const invoiceQuery = usePaidInvoices(filters)
  const detailQuery = usePaidInvoiceDetail(selectedInvoiceID)
  const items = invoiceQuery.data?.items ?? []
  const summary = invoiceQuery.data?.summary ?? {
    invoice_count: 0,
    total_revenue_vnd: 0,
    total_discount_vnd: 0,
    average_invoice_vnd: 0,
  }
  const pagination = invoiceQuery.data?.pagination

  const resetFilters = () => {
    setSearch('')
    setFrom('')
    setTo('')
    setPaymentMethod('')
    setPage(1)
  }

  return (
    <>
      <main className="invoice-workbench">
        <section className="invoice-toolbar" aria-label="Bộ lọc hóa đơn">
          <div className="invoice-toolbar__heading">
            <SlidersHorizontal aria-hidden="true" />
            <div>
              <strong>Bộ lọc đối soát</strong>
              <span>Phạm vi mặc định là hôm nay</span>
            </div>
          </div>

          <label className="invoice-field invoice-field--search">
            <span>Tìm hóa đơn</span>
            <div className="invoice-search">
              <Search aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Mã hóa đơn, bàn, khách, giao dịch..."
              />
            </div>
          </label>

          <label className="invoice-field">
            <span>Từ ngày</span>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="invoice-field">
            <span>Đến ngày</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="invoice-field">
            <span>Phương thức</span>
            <select
              className="invoice-select"
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả phương thức</option>
              {invoiceQuery.data?.payment_methods.map((method) => (
                <option value={method.code} key={method.code}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>

          <div className="invoice-toolbar__actions">
            <Button variant="secondary" onClick={resetFilters}>
              Xóa lọc
            </Button>
            <Button
              variant="secondary"
              aria-label="Tải lại danh sách hóa đơn"
              onClick={() => void invoiceQuery.refetch()}
              disabled={invoiceQuery.isFetching}
            >
              <RefreshCw className={invoiceQuery.isFetching ? 'invoice-spin' : ''} />
              Tải lại
            </Button>
          </div>
        </section>

        <SummaryStrip
          count={summary.invoice_count}
          revenue={summary.total_revenue_vnd}
          discount={summary.total_discount_vnd}
          average={summary.average_invoice_vnd}
          loading={invoiceQuery.isFetching}
        />

        <section
          className="invoice-ledger"
          aria-labelledby="invoice-ledger-title"
          aria-busy={invoiceQuery.isFetching}
        >
          <div className="invoice-ledger__heading">
            <div>
              <h2 id="invoice-ledger-title">Sổ hóa đơn</h2>
              <p>
                {pagination
                  ? `${pagination.total_items.toLocaleString('vi-VN')} kết quả`
                  : 'Đang tổng hợp dữ liệu'}
              </p>
            </div>
            <CalendarDays aria-hidden="true" />
          </div>

          {invoiceQuery.isLoading ? (
            <div className="invoice-ledger__loading" aria-label="Đang tải hóa đơn">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-16 w-full" key={index} />
              ))}
            </div>
          ) : invoiceQuery.isError ? (
            <div className="invoice-state" role="alert">
              <CircleAlert aria-hidden="true" />
              <strong>Không tải được sổ hóa đơn</strong>
              <p>{errorMessage(invoiceQuery.error, 'Vui lòng kiểm tra kết nối và thử lại.')}</p>
              <Button variant="secondary" onClick={() => void invoiceQuery.refetch()}>
                <RefreshCw />
                Thử lại
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="invoice-state">
              <FileSearch aria-hidden="true" />
              <strong>Không có hóa đơn phù hợp</strong>
              <p>Thử đổi khoảng ngày, phương thức hoặc từ khóa tìm kiếm.</p>
              <Button variant="secondary" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            </div>
          ) : (
            <>
              <div className="invoice-desktop-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hóa đơn</TableHead>
                      <TableHead>Bàn / phiên</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Phương thức</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">Thanh toán lúc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <button
                            className="invoice-number"
                            onClick={() => setSelectedInvoiceID(invoice.id)}
                          >
                            <ReceiptText aria-hidden="true" />
                            <span>
                              <strong>{invoice.invoice_number}</strong>
                              <small>{invoice.item_count} món</small>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <strong>{invoice.table_label || 'Không xác định'}</strong>
                          <small className="invoice-cell-note invoice-mono">
                            {invoice.session_reference || '—'}
                          </small>
                        </TableCell>
                        <TableCell>{invoice.customer_name || 'Khách lẻ'}</TableCell>
                        <TableCell>{methodLabel(invoice)}</TableCell>
                        <TableCell className="invoice-amount">
                          {money(invoice.total_amount_vnd)}
                        </TableCell>
                        <TableCell className="invoice-time">{dateTime(invoice.paid_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="invoice-mobile-list">
                {items.map((invoice) => (
                  <button
                    className="invoice-mobile-card"
                    onClick={() => setSelectedInvoiceID(invoice.id)}
                    key={invoice.id}
                  >
                    <span className="invoice-mobile-card__top">
                      <span>
                        <strong className="invoice-mono">{invoice.invoice_number}</strong>
                        <small>{dateTime(invoice.paid_at)}</small>
                      </span>
                      <strong>{money(invoice.total_amount_vnd)}</strong>
                    </span>
                    <span className="invoice-mobile-card__meta">
                      <span>{invoice.table_label || 'Không xác định'}</span>
                      <span>{invoice.item_count} món</span>
                      <span>{methodLabel(invoice)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {pagination && pagination.total_pages > 1 && (
            <nav className="invoice-pagination" aria-label="Phân trang hóa đơn">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Trang trước"
                disabled={page <= 1 || invoiceQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft />
              </Button>
              <span>
                Trang <strong>{pagination.page}</strong> / {pagination.total_pages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Trang sau"
                disabled={page >= pagination.total_pages || invoiceQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight />
              </Button>
            </nav>
          )}
        </section>
      </main>

      <Sheet
        open={Boolean(selectedInvoiceID)}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceID(null)
        }}
      >
        <SheetContent side="right" className="invoice-detail-sheet">
          <SheetHeader className="invoice-detail-sheet__header">
            <WalletCards aria-hidden="true" />
            <div>
              <SheetTitle>Chi tiết thanh toán</SheetTitle>
              <SheetDescription>Số liệu được lưu tại thời điểm phát hành hóa đơn.</SheetDescription>
            </div>
          </SheetHeader>
          <InvoiceDetailContent
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            error={detailQuery.error}
            onRetry={() => void detailQuery.refetch()}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
