# Split Bill (business-gaps P1 #1)

Cashier tách 1 hóa đơn session thành N hóa đơn con, mỗi con thanh toán riêng.

## Ràng buộc hiện có (đọc trước khi code)

- `invoices` đã có `dining_session_id`, `invoice_type`, `service_charge_*`, `vat_*`; `invoice_items.order_item_id` trỏ về `order_items`.
- `Repository.BuildInvoice` (billing_repository.go:31) trả invoice non-VOID **đầu tiên** của session nếu đã tồn tại → giả định 1 invoice/session.
- `Repository.ProcessPayment` (:288) và `CompleteWebhookPayment` (:416) gọi `closeSessionAndFreeTable` **vô điều kiện** → invoice con đầu tiên trả tiền sẽ đóng session, chặn các con còn lại.
- Money = VND int64. Envelope `{data,meta,error}`. Snapshot name/price bất biến.

## Backend

### 1. Sửa `closeSessionAndFreeTable` (root cause, dùng chung 2 caller)

Chỉ đóng session + free table khi **không còn** invoice nào của session ở trạng thái khác `PAID`/`VOID`:

```sql
SELECT COUNT(*) FROM invoices
WHERE restaurant_id=$1 AND dining_session_id=$2
  AND status NOT IN ('PAID','VOID') AND deleted_at IS NULL
```
count > 0 → return nil (không đóng). Session giữ `AWAITING_PAYMENT`.

### 2. Use-case mới `SplitInvoice` (application/split_invoice.go)

`POST /api/v1/restaurant/invoices/split` (cùng permission group `billing.process`)

```json
{ "dining_session_id": "uuid",
  "groups": [ { "label": "Người 1", "order_item_ids": ["uuid", ...] }, ... ] }
```

Repo `SplitInvoice(ctx, restaurantID, input)` trong 1 tx:
1. Lock session (`FOR UPDATE`), phải `ACTIVE` | `AWAITING_PAYMENT`.
2. Lấy billable items (dùng lại `billableItems`). Validate groups **partition đúng**: mọi order_item_id billable xuất hiện **đúng 1 lần**, không id lạ, group không rỗng, ≥2 group → sai thì `apperr.CodeInvalid` với message cụ thể.
3. Mọi invoice non-VOID hiện có của session phải `PENDING`/`DRAFT` (chưa PAID, không có payment PROCESSING) → nếu có PAID/PROCESSING trả `CodeConflict` "cannot split a session with paid invoices". Ngược lại VOID hết chúng (`voided_reason='SPLIT'`).
4. Với mỗi group: tính subtotal từ items của group, `service = roundBPS(subtotal, serviceBPS)`, `vat = roundBPS(subtotal+service, vatBPS)`, total = tổng. Insert invoice (`invoice_type='STANDARD'`, `status='PENDING'`) + invoice_items của group. Số dư làm tròn: chấp nhận tổng N invoice có thể lệch vài đồng so với invoice gộp — không cần bù.
5. Set session `AWAITING_PAYMENT`.
6. Trả `[]*domain.Invoice`.

Outbox: 1 event `billing.invoice_split` (aggregate = dining_session) payload `{dining_session_id, invoice_ids, count}`.

### 3. Liệt kê invoice của session

`GET /api/v1/restaurant/invoices?dining_session_id=uuid` → `{ "invoices": [...] }` (tất cả non-VOID, sort created_at). Cashier cần để render N hóa đơn con.

`BuildInvoice`: nếu session có >1 invoice non-VOID → `CodeConflict` "session has split invoices" (đừng trả bừa 1 cái).

### 4. Test

`billing/application` hoặc repo test: split 4 item thành 2 group → 2 invoice, tổng subtotal = subtotal cũ; trả tiền invoice 1 → session VẪN `AWAITING_PAYMENT`; trả invoice 2 → session `CLOSED`, table free. Đây là check bắt buộc.

## Frontend (cashier)

- `features/billing/api.ts`: thêm `splitInvoice(diningSessionId, groups)`, `listSessionInvoices(diningSessionId)`.
- `use-cashier.tsx`: state hiện tại `session.invoice` (1 invoice) → đổi thành `session.invoices: Invoice[]` + `activeInvoiceId`. Giữ nguyên mọi flow cũ khi mảng có 1 phần tử.
- Dialog "Chia hóa đơn": list item của session, mỗi item gán vào tab Người 1..N (thêm/bớt người), disable nút Xác nhận khi còn item chưa gán. Gọi split → nhận N invoice.
- `invoice-panel` / `payment-panel`: tab/segmented chọn invoice con, badge PAID, tổng "đã trả X/N".
- Copy Việt hoá trong `cashier/data/i18n.ts`.

## Ngoài scope

Partial payment (gap #2) và merge/split table (gap #3) làm sau — split bill không được đụng vào `ProcessPayment` semantics (vẫn trả đủ 1 invoice 1 lần).
