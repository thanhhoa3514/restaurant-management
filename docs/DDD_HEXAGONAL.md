# DDD + Hexagonal Architecture Notes

## Dependency Inversion là gì?

**Cách thường (không DDD):**
```
Handler → Service → Repository → DB driver
```
Lớp trên import lớp dưới — phụ thuộc đi xuôi. Muốn đổi DB là đập đi xây lại.

**Cách DDD + Hexagonal:**
```
interfaces → application → domain ← infrastructure
```
Domain ở trung tâm, **không import ai**. Infra import domain (đảo ngược).

---

## Domain bị ô nhiễm bởi infra là sao?

Tức là domain code **biết đến** database, HTTP request, JSON, hay framework.

### Dấu hiệu nhận biết

Trong file `domain/*.go` mà thấy:

| Import / Code | Vấn đề |
|--------------|--------|
| `import "github.com/gin-gonic/gin"` | Domain biết HTTP framework |
| `import "database/sql"` hoặc `pgx` | Domain biết database driver |
| `json.Marshal` / `json.Unmarshal` | Domain biết serialization format |
| `c *gin.Context` làm parameter | Domain biết HTTP request |
| `SELECT ... FROM ...` trong domain | Domain biết SQL |

### Ví dụ ô nhiễm (sai)

```go
// domain/model.go ❌
type Session struct {
    ID        uuid.UUID
    TableID   uuid.UUID
    Status    string
}

func (s *Session) Open(db *sql.DB) error {
    // Domain biết đến sql.DB, biết SQL query — ô nhiễm!
    _, err := db.Exec("INSERT INTO dining_sessions ...")
    return err
}

func (s *Session) ToJSON() string {
    // Domain biết đến JSON serialize — ô nhiễm!
    b, _ := json.Marshal(s)
    return string(b)
}
```

Muốn đổi DB (Postgres → MySQL): phải sửa domain.  
Muốn test domain logic: phải có DB thật.  
Business logic lẫn với infra code.

### Ví dụ không ô nhiễm (đúng)

```go
// domain/model.go ✅ — thuần Go struct
type SessionStatus string
const SessionActive SessionStatus = "ACTIVE"

type Session struct {
    ID        uuid.UUID
    TableID   uuid.UUID
    Status    SessionStatus
    CreatedAt time.Time
}

func (s *Session) AssignTable(tableID uuid.UUID) error {
    if s.Status != "" {
        return ErrSessionAlreadyOpened
    }
    s.TableID = tableID
    s.Status = SessionActive
    return nil
}
```

```go
// infrastructure/postgres/repository.go — infra làm việc infra
func (r *Repository) CreateSession(ctx context.Context, s *domain.Session) error {
    _, err := r.pool.Exec(ctx, "INSERT INTO dining_sessions ...")
    return err
}
```

---

## Port vs Adapter

| Khái niệm | Trong code | Vai trò |
|-----------|-----------|---------|
| **Port** | `domain/gateway.go`: interface | Domain định nghĩa "tôi cần gì" |
| **Adapter** | `infrastructure/postgres/*.go` | Infra làm cái domain cần |
| **Dependency inversion** | Domain không import infra; infra import domain | Đổi adapter không ảnh hưởng domain |
| **Wiring** | `main.go: wireRoutes()` | Nối adapter vào port |

```
       main.go (wiring)
      /    |      \
     ↓     ↓       ↓
┌─────────┐ ┌───────────┐ ┌──────────────────┐
│ Handler  ││ Application││  Infrastructure   │
│(interfaces)││ (usecase)  ││  (postgres/gateway)│
│          ││           ││                    │
│ gọi use │→│ gọi port  │→│ implement port    │
│  case    ││ (interface)││  (adapter)         │
└─────────┘ └───────────┘ └──────────────────┘
                  │                ↑
                  │         (đảo ngược)
                  ↓                │
              ┌────────────────────┘
              │ Domain
              │ - model.go (entity)
              │ - gateway.go (interface = port)
              │
              │ Domain KHÔNG biết infra,
              │ Infra biết domain.
              └────────────
```

---

## Nhìn vào code project này

**Domain** (`domain/`) — sạch, chỉ enum + struct:
```go
type SessionStatus string
const SessionActive SessionStatus = "ACTIVE"

type DiningSession struct {
    Status SessionStatus
    ...
}
```

**Application** — chỉ biết interface (port):
```go
type OpenSession struct {
    repo   domain.DiningRepository  // port
    tx     TxRunner
    outbox domain.OutboxWriter      // port
}
```

**Infrastructure** — implement port, chứa DB/SQL:
```go
func (r *Repository) CreateSession(ctx context.Context, s *domain.DiningSession) error {
    _, err := r.pool.Exec(ctx, "INSERT INTO dining_sessions ...")
    return err
}
```

Domain không import `pgx`, không import `gin`, không import `json`.  
**Đó là domain không bị ô nhiễm.**

---

## Lợi ích

1. **Test business logic không cần DB** — mock interface là đủ
2. **Đổi infra không chạm domain** — Postgres ↔ MySQL, Gin ↔ Echo, REST ↔ gRPC
3. **Business logic dễ đọc** — chỉ có "nghiệp vụ nhà hàng", không có "làm sao để query"
4. **Domain là tài sản quý nhất** — nghiệp vụ thay đổi chậm, infra thay đổi nhanh. Domain cô lập = bền.
