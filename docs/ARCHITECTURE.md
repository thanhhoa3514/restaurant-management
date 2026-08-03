# Kiến trúc Backend — Hệ thống quản lý nhà hàng gọi món qua QR

> Phạm vi tài liệu: **chỉ định nghĩa kiến trúc & cấu trúc dự án (DDD)**. Code nghiệp vụ viết sau.
> Stack: Go (Gin) · PostgreSQL 15+ · MinIO/R2 (S3-compatible storage) · Goose · gorilla/websocket · Outbox + LISTEN/NOTIFY · OpenAPI 3.0.

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
│   │   ├── auth/                    # JWT cho nhân viên; device access token cho khách; RBAC middleware
│   │   ├── tenant/                  # trích & truyền restaurant_id qua context
│   │   ├── storage/                 # S3-compatible: presigned URL, delete object
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
├── Dockerfile                       # multi-stage Go build
├── docker-compose.yml               # postgres + minio + migrate + app
├── go.mod
├── Makefile                         # build, run, migrate, lint, test, swagger
└── .env.example                     # biến môi trường (copy → .env)
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
`restaurant_id` trích từ JWT (nhân viên) hoặc device access token đã duyệt (khách), truyền qua `context.Context`. **Mọi truy vấn ở repository đều scope theo `restaurant_id`** (bắt buộc, tránh rò dữ liệu giữa nhà hàng).

### 5.4 Auth/RBAC
Nhân viên: JWT (Phục vụ/Bếp/Thu ngân/Quản lý). Khách: quét QR, nhận access token riêng cho device và chờ nhân viên duyệt. Middleware RBAC chặn theo vai trò; `DeviceAccessToken` bảo vệ API khách.

### 5.5 Quy ước API (envelope)
- Response bọc envelope: `{ "data": ..., "meta": ..., "error": null }`; lỗi: `{ "data": null, "error": { "code", "message" } }`.
- JSON **snake_case**; tiền **VND là số nguyên** (int64, không thập phân); thời gian **ISO 8601 / TIMESTAMPTZ**.
- UUID làm PK; **soft delete** (`deleted_at`); **optimistic locking** qua cột `version`.

### 5.6 Hành động ảnh hưởng hệ thống (high-impact)
Một số hành động có thể ảnh hưởng toàn hệ thống — ví dụ: `catalog.ToggleAvailability` (ẩn/hiện món trên toàn bộ thực đơn), `billing` void/điều chỉnh hóa đơn, `dining.CloseSession`, `identity` quản lý người dùng. Với các hành động này:

1. **Truyền trạng thái đích tường minh, không "blind toggle".** Client gửi giá trị muốn đặt (vd `{ "item_id", "available": false }`), không gửi lệnh "đảo trạng thái". Tránh hai người sửa đồng thời triệt tiêu lẫn nhau và giúp truy vết.
2. **Bắt buộc ghi audit log.** Trong cùng transaction với thay đổi domain, ghi một bản ghi audit/outbox: **ai · hành động gì · trên tài nguyên nào · khi nào · giá trị trước→sau**. Không cho hành động high-impact diễn ra "âm thầm".
3. **UI có bước xác nhận** (phía frontend): dialog confirm trước khi commit; hiển thị trạng thái thật từ server, không tự đảo lạc quan. Đây là yêu cầu của chủ dự án — coi mỗi bước high-impact như một mối đe dọa, ưu tiên khả năng đảo ngược + truy vết hơn là tiện lợi.

### 5.7 S3-compatible storage (image upload)

Dùng **MinIO** (local dev) hoặc **Cloudflare R2** (production) — cả 2 đều S3-compatible, cùng API.

**Cơ chế Presigned URL (không upload qua server):**

```
Client chọn ảnh
  → POST /api/catalog/upload/presign { extension, content_type }
    → server kiểm tra auth, gọi MinIO PresignedPutURL()
    → trả về { presigned_url, public_url }
  → Client PUT ảnh thẳng lên MinIO qua presigned_url
  → Lưu public_url vào form (MenuItem.ImageURL / SubImages)
```

- Server **không xử lý file binary** — không tốn RAM/CPU, không nghẽn.
- Presigned URL có **TTL 15 phút**, hết hạn tự động khoá.
- Bucket **public-read** để URL ảnh truy cập trực tiếp (không cần proxy qua server).

**File cấu hình:**
| Biến | Mặc định | Ghi chú |
|---|---|---|
| `S3_ENDPOINT` | `localhost:9000` | MinIO endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | match MINIO_ROOT_USER |
| `S3_SECRET_KEY` | `minio-secret` | match MINIO_ROOT_PASSWORD |
| `S3_BUCKET` | `restaurant-images` | bucket tự động tạo + set public-read policy |
| `S3_USE_SSL` | `false` | `true` cho R2 (production) |
| `S3_PUBLIC_URL` | `http://localhost:9000/restaurant-images` | URL prefix để client hiển thị ảnh |

**File liên quan:**
- `internal/platform/storage/s3.go` — MinIO wrapper, PresignedPutURL + DeleteObject
- `internal/modules/catalog/interfaces/http/handler.go` — endpoint `/upload/presign`
- `frontend/src/features/catalog/api.ts` — `presignUpload()` gọi server
- `frontend/src/features/catalog/components/image-uploader.tsx` — widget upload (file picker → presign → PUT → preview)

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

`gin-gonic/gin` · `jackc/pgx/v5` · `pressly/goose/v3` · `gorilla/websocket` · `google/uuid` · `golang-jwt/jwt/v5` · `go-playground/validator/v10` · `log/slog` (chuẩn) · `swaggo/swag` (sinh OpenAPI từ annotation) · `stretchr/testify` (test) · `minio/minio-go/v7` (S3 client).

## 9. Nguyên tắc bất biến cần giữ khi code

1. Domain không import framework/SQL/websocket.
2. Mọi ghi domain + sự kiện outbox nằm trong cùng một transaction.
3. Mọi truy vấn scope theo `restaurant_id`.
4. Cập nhật có version → kiểm tra optimistic lock.
5. Xóa = soft delete; dữ liệu snapshot không đổi khi nguồn thay đổi.
6. Hành động ảnh hưởng hệ thống (high-impact, xem §5.6) → nhận trạng thái đích tường minh **và** ghi audit log trong cùng transaction.
