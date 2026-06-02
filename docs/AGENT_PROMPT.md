# Prompt cho coding agent — Scaffold backend Go (chỉ kiến trúc, chưa viết nghiệp vụ)

> Dán toàn bộ phần dưới cho coding agent (vd Claude Code). Nếu có file `ARCHITECTURE.md`, đính kèm cùng.

---

## Vai trò & mục tiêu

Bạn là kỹ sư Go senior. Hãy **dựng khung (scaffold) một backend Go theo Hexagonal/Clean Architecture + DDD** cho hệ thống quản lý nhà hàng gọi món qua QR (quán lẩu & nướng, mô hình à la carte).

**Phạm vi lần này: CHỈ tạo cấu trúc, interface và stub.** KHÔNG hiện thực nghiệp vụ đầy đủ. Toàn bộ code phải **biên dịch được** (`go build ./...` pass) với các hàm stub trả về `errors.New("not implemented")` hoặc giá trị zero kèm `// TODO`.

## Bối cảnh hệ thống

- 6 vai trò: Khách, Phục vụ, Bếp, Thu ngân, Quản lý, Cổng thanh toán.
- Bounded context: `identity` (tài khoản/vai trò), `catalog` (thực đơn, còn/hết), `dining` (khu vực/bàn/QR/phiên), `ordering` (đơn/món/trạng thái/hủy + giao diện bếp), `billing` (hóa đơn snapshot/giảm giá/thanh toán).
- Vòng đời trạng thái món: `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED` (lưu ở từng món, không ở đơn).
- Vòng đời phiên: `ACTIVE → AWAITING_PAYMENT → CLOSED`; ràng buộc 1 phiên active/bàn.
- Realtime bằng transactional outbox + LISTEN/NOTIFY → WebSocket hub.
- Thanh toán ví điện tử 2 pha (khởi tạo → webhook callback idempotent).

## Stack & thư viện bắt buộc

Go 1.22+ · `gin-gonic/gin` · `jackc/pgx/v5` (+ pgxpool) · `pressly/goose/v3` · `gorilla/websocket` · `google/uuid` · `golang-jwt/jwt/v5` · `go-playground/validator/v10` · `log/slog` · `stretchr/testify`. PostgreSQL 15+.

## Quy ước (PHẢI tuân thủ)

- **Dependency rule**: `interfaces → application → domain ← infrastructure`. Package `domain` KHÔNG được import gin/pgx/websocket/jwt — chỉ thư viện chuẩn + `google/uuid`.
- Domain định nghĩa **port** (interface repository); infrastructure hiện thực.
- Application mở **transaction** và ghi **outbox trong cùng transaction**.
- Mọi truy vấn scope theo `restaurant_id` (multi-tenant), lấy từ `context.Context`.
- API: envelope `{ "data", "meta", "error" }`; JSON **snake_case**; tiền **VND int64**; thời gian **ISO 8601 / TIMESTAMPTZ**; PK **UUID**; **soft delete** (`deleted_at`); **optimistic lock** (`version`).
- Đặt tên package ngắn, không stutter (vd `ordering.PlaceOrder`, không `ordering.OrderingPlaceOrder`).

## Cấu trúc thư mục mục tiêu

(Tạo đúng cây này; nếu thiếu chi tiết thì theo `ARCHITECTURE.md`.)

```
cmd/api/main.go
internal/platform/{config,postgres,outbox,realtime,httpx,auth,tenant,logger}/
internal/modules/{identity,catalog,dining,ordering,billing}/{domain,application,infrastructure,interfaces}/
internal/shared/{money,id,apperr}/
migrations/
api/openapi.yaml
deployments/{Dockerfile,docker-compose.yml}
go.mod  Makefile
```

Mỗi module có đủ 4 thư mục `domain / application / infrastructure / interfaces`. `ordering/interfaces/http` có cả `order_handler.go` và `kitchen_handler.go`.

## Các pha thực hiện (làm tuần tự, commit sau mỗi pha)

1. **Init**: `go mod init`, thêm thư viện, tạo `Makefile` (build/run/migrate/lint/test), `.gitignore`, `README` ngắn.
2. **shared kernel**: `money.VND` (int64 + format "85.000đ"), `id` helpers (UUID), `apperr` (lỗi có `Code` + map sang HTTP status).
3. **platform**: `config` (đọc env), `postgres` (pgxpool + Tx manager kiểu Unit of Work), `httpx` (envelope encoder, error mapper, middleware: request id/recover/CORS), `auth` (JWT verify + RBAC middleware + QR session token — stub), `tenant` (lấy/đặt `restaurant_id` trong context), `realtime` (WebSocket hub: register/unregister/broadcast theo restaurant·role·table — khung chạy được), `outbox` (dispatcher khung: vòng lặp `FOR UPDATE SKIP LOCKED`, retry, dead-letter, LISTEN/NOTIFY — stub xử lý), `logger` (slog).
4. **modules** (lặp cho cả 5): trong `domain` khai báo aggregate/entity/VO + enum trạng thái + domain events + **interface** repository/port; `application` tạo các app service theo map use case (struct + hàm `Handle` stub mở tx, gọi port, ghi outbox); `infrastructure/postgres` tạo struct hiện thực port (method stub trả `not implemented`); `interfaces/http` tạo handler Gin (đăng ký route, parse request, gọi app service, trả envelope — body stub).
   - Use case tối thiểu cần có struct/skeleton: dining.JoinSession, dining.CloseSession, dining.ManageTableQR; catalog CRUD + toggle availability; ordering.PlaceOrder, CancelOrEditItem, UpdateItemStatus, ReviewCancelRequest; billing.BuildInvoice, AdjustInvoice, ProcessPayment (+ webhook handler), identity auth/users.
5. **wiring**: `cmd/api/main.go` đọc config → mở pgxpool → khởi tạo Tx manager, outbox dispatcher, WS hub → khởi tạo repo → app service → handler → đăng ký router Gin → chạy HTTP server + dispatcher (goroutine). Có graceful shutdown.
6. **migrations + api + deploy**: tạo 1-2 file goose migration khung (bảng `outbox`, và ví dụ `restaurants`, `tables`, `dining_sessions` với UUID/version/deleted_at/restaurant_id) — đủ để minh họa quy ước, không cần đủ 38 bảng. Tạo `api/openapi.yaml` skeleton (info + vài path mẫu envelope). Tạo `Dockerfile` (multi-stage) + `docker-compose.yml` (app + postgres).

## Definition of Done (kiểm trước khi báo xong)

- [ ] `go build ./...` và `go vet ./...` pass; `gofmt` sạch.
- [ ] Cây thư mục đúng như trên; mỗi module đủ 4 tầng.
- [ ] `domain` không import gin/pgx/websocket/jwt (kiểm bằng `go list -deps` hoặc grep import).
- [ ] `main.go` wiring đầy đủ; server start được (kể cả khi handler còn stub).
- [ ] `docker-compose up` dựng được app + postgres; `make migrate` chạy migration khung.
- [ ] Mỗi app service & method repository là stub có `// TODO` rõ ràng, KHÔNG bịa logic nghiệp vụ.

## Ràng buộc & cách làm việc

- KHÔNG hiện thực nghiệp vụ ngoài stub ở pha này; nếu một chi tiết không chắc, để `// TODO` và **liệt kê câu hỏi ở cuối**, đừng tự bịa.
- Ưu tiên ít dependency; đúng các thư viện đã nêu.
- Sau mỗi pha, in cây thư mục đã tạo và kết quả `go build ./...`.
- Kết thúc: tóm tắt cấu trúc, các điểm `// TODO` chính, và danh sách câu hỏi cần chủ dự án quyết.
