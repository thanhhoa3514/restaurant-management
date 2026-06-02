# Kiến trúc Backend — Hệ thống quản lý nhà hàng gọi món qua QR

> Phạm vi tài liệu: **chỉ định nghĩa kiến trúc & cấu trúc dự án (DDD)**. Code nghiệp vụ viết sau.
> Stack: Go (Gin) · PostgreSQL 15+ · Goose · gorilla/websocket · Outbox + LISTEN/NOTIFY · OpenAPI 3.0.

## 1. Lựa chọn kiến trúc

**Modular monolith theo Hexagonal / Clean Architecture + DDD.**

Một service Go duy nhất, chia theo **bounded context** thành các module độc lập. Mỗi module có 4 tầng, **Domain ở lõi và không phụ thuộc ra ngoài**; Application điều phối; Infrastructure và Interfaces là adapter ở rìa.

Lý do chọn (không dùng microservices): quy mô vừa & nhỏ, một nhóm phát triển, cần realtime nội bộ đơn giản (outbox + WebSocket trong cùng tiến trình), dễ triển khai/bảo vệ, vẫn tách module rõ để sau này có thể tách service nếu cần.

Quy tắc phụ thuộc (dependency rule): `interfaces → application → domain ← infrastructure`. Domain thuần Go, không import Gin/pgx/websocket.

## 2. Cấu trúc thư mục

```
restaurant-backend/
├── cmd/
│   └── api/
│       └── main.go                  # entrypoint: đọc config, mở DB, wiring (DI), start HTTP + WS + outbox dispatcher
├── internal/
│   ├── platform/                    # hạ tầng dùng chung (cross-cutting), không chứa nghiệp vụ
│   │   ├── config/                  # đọc env/flags
│   │   ├── postgres/                # pgx pool, Tx manager (Unit of Work)
│   │   ├── outbox/                  # dispatcher: SELECT ... FOR UPDATE SKIP LOCKED, retry, dead-letter; LISTEN/NOTIFY
│   │   ├── realtime/                # WebSocket hub (gorilla): đăng ký theo restaurant/role/table, broadcast
│   │   ├── httpx/                   # envelope response, error mapping, middleware (request id, recover, CORS)
│   │   ├── auth/                    # JWT cho nhân viên; session token (QR) cho khách; RBAC middleware
│   │   ├── tenant/                  # trích & truyền restaurant_id qua context
│   │   └── logger/                  # slog/zap
│   ├── modules/                     # các bounded context
│   │   ├── identity/                # tài khoản nhân viên, vai trò, đăng nhập
│   │   ├── catalog/                 # danh mục, món, tùy chọn, trạng thái còn/hết
│   │   ├── dining/                  # khu vực, bàn, mã QR, phiên (DiningSession) + vòng đời phiên
│   │   ├── ordering/                # đơn, món gọi, vòng đời trạng thái món, yêu cầu hủy, (giao diện bếp)
│   │   └── billing/                 # hóa đơn (snapshot), điều chỉnh/giảm giá, thanh toán (2 pha)
│   └── shared/                      # shared kernel: kiểu dùng chung
│       ├── money/                   # VND (int64), định dạng
│       ├── id/                      # UUID helpers
│       └── apperr/                  # lỗi domain có mã, map sang HTTP
├── migrations/                      # *.sql goose
├── api/
│   └── openapi.yaml                 # OpenAPI 3.0
├── deployments/
│   ├── Dockerfile
│   └── docker-compose.yml           # app + postgres
├── go.mod
└── Makefile                         # build, run, migrate, lint, test, swagger
```

### Cấu trúc bên trong MỖI module (ví dụ `ordering/`)

```
modules/ordering/
├── domain/                          # KHÔNG phụ thuộc framework
│   ├── order.go                     # Order (aggregate root) chứa OrderItem (entity)
│   ├── order_item.go                # OrderItem + snapshot tên/giá + version (optimistic lock)
│   ├── status.go                    # OrderItemStatus enum + bảng chuyển trạng thái hợp lệ
│   ├── cancel_request.go            # CancelRequest
│   ├── events.go                    # OrderPlaced, OrderItemStatusChanged, ItemCancelRequested...
│   └── repository.go                # interface (port): OrderRepository, OutboxWriter
├── application/                     # use case / app service (điều phối, mở transaction)
│   ├── place_order.go               # UC-03 / UC-04
│   ├── cancel_or_edit_item.go       # UC-05
│   ├── update_item_status.go        # UC-17
│   ├── review_cancel_request.go     # UC-18
│   └── dto.go                       # input/output DTO của tầng application
├── infrastructure/                  # adapter hiện thực port
│   └── postgres/
│       └── order_repository.go      # hiện thực OrderRepository bằng pgx + Tx manager
└── interfaces/
    └── http/
        ├── order_handler.go         # handler Gin (khách)
        └── kitchen_handler.go       # handler Gin (bếp) — đọc hàng đợi, cập nhật trạng thái
```

> `kitchen` không tách thành bounded context riêng: vòng đời trạng thái món thuộc **ordering**; phần "bếp" chỉ là *interface adapter* (handler + read model hàng đợi) trong module ordering.

## 3. Bounded context & aggregate

| Module | Aggregate root | Entity / VO chính | Trạng thái / quy tắc đặc trưng |
|---|---|---|---|
| identity | User | Role | RBAC theo vai trò |
| catalog | MenuItem | MenuCategory, ItemOption | còn/hết (availability) đẩy realtime |
| dining | DiningSession, Table | Area, QRCode | phiên: `ACTIVE → AWAITING_PAYMENT → CLOSED`; 1 phiên active/bàn |
| ordering | Order | OrderItem, CancelRequest, StatusHistory | món: `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED`; snapshot tên/giá; optimistic lock |
| billing | Invoice | InvoiceItem, Discount, Payment | invoice_items snapshot; thanh toán tiền mặt/thẻ/ví (ví = 2 pha, webhook idempotent) |

Tham chiếu giữa context dùng **ID** (UUID), không nhúng struct của context khác. Ví dụ `OrderItem` giữ `menu_item_id` + snapshot, không giữ con trỏ tới `MenuItem`.

## 4. Vai trò từng tầng

- **domain**: thực thể, aggregate, value object, *domain event*, và **port** (interface repository). Chứa bất biến nghiệp vụ (vd: chỉ hủy trực tiếp khi món `PENDING`; chuyển trạng thái phải đúng thứ tự). Không I/O, không SQL.
- **application**: mỗi use case là một *app service*; mở **transaction** qua Tx manager, gọi domain, ghi **outbox** trong cùng transaction, trả DTO. Không chứa luật nghiệp vụ lõi.
- **infrastructure**: hiện thực port bằng Postgres (pgx), publisher outbox, client cổng thanh toán.
- **interfaces**: handler Gin map request → DTO → app service; format envelope; nâng cấp WebSocket.

## 5. Cross-cutting (platform)

### 5.1 Transactional outbox + realtime
Trong **một** DB transaction: ghi thay đổi domain **và** chèn một dòng `outbox` (sự kiện). Dispatcher chạy nền: `SELECT ... FOR UPDATE SKIP LOCKED` để lấy sự kiện chưa xử lý, handler **idempotent**, **retry** có giới hạn, hết hạn đẩy **dead-letter**. Dùng `LISTEN/NOTIFY` để dispatcher phản ứng tức thì thay vì chỉ polling. Handler đẩy sự kiện sang **WebSocket hub** → push tới bếp/phục vụ/khách.

### 5.2 WebSocket hub
Quản lý kết nối theo `restaurant_id` + vai trò + bàn. Nhận sự kiện từ dispatcher và broadcast tới đúng nhóm subscriber. Không chứa nghiệp vụ.

### 5.3 Multi-tenant
`restaurant_id` trích từ JWT (nhân viên) hoặc QR session token (khách), truyền qua `context.Context`. **Mọi truy vấn ở repository đều scope theo `restaurant_id`** (bắt buộc, tránh rò dữ liệu giữa nhà hàng).

### 5.4 Auth/RBAC
Nhân viên: JWT (Phục vụ/Bếp/Thu ngân/Quản lý). Khách: **không đăng nhập** — quét QR cấp session token ngắn hạn gắn với phiên/bàn. Middleware RBAC chặn theo vai trò.

### 5.5 Quy ước API (envelope)
- Response bọc envelope: `{ "data": ..., "meta": ..., "error": null }`; lỗi: `{ "data": null, "error": { "code", "message" } }`.
- JSON **snake_case**; tiền **VND là số nguyên** (int64, không thập phân); thời gian **ISO 8601 / TIMESTAMPTZ**.
- UUID làm PK; **soft delete** (`deleted_at`); **optimistic locking** qua cột `version`.

## 6. Vài snippet minh họa (tham khảo, không phải code đầy đủ)

Value object tiền VND:
```go
package money

type VND int64 // luôn là số nguyên đồng

func (v VND) String() string { /* "85.000đ" */ }
```

Chuyển trạng thái món (bất biến trong domain):
```go
package domain

type OrderItemStatus string

const (
    StatusPending      OrderItemStatus = "PENDING"
    StatusAcknowledged OrderItemStatus = "ACKNOWLEDGED"
    StatusPreparing    OrderItemStatus = "PREPARING"
    StatusReady        OrderItemStatus = "READY"
    StatusServed       OrderItemStatus = "SERVED"
)

var allowed = map[OrderItemStatus][]OrderItemStatus{
    StatusPending:      {StatusAcknowledged},
    StatusAcknowledged: {StatusPreparing},
    StatusPreparing:    {StatusReady},
    StatusReady:        {StatusServed},
}

func (s OrderItemStatus) CanMoveTo(next OrderItemStatus) bool { /* tra bảng allowed */ }
```

Port (interface) ở domain — infrastructure hiện thực:
```go
package domain

type OrderRepository interface {
    Create(ctx context.Context, o *Order) error
    GetItem(ctx context.Context, id ID) (*OrderItem, error)
    UpdateItem(ctx context.Context, item *OrderItem) error // kiểm version
}

type OutboxWriter interface {
    Write(ctx context.Context, event Event) error // ghi trong cùng tx
}
```

App service (điều phối, mở transaction + ghi outbox):
```go
package application

func (s *PlaceOrder) Handle(ctx context.Context, in PlaceOrderInput) (PlaceOrderOutput, error) {
    return s.tx.Run(ctx, func(ctx context.Context) (PlaceOrderOutput, error) {
        // 1. kiểm phiên active & món còn hàng
        // 2. tạo Order + OrderItem (snapshot tên/giá, status PENDING)
        // 3. repo.Create(...)
        // 4. outbox.Write(OrderPlaced{...})  // cùng transaction
        // 5. trả DTO
    })
}
```

## 7. Map use case → module / app service (rút gọn)

- UC-01 quét QR → `dining.JoinSession`
- UC-03/UC-04 đặt/gọi thêm → `ordering.PlaceOrder`
- UC-05 hủy/sửa món → `ordering.CancelOrEditItem`
- UC-17 cập nhật trạng thái → `ordering.UpdateItemStatus`
- UC-18 duyệt hủy → `ordering.ReviewCancelRequest`
- UC-21/22 hóa đơn → `billing.BuildInvoice`, `billing.AdjustInvoice`
- UC-23 thanh toán → `billing.ProcessPayment` (+ webhook handler)
- UC-25 đóng phiên → `dining.CloseSession`
- UC-26/27 thực đơn & còn/hết → `catalog.*`
- UC-28 mã QR → `dining.ManageTableQR`

## 8. Thư viện đề xuất

`gin-gonic/gin` · `jackc/pgx/v5` · `pressly/goose/v3` · `gorilla/websocket` · `google/uuid` · `golang-jwt/jwt/v5` · `go-playground/validator/v10` · `log/slog` (chuẩn) · `swaggo/swag` (sinh OpenAPI từ annotation) · `stretchr/testify` (test).

## 9. Nguyên tắc bất biến cần giữ khi code

1. Domain không import framework/SQL/websocket.
2. Mọi ghi domain + sự kiện outbox nằm trong cùng một transaction.
3. Mọi truy vấn scope theo `restaurant_id`.
4. Cập nhật có version → kiểm tra optimistic lock.
5. Xóa = soft delete; dữ liệu snapshot không đổi khi nguồn thay đổi.
