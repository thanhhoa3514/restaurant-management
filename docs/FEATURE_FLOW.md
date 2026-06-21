# Thêm Feature Mới Trong Module Hiện Có

## Flow chuẩn (Hexagonal + DDD)

### 1. Domain Layer — `internal/modules/<module>/domain/`
- **`model.go`**: Entity / value object / status mới (nếu cần)
- **`gateway.go`**: Thêm method mới vào repository interface (nếu cần query mới)

**Không cần chạm nếu:** feature dùng entity và query đã có sẵn.

### 2. Application Layer — `internal/modules/<module>/application/`
Tạo file `ten_feature.go`:

```go
type TenFeature struct {
    repo   domain.Repository
    tx     *postgres.TxManager
    outbox *outbox.Dispatcher
}

func NewTenFeature(tx *postgres.TxManager, repo domain.Repository, outbox *outbox.Dispatcher) *TenFeature {
    return &TenFeature{tx: tx, repo: repo, outbox: outbox}
}

func (uc *TenFeature) Handle(ctx context.Context, req dto.TenFeatureRequest) (dto.TenFeatureResponse, error) {
    // business logic thuần — gọi repo, tx, outbox
}
```

- **`dto.go`**: Request / Response types (nên có)

### 3. Interface Layer — `internal/modules/<module>/interfaces/http/`
- **`handler.go`**: Thêm route + handler method
- Có thể chọn route group: `RegisterRoutes` (admin/staff), `RegisterGuestRoutes`, `RegisterStaffRoutes`, `RegisterKitchenRoutes`

```go
func (h *Handler) tenFeature(c *gin.Context) {
    var req dto.TenFeatureRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request", err))
        return
    }
    out, err := h.TenFeature.Handle(c.Request.Context(), req)
    if err != nil {
        httpx.RespondError(c, err)
        return
    }
    httpx.Respond(c, http.StatusOK, out, nil)
}
```

### 4. Infrastructure Layer — `internal/modules/<module>/infrastructure/postgres/`
- Implement method mới từ gateway interface (nếu có)

### 5. Wiring — `cmd/api/main.go`
Trong `wireRoutes()`, thêm **1 dòng**:

```go
orderingHandler := orderinghttp.NewHandler(
    // ...các use case cũ...
    orderingapp.NewTenFeature(tx, orderingRepo, outboxWriter), // ← thêm
)
```

---

## Tóm tắt

| Bước | File | Bắt buộc? |
|------|------|-----------|
| Domain (entity mới) | `domain/model.go` | ❌ nếu entity đã có |
| Gateway (query mới) | `domain/gateway.go` | ❌ nếu query đã có |
| Use case | `application/ten_feature.go` | ✅ |
| DTO | `application/dto.go` | ✅ nên có |
| Route + handler | `interfaces/http/handler.go` | ✅ |
| SQL query mới | `infrastructure/postgres/...` | ❌ nếu query đã có |
| Wiring | `cmd/api/main.go` | ✅ (1 dòng) |

**Đa số feature chỉ cần:** Application (use case) → Interface (handler) → Wiring (main.go).
Domain và Infra chỉ động tới khi có entity mới hoặc query mới.
