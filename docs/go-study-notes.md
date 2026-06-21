# Go study notes — pointers, context, TxRunner, receivers

> Ôn cho buổi kiểm tra. Ví dụ lấy từ `backend/internal/modules/catalog/application/create_menu_item.go`.

---

## 1. `*` = pointer. Khi nào dùng?

`*T` = "pointer tới T" = giữ **địa chỉ bộ nhớ** của một T, không phải bản sao giá trị.

Ba toán tử:
- `*` trong **kiểu** (`var p *PaymentDTO`) = "p là pointer tới PaymentDTO".
- `&` = "lấy địa chỉ của" (`&in` → pointer tới `in`).
- `*` trước **giá trị** (`*p`) = "dereference" = đọc thứ tại địa chỉ đó.

### `var payment *PaymentDTO` — sao là pointer, không phải `var payment PaymentDTO`?

**Lý do 1 — nil = "chưa có giá trị".** Struct value không thể rỗng; pointer thì `nil` được. Mẫu: "có thể có payment, có thể không."
```go
var payment *PaymentDTO   // nil = không tìm thấy payment
if found { payment = &PaymentDTO{...} }
if payment == nil { /* không có */ }
```
`JoinSession` dùng mẫu này: `SessionID *uuid.UUID` — pointer nên có thể **vắng mặt** (JSON bỏ field khi nil). uuid không-pointer luôn serialize thành toàn số 0.

**Lý do 2 — tránh copy / cho phép sửa.** Truyền pointer → hàm sửa được bản gốc, không tạo copy.
```go
normalizeCreate(&in)   // dòng 24 — truyền ĐỊA CHỈ để hàm sửa `in` thật
```
Nếu truyền `in` (không `&`), hàm sửa bản sao, `in` gốc không đổi.

### Quy tắc nhanh
| Muốn | Dùng |
|---|---|
| "có thể vắng" (nullable) | pointer `*T` |
| hàm phải sửa giá trị của caller | pointer `*T` |
| struct lớn, tránh chi phí copy | pointer `*T` |
| method đổi state của receiver | pointer receiver `*T` |
| giá trị nhỏ, bất biến, luôn có | value `T` |

---

## 2. `context` và `TxRunner`

### `context.Context` (param `ctx`)
Object "phạm vi request" chuẩn của Go. Đi xuyên mọi lời gọi. Mang:
- **cancellation / deadline** — request bị hủy → `ctx` báo hiệu, dừng việc.
- **request-scoped values** — `tenant.MustRestaurantID(ctx)` (dòng 31) rút `restaurant_id` ra khỏi ctx.
  Auth middleware đặt vào trước đó. Nhờ vậy scope multi-tenant đi xuyên hệ thống mà không phải truyền tay
  ở mọi hàm.

Quy ước: luôn là param **đầu tiên**, luôn tên `ctx`.

### `TxRunner` — interface tự định nghĩa (`tx.go`)
```go
type TxRunner interface {
    Run(context.Context, func(context.Context) error) error
}
```
= "đưa tao một hàm, tao chạy nó trong **một** DB transaction."

Dòng 35–56:
```go
err = s.tx.Run(ctx, func(ctx context.Context) error {
    // mọi thứ ở đây = MỘT transaction
    // CategoryExists, CreateItem, writeAudit, writeItemEvent
    return nil   // nil → COMMIT;  return err → ROLLBACK
})
```
Closure chạy; trả `nil` → commit. Bất kỳ error khác nil → rollback **tất cả** (tạo item + audit + outbox
event undo cùng nhau). Đây là lý do "ghi domain + outbox event cùng transaction" được đảm bảo — chúng nằm
trong một `Run`.

`tx` là field **interface**, không phải Postgres cụ thể. Implementation pgx thật được inject ở `main.go`.
Nhờ vậy swap/mock được khi test.

---

## 3. `func (s *CreateMenuItem) Handle(...)` — phần `(s *CreateMenuItem)`

Đây là **method có receiver**.

```go
func (s *CreateMenuItem) Handle(ctx context.Context, in CreateMenuItemRequest) (MenuItemCommandResponse, error)
//   └─── receiver ───┘ └name┘ └────────── params ──────────────────┘ └──── returns ────┘
```

- `(s *CreateMenuItem)` = **receiver**. Gắn `Handle` vào struct `CreateMenuItem` (định nghĩa dòng 13).
  `s` ≈ `this`/`self` ở ngôn ngữ khác. Pointer receiver `*CreateMenuItem` để method đọc được field
  `s.tx`, `s.repo`, `s.outbox`.
- "Handle ở đâu?" — **định nghĩa ngay đây**, dòng 22. Không import. Là method *trên* `CreateMenuItem`.
  Gọi: `svc.Handle(ctx, req)`.
- Vì sao `s` truy cập được `tx/repo/outbox` — đó là field của struct, set bởi `NewCreateMenuItem` (dòng 19,
  constructor). Dependency injection: dựng struct một lần kèm deps, gọi `Handle` nhiều lần.

Luồng:
```
NewCreateMenuItem(tx, repo, outbox)  →  &CreateMenuItem{...}   // wire deps một lần (main.go)
svc.Handle(ctx, req)                 →  dùng s.tx, s.repo, s.outbox  // mỗi request
```

`Handle` chỉ là **quy ước đặt tên** của nhóm cho "method chạy use case." Mỗi struct use-case
(`CreateMenuItem`, `GuestPlaceOrder`, `JoinSession`…) có đúng một `Handle`. Không phải keyword Go — quy ước.

---

## 4. Pointer receiver vs value receiver (dễ bị hỏi)

```go
func (s *CreateMenuItem) Handle(...)   // pointer receiver
func (s CreateMenuItem)  Handle(...)   // value receiver — nhận BẢN SAO
```
Dùng `*` receiver khi: method **sửa** struct, **hoặc** struct lớn, **hoặc** để nhất quán (codebase này luôn
dùng `*`). Trộn pointer + value receiver trên cùng type = thực hành xấu; chọn một.

---

## Tóm tắt một dòng
- `*T` = pointer (nullable / sửa được / tránh copy); `&x` = lấy địa chỉ; `*p` = đọc giá trị.
- `ctx` = phạm vi request: cancel + giá trị (vd `restaurant_id`), luôn param đầu.
- `TxRunner.Run` = chạy closure trong 1 transaction; `nil`→commit, `err`→rollback.
- `(s *T) Method()` = method gắn vào struct T; `s` = this; deps lấy từ field do constructor set.
</content>
