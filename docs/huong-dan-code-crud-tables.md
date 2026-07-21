# Hướng dẫn: code CRUD bàn từ đầu tới cuối

Ghi lại **đúng trình tự** đã code tính năng thêm/sửa/xoá bàn (`tables`), để lần sau tự làm được một tính năng CRUD khác (món ăn, khu vực, nhân viên…) theo cùng một lối.

Nguyên tắc xuyên suốt: **đi từ trong ra ngoài**. Domain → Infrastructure → Application → Interfaces → DI → Frontend. Không bao giờ bắt đầu bằng UI.

Lý do: mỗi lớp chỉ phụ thuộc vào lớp bên trong nó. Code lớp trong trước thì lúc code lớp ngoài, thứ nó cần đã tồn tại và đã compile được. Bắt đầu từ UI thì phải "tưởng tượng" API chưa có, và thường tưởng tượng sai.

```
interfaces (Gin)  →  application (use-case)  →  domain (rule + interface)
                                                      ↑
                                      infrastructure (Postgres) implement
```

---

## Bước 0 — Đọc trước khi gõ

Trước khi viết dòng nào, trả lời 3 câu:

**a) Bảng DB đã có cột nào?**

```bash
rg -n "CREATE TABLE tables" -A 20 backend/migrations/00001_init_restaurant_schema.sql
```

Kết quả: `tables` đã có đủ `code, name, capacity, status, area_id, position_x, position_y, version, deleted_at`. **Không cần migration mới.** Đây là bước tiết kiệm thời gian nhất — rất nhiều tính năng tưởng phải đổi schema nhưng thực ra không.

**b) Đã có endpoint tương tự chưa?**

```bash
rg -n "POST|PATCH|DELETE" backend/internal/modules/dining/interfaces/http/handler.go
```

Chỉ có `POST /tables/qrs`. Chưa có CRUD bàn → đúng là phải làm.

**c) File nào đang làm việc gần giống nhất?**

`manage_table_qr.go` — cũng là use-case ghi dữ liệu trong module `dining`. Mở ra đọc để **bắt chước cấu trúc**, không sáng tạo kiểu mới. Code mới trông giống code cũ thì người sau đọc dễ hơn.

> Mẹo: 80% thời gian "code khó" thực ra là do chưa biết code cũ đã có sẵn gì. Bước 0 chữa đúng chỗ đó.

---

## Bước 1 — Domain: khai báo cái mình cần, chưa làm gì cả

File: `backend/internal/modules/dining/domain/model.go`

Domain là lớp trong cùng. Nó **chỉ mô tả**: dữ liệu trông như thế nào, và kho dữ liệu phải làm được những việc gì. Nó **không biết** Postgres hay Gin tồn tại.

Hai việc:

**1.1. Bổ sung field cho struct `Table`.** Struct cũ chỉ có `Code`, `Name` vì trước giờ chỉ cần đọc tên bàn. Giờ cần sửa số chỗ và trạng thái:

```go
type Table struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	AreaID       uuid.UUID
	Code         string
	Name         string
	Capacity     int    // ← thêm
	Status       string // ← thêm
	Version      int
	DeletedAt    *time.Time
}
```

**1.2. Thêm method vào interface `DiningRepository`:**

```go
type DiningRepository interface {
	// …các method cũ…
	ListAreas(ctx context.Context, restaurantID uuid.UUID) ([]Area, error)
	CreateTable(ctx context.Context, t *Table) error
	UpdateTable(ctx context.Context, t *Table) error
	SoftDeleteTable(ctx context.Context, restaurantID, tableID uuid.UUID) error
}
```

Đây là **hợp đồng**. Chưa có code chạy. Nhưng ngay khi lưu file, compiler báo đỏ khắp nơi:

```
*postgres.Repository does not implement domain.DiningRepository (missing method CreateTable)
```

**Lỗi này là cố ý và là chuyện tốt.** Compiler vừa biến thành cái danh sách việc cần làm: nó sẽ không cho build cho tới khi mọi thứ implement interface này được vá đủ. Không sợ quên.

---

## Bước 2 — Infrastructure: viết SQL thật

File: `backend/internal/modules/dining/infrastructure/postgres/dining_repository.go`

Giờ mới đụng tới Postgres. Mỗi method ở bước 1 = một hàm SQL.

**2.1. Sửa `FindTable` cho khớp struct mới** (đã thêm 2 field thì SELECT và Scan phải thêm 2 cột, đúng thứ tự):

```go
SELECT id, restaurant_id, COALESCE(area_id, '00000000-…'::uuid), code, name, capacity, status, version, deleted_at
FROM tables
WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
`, restaurantID, tableID).Scan(&t.ID, &t.RestaurantID, &t.AreaID, &t.Code, &t.Name, &t.Capacity, &t.Status, &t.Version, &t.DeletedAt)
```

> Lỗi hay gặp: thêm cột vào `SELECT` mà quên thêm biến vào `Scan`, hoặc sai thứ tự. pgx báo lỗi lúc **chạy**, không phải lúc compile. Luôn đối chiếu SELECT ↔ Scan từng cột một.

**2.2. `CreateTable` — dùng `RETURNING` để lấy id do DB sinh:**

```go
func (r *Repository) CreateTable(ctx context.Context, t *domain.Table) error {
	var areaID any
	if t.AreaID != uuid.Nil {
		areaID = t.AreaID   // nil interface → NULL, vì area_id cho phép NULL
	}
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO tables (restaurant_id, area_id, code, name, capacity, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, version
	`, t.RestaurantID, areaID, t.Code, t.Name, t.Capacity, t.Status).Scan(&t.ID, &t.Version)
	if err != nil {
		return duplicateTableCode(err)
	}
	return nil
}
```

Hai chỗ đáng chú ý:

- **`t.ID` được ghi ngược vào struct.** Hàm nhận `*domain.Table` (con trỏ) nên sau khi gọi, use-case đọc được id mới mà không cần query lại.
- **`areaID` khai kiểu `any`.** Nếu để `uuid.UUID` thì bàn không thuộc khu nào sẽ ghi vào DB `00000000-0000-…` — một UUID rác không tồn tại trong bảng `areas`. Để `any` và bỏ trống thì pgx gửi `NULL`, đúng ý nghĩa "chưa gán khu".

**2.3. `UpdateTable` — kiểm tra `RowsAffected`:**

```go
tag, err := r.q(ctx).Exec(ctx, `
	UPDATE tables
	SET area_id = $3, code = $4, name = $5, capacity = $6, status = $7,
	    version = version + 1, updated_at = NOW()
	WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
`, …)
if err != nil {
	return duplicateTableCode(err)
}
if tag.RowsAffected() == 0 {
	return apperr.New(apperr.CodeNotFound, "table not found")
}
```

`UPDATE` không khớp dòng nào **không phải lỗi SQL** — nó thành công với 0 dòng. Không check `RowsAffected` thì sửa một bàn không tồn tại vẫn trả về "OK", client tưởng đã lưu. Đây là bug âm thầm hay gặp nhất khi viết repo.

`version = version + 1` là quy ước optimistic locking của cả dự án, mọi bảng đều theo.

**2.4. `SoftDeleteTable` — xoá mềm, không `DELETE`:**

```go
UPDATE tables
SET deleted_at = NOW(), status = 'INACTIVE', version = version + 1, updated_at = NOW()
WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
```

`DELETE` thật sẽ làm gãy mọi `order`, `invoice` cũ đang trỏ tới bàn này. Toàn dự án dùng `deleted_at`, và mọi câu SELECT đều đã có `AND deleted_at IS NULL` nên bàn tự biến mất khỏi danh sách.

**2.5. Dịch lỗi DB sang lỗi nghiệp vụ:**

```go
func duplicateTableCode(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "tables_restaurant_code") {
		return apperr.New(apperr.CodeConflict, "table code already exists")
	}
	return err
}
```

Không có hàm này: nhập trùng mã bàn → **500 Internal Server Error**, người dùng không hiểu gì. Có rồi: **409 Conflict** + câu thông báo đọc được. `23505` là mã unique-violation của Postgres.

Nguyên tắc chung: **lỗi kỹ thuật của DB phải được dịch sang lỗi nghiệp vụ ngay tại repo**, đừng để rò lên trên.

Chạy thử:

```bash
cd backend && go build ./internal/modules/dining/...
```

---

## Bước 3 — Application: đặt luật nghiệp vụ

File mới: `backend/internal/modules/dining/application/manage_table.go`

Repo chỉ biết đọc/ghi. Use-case mới là nơi trả lời "được phép hay không, và theo thứ tự nào".

**3.1. Struct request/response + struct use-case.** Bắt chước y hệt `manage_table_qr.go`:

```go
type SaveTableRequest struct {
	TableID  *uuid.UUID `json:"-"`   // nil = tạo mới, có = sửa
	AreaID   *uuid.UUID `json:"area_id"`
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	Capacity int        `json:"capacity"`
	Status   string     `json:"status"`
}

type SaveTable struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewSaveTable(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *SaveTable {
	return &SaveTable{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}
```

Chú ý `TableID` gắn tag `json:"-"` — nó **không** đến từ body, mà từ URL (`PATCH /tables/:tableId`). Nếu để client gửi trong body thì có thể sửa nhầm bàn khác.

Dùng **một** use-case `SaveTable` cho cả tạo lẫn sửa vì hai luồng validate y hệt nhau, chỉ khác câu SQL cuối. Tách làm hai thì phải copy toàn bộ validate.

**3.2. Chuẩn hoá + validate trước, ghi sau:**

```go
code := strings.ToUpper(strings.TrimSpace(in.Code))
name := strings.TrimSpace(in.Name)
if code == "" {
	return out, apperr.New(apperr.CodeInvalid, "table code is required")
}
if name == "" {
	name = code        // để trống tên thì lấy mã làm tên
}
if in.Capacity <= 0 || in.Capacity > 50 {
	return out, apperr.New(apperr.CodeInvalid, "capacity must be between 1 and 50")
}
status := strings.ToUpper(strings.TrimSpace(in.Status))
if status == "" {
	status = "AVAILABLE"
}
if !validTableStatus[status] {
	return out, apperr.New(apperr.CodeInvalid, "invalid table status")
}
```

Ba ý:

- **Chuẩn hoá (`TrimSpace`, `ToUpper`) trước khi validate.** Người dùng gõ `" t11 "` phải thành `T11`, không thì DB có cả `T11` lẫn `t11` là hai bàn khác nhau.
- **Validate xong hết rồi mới mở transaction.** Không tốn kết nối DB cho request chắc chắn sai.
- **`validTableStatus` là bản sao của `chk_tables_status` trong schema.** Không có nó thì status sai bị CHECK constraint chặn → 500. Có nó → 400 kèm thông báo rõ.

**3.3. Bọc phần ghi trong transaction:**

```go
err := s.tx.Run(ctx, func(ctx context.Context) error {
	if in.TableID == nil {
		return s.repo.CreateTable(ctx, table)
	}
	table.ID = *in.TableID
	// Xác nhận bàn tồn tại và thuộc đúng nhà hàng trước khi ghi.
	if _, err := s.repo.FindTable(ctx, restaurantID, table.ID); err != nil {
		return err
	}
	return s.repo.UpdateTable(ctx, table)
})
```

`s.tx.Run` mở transaction rồi nhét nó vào `ctx`. Repo lấy ra qua `r.q(ctx)`. Nhờ vậy **repo không cần biết mình đang ở trong transaction hay không** — đây là lý do mọi method repo đều nhận `ctx` làm tham số đầu.

`FindTable` ở đây là kiểm tra quyền theo tenant: thiếu nó, ai đó gửi id của bàn thuộc nhà hàng khác vẫn sửa được.

**3.4. `DeleteTable` — thứ tự các bước là phần nghiệp vụ:**

```go
return s.tx.Run(ctx, func(ctx context.Context) error {
	if _, err := s.repo.FindTable(ctx, restaurantID, tableID); err != nil {
		return err
	}
	// Không có phiên đang mở thì trả về CodeNotFound — đó là luồng đúng ở đây.
	session, err := s.repo.FindActiveSessionByTable(ctx, restaurantID, tableID)
	if err != nil && !apperr.Is(err, apperr.CodeNotFound) {
		return err
	}
	if session != nil {
		return apperr.New(apperr.CodeConflict, "table has an active session")
	}
	// Mã QR đã in tại bàn phải ngừng hoạt động cùng lúc.
	if err := s.repo.DeactivateActiveQR(ctx, restaurantID, tableID, nil, "table deleted"); err != nil {
		return err
	}
	return s.repo.SoftDeleteTable(ctx, restaurantID, tableID)
})
```

Cả bốn bước nằm trong **một** transaction: hoặc bàn bị xoá và QR bị huỷ cùng nhau, hoặc không gì xảy ra cả. Nếu tách ra ngoài transaction và bước cuối lỗi, hệ thống còn lại bàn sống với QR chết.

Dòng `!apperr.Is(err, apperr.CodeNotFound)` là chỗ **đã code sai lần đầu**. Xem bước 4.

---

## Bước 4 — Viết test ngay, đừng đợi

File mới: `backend/internal/modules/dining/application/manage_table_test.go`

Test ở lớp application là rẻ nhất: không cần DB, chỉ cần `fakeRepo` (đã có sẵn trong `session_test.go`) và `fakeTx{}` (chạy hàm luôn, không mở transaction thật).

Thêm 3 field vào `fakeRepo` để test xem repo có được gọi đúng không:

```go
createdTable   *domain.Table
updatedTable   *domain.Table
deletedTableID uuid.UUID
```

Test những gì **có nhánh if**, bỏ qua những gì chỉ gán giá trị:

```go
t.Run("create normalises code and defaults name/status", …)  // " v03 " → "V03", name = "V03"
t.Run("rejects bad capacity and status", …)                  // 3 case đều phải CodeInvalid
t.Run("update targets the existing table", …)                // đúng ID, đúng capacity mới
t.Run("blocked while a session is active", …)                // CodeConflict + KHÔNG được xoá
t.Run("free table is soft deleted", …)
```

Chạy lần đầu → **fail**:

```
--- FAIL: TestDeleteTable/free_table_is_soft_deleted
    manage_table_test.go:87: unexpected error: active session not found
```

Truy nguyên nhân:

```bash
rg -n "func \(r \*Repository\) FindActiveSessionByTable" -A 22 …/dining_repository.go
```

Repo thật trả `apperr.New(apperr.CodeNotFound, …)` khi bàn **không** có phiên nào — chứ không trả `nil, nil` như đã đoán. Nghĩa là code ở bước 3.4 đang coi "bàn trống" là lỗi, và **sẽ không xoá được bất kỳ bàn trống nào** — tức là hỏng đúng luồng chính. Sửa:

```go
if err != nil && !apperr.Is(err, apperr.CodeNotFound) {
	return err
}
```

Đây là bài học chính của cả tài liệu này: **đừng đoán một hàm trả về gì, mở ra đọc.** Nếu không viết test, bug này chỉ lộ ra khi bấm xoá trên UI và nhận lỗi khó hiểu.

---

## Bước 5 — Interfaces: HTTP

File: `backend/internal/modules/dining/interfaces/http/handler.go`

Handler **chỉ làm 4 việc**: parse input → gọi use-case → chọn HTTP status → trả envelope. Không có `if` nghiệp vụ nào ở đây.

**5.1. Thêm field vào struct `Handler`:**

```go
SaveTable   *application.SaveTable
DeleteTable *application.DeleteTable
ListAreas   *application.ListAreas
```

**5.2. Đăng ký route vào đúng nhóm quyền:**

```go
manager := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningManage, defaultRestaurantID))
manager.GET("/areas", h.listAreas)
manager.POST("/tables", h.createTable)
manager.PATCH("/tables/:tableId", h.updateTable)
manager.DELETE("/tables/:tableId", h.deleteTable)
```

Chọn nhóm `manager` (không phải `serve`/`cashier`) vì sửa cấu trúc bàn là việc quản lý. **Đặt nhầm nhóm = lỗ hổng phân quyền**, và không có test nào bắt được — phải tự nhìn cho đúng.

**5.3. Handler mỏng:**

```go
func (h *Handler) createTable(c *gin.Context) { h.saveTable(c, nil) }

func (h *Handler) updateTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("tableId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid table id"))
		return
	}
	h.saveTable(c, &tableID)
}

func (h *Handler) saveTable(c *gin.Context, tableID *uuid.UUID) {
	var req application.SaveTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.TableID = tableID        // từ URL, không từ body
	out, err := h.SaveTable.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)   // apperr → HTTP status, tự map
		return
	}
	status := http.StatusOK
	if out.Created {
		status = http.StatusCreated  // 201 khi tạo mới
	}
	httpx.Respond(c, status, out, nil)
}
```

`httpx.RespondError` tự dịch `apperr.CodeConflict` → 409, `CodeInvalid` → 400, `CodeNotFound` → 404. Handler không cần biết mã số.

---

## Bước 6 — DI: nối dây

File: `backend/cmd/api/main.go`, hàm `wireRoutes()`

Dự án **không dùng framework DI**, mọi thứ nối tay ở đây. Viết use-case xong mà quên bước này thì route 404 hoặc panic nil pointer.

Constructor cũ nhận 10 tham số theo vị trí, thêm 3 nữa thành 13 — không ai đọc nổi và rất dễ truyền nhầm thứ tự (hai tham số cùng kiểu đổi chỗ nhau thì compiler **không** báo lỗi). Nên đã xoá `NewHandler` và chuyển sang struct literal có tên field:

```go
diningHandler := &dininghttp.Handler{
	OpenSession:   diningapp.NewOpenSession(tx, diningRepo, outboxWriter, defaultRID),
	// …
	SaveTable:   diningapp.NewSaveTable(tx, diningRepo, defaultRID),
	DeleteTable: diningapp.NewDeleteTable(tx, diningRepo, defaultRID),
	ListAreas:   diningapp.NewListAreas(diningRepo, defaultRID),
}
```

Đây là dọn dẹp có chủ đích, không phải thêm chức năng. Khi một constructor vượt ~5 tham số, đổi sang struct literal luôn đáng.

Chốt backend:

```bash
cd backend && go build ./... && go vet ./... && go test ./internal/modules/dining/...
```

---

## Bước 7 — Frontend: API trước, UI sau

**7.1. `src/features/dining/api.ts`** — mọi HTTP đều qua `apiRequest`, không gọi `fetch` trực tiếp (`apiRequest` lo envelope, JWT, retry 401):

```ts
export function saveTable({ tableId, areaId, code, name, capacity, status }: SaveTableArgs) {
  const body = { area_id: areaId ?? null, code, name, capacity, status }
  return tableId
    ? apiRequest(`/api/v1/restaurant/tables/${encodeURIComponent(tableId)}`, { method: 'PATCH', body })
    : apiRequest('/api/v1/restaurant/tables', { method: 'POST', body })
}
```

Một hàm cho cả hai, khớp với `SaveTable` ở backend. Key JSON là `snake_case` cho khớp Go struct tag.

**7.2. `src/features/dining/types.ts`** — thêm `area_id: string | null` vào `TableQR`. Backend phải trả field này thì form sửa mới chọn sẵn đúng khu vực → quay lại sửa `TableWithQR`, repo và DTO ở backend. **Việc quay lui như vậy là bình thường**, phát hiện ở bước 7 vẫn rẻ.

**7.3. Mutation + invalidate:**

```ts
const mutation = useMutation({
  mutationFn: saveTable,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY })
    onOpenChange(false)
  },
})
```

`invalidateQueries` bảo TanStack Query tải lại danh sách bàn. Thiếu dòng này: lưu thành công nhưng màn hình vẫn hiện dữ liệu cũ — và rất dễ tưởng nhầm là backend hỏng.

**7.4. Form.** Bản đầu dùng `useEffect` để reset field mỗi lần mở dialog, lint chặn ("Calling setState synchronously within an effect"). Cách đúng trong React: **remount bằng `key`**, rồi khởi tạo state ngay trong `useState`:

```tsx
<TableForm key={table?.table_id ?? 'new'} table={table} … />
// bên trong:
const [code, setCode] = useState(table?.table_code ?? '')
```

`key` đổi → React huỷ component cũ, dựng mới, state tự khởi tạo lại. Ngắn hơn và không có nhánh nào chạy sai thứ tự.

---

## Tóm tắt thứ tự

| # | Lớp | File | Ra được gì |
|---|-----|------|-----------|
| 0 | — | migration, handler cũ | Biết DB đã đủ cột, không cần migration |
| 1 | domain | `domain/model.go` | Struct + interface — compiler thành to-do list |
| 2 | infrastructure | `infrastructure/postgres/*.go` | SQL thật + dịch lỗi DB sang lỗi nghiệp vụ |
| 3 | application | `application/manage_table.go` | Validate, transaction, thứ tự nghiệp vụ |
| 4 | test | `application/manage_table_test.go` | Bắt được bug `FindActiveSessionByTable` |
| 5 | interfaces | `interfaces/http/handler.go` | Route + nhóm quyền + HTTP status |
| 6 | DI | `cmd/api/main.go` | Nối dây, không có bước này thì 404 |
| 7 | frontend | `features/dining/*`, `features/admin/components/*` | api.ts → types → mutation → form |

## Sáu lỗi dễ mắc

1. **Sửa `SELECT` mà quên sửa `Scan`** → lỗi lúc chạy, không lúc compile.
2. **`UPDATE`/`DELETE` không check `RowsAffected()`** → 0 dòng vẫn báo thành công.
3. **Để lỗi Postgres rò lên client** → 500 thay vì 409 kèm thông báo đọc được.
4. **Đoán hàm trả về gì thay vì mở ra đọc** → chính là bug ở bước 4.
5. **Quên nối dây trong `main.go`** → route 404 dù code đã đủ.
6. **Quên `invalidateQueries`** → lưu xong màn hình vẫn dữ liệu cũ.

## Làm lại với bảng khác

Ví dụ CRUD `areas`, đi đúng 7 bước trên, chỉ đổi tên. Ba câu hỏi cần trả lời riêng cho từng bảng:

- **Xoá mềm hay xoá thật?** Có bảng nào tham chiếu tới không? Có → xoá mềm.
- **Điều kiện nào chặn xoá?** Bàn: đang có phiên. Khu vực: còn bàn thuộc khu đó. Món ăn: đang nằm trong đơn chưa phục vụ.
- **Thao tác nào phải đi cùng nhau?** Xoá bàn kéo theo huỷ QR → cùng một transaction.
