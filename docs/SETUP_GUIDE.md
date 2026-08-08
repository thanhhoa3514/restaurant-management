# Hướng dẫn cài đặt & chạy dự án

Tài liệu này hướng dẫn cài đặt và chạy hệ thống **Quản lý nhà hàng (QR-ordering cho quán lẩu & nướng)** trên máy tính cá nhân để chấm/đánh giá. Trọng tâm là **Windows 10/11**; phần cuối có ghi chú nhanh cho macOS và Linux.

Toàn bộ dự án gồm 2 phần chạy song song:

| Thành phần                   | Công nghệ    | Chạy ở đâu       | Cổng (port)     |
| ---------------------------- | ------------ | ---------------- | --------------- |
| Cơ sở dữ liệu PostgreSQL     | Docker       | Docker container | `5440`          |
| Lưu trữ ảnh MinIO (tùy chọn) | Docker       | Docker container | `9000` / `9001` |
| Backend API                  | Go 1.26      | Máy thật (local) | `8080`          |
| Frontend (giao diện web)     | Vite + React | Máy thật (local) | `5173`          |

> **Mô hình:** Docker chỉ chạy **cơ sở dữ liệu (PostgreSQL) và MinIO**. Backend API và Frontend chạy trực tiếp trên máy. Đây là cách nhẹ nhất, nhanh nhất để chạy thử.

---

## 1. Yêu cầu phần mềm

Cần cài 4 phần mềm sau (bảng ghi phiên bản tối thiểu):

| Phần mềm           | Phiên bản      | Dùng để                  |
| ------------------ | -------------- | ------------------------ |
| **Docker Desktop** | mới nhất       | Chạy PostgreSQL + MinIO  |
| **Go**             | 1.26 trở lên   | Biên dịch & chạy backend |
| **Node.js**        | 20 LTS trở lên | Chạy frontend            |
| **Git**            | mới nhất       | Tải mã nguồn             |

Trên Windows, Docker Desktop yêu cầu **WSL2** (Windows Subsystem for Linux). Đây cũng là môi trường được khuyến nghị để chạy dự án vì có sẵn lệnh `make`.

---

## 2. Cài đặt phần mềm trên Windows

### Cách nhanh nhất — dùng `winget` (có sẵn trên Windows 11)

Mở **PowerShell** (bấm Start → gõ `PowerShell` → Enter) rồi chạy lần lượt:

```powershell
winget install --id Docker.DockerDesktop -e
winget install --id GoLang.Go -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
```

Sau khi cài xong, **khởi động lại máy** một lần để Docker Desktop và WSL2 nhận cấu hình.

### Cách thủ công (nếu không có `winget`)

Tải bộ cài từ các trang chính thức:

- Docker Desktop — <https://www.docker.com/products/docker-desktop/>
- Go — <https://go.dev/dl/>
- Node.js (bản LTS) — <https://nodejs.org/>
- Git — <https://git-scm.com/download/win>

### Bật WSL2 (nếu Docker báo thiếu)

Nếu Docker Desktop báo lỗi thiếu WSL2, mở **PowerShell với quyền Administrator** và chạy:

```powershell
wsl --install
```

Sau đó khởi động lại máy.

### Kiểm tra đã cài đúng

Mở **PowerShell** mới và chạy từng lệnh — mỗi lệnh phải in ra số phiên bản:

```powershell
docker --version
go version
node --version
git --version
```

Đảm bảo **Docker Desktop đang chạy** (biểu tượng con cá voi ở khay hệ thống hiển thị "Running") trước khi sang bước tiếp theo.

---

## 3. Tải mã nguồn

Nếu đã có sẵn thư mục dự án thì bỏ qua bước clone. Nếu chưa:

```powershell
git clone <ĐỊA_CHỈ_REPO> restaurant-management
cd restaurant-management
```

Cấu trúc thư mục chính:

```text
restaurant-management/
├── backend/    # Go API, migrations, docker-compose.yml
├── frontend/   # Giao diện Vite/React
└── docs/       # Tài liệu (kể cả file này)
```

---

## 4. Tạo file cấu hình `.env`

Backend đọc cấu hình từ biến môi trường. Có sẵn file mẫu `backend/.env.example`. Sao chép thành `.env`:

```powershell
cd backend
copy .env.example .env
```

Với mục đích chạy thử/chấm bài, **không cần sửa gì** trong `.env` — các giá trị mặc định đã đủ chạy. (Các khóa thanh toán SePay để trống vẫn chạy được ở chế độ demo.)

---

## 5. Chạy Backend

Có 2 cách. **Cách A (khuyến nghị)** dùng WSL2 + `make`, gọn nhất. **Cách B** dùng PowerShell thuần nếu không muốn dùng WSL.

### Cách A — Dùng WSL2 + `make` (khuyến nghị)

Mở terminal Ubuntu (WSL). Di chuyển vào thư mục `backend` của dự án rồi chạy:

```bash
cd backend

make db-up      # 1. Khởi động PostgreSQL + MinIO trong Docker
make migrate    # 2. Tạo bảng cơ sở dữ liệu
make seed       # 3. Nạp dữ liệu demo (menu, bàn, tài khoản nhân viên)
make run        # 4. Khởi động API — chạy tại http://localhost:8080
```

> **Quan trọng — bước `make seed` bắt buộc chạy ít nhất một lần.** API cần một bản ghi nhà hàng trong database, nếu database rỗng thì API **không khởi động được**. `make seed` tạo sẵn nhà hàng demo kèm menu, bàn và tài khoản đăng nhập.

Terminal sẽ giữ tiến trình API chạy. **Không đóng cửa sổ này.** Để dừng: bấm `Ctrl + C`.

### Cách B — Dùng PowerShell thuần (không cần `make`)

Nếu không dùng WSL, chạy trực tiếp bằng Go trong PowerShell. Lưu ý **phải đặt biến `DATABASE_URL`** trỏ về cổng `5440` (mặc định của Go là `5432`, sẽ sai):

```powershell
cd backend

# 1. Khởi động PostgreSQL + MinIO
docker compose up -d postgres minio

# 2. Đặt biến kết nối database (bắt buộc — dán nguyên dòng này)
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5440/restaurant?sslmode=disable"

# 3. Tạo bảng
go run ./cmd/migrate

# 4. Nạp dữ liệu demo (bắt buộc chạy 1 lần)
go run ./cmd/seed

# 5. Khởi động API tại http://localhost:8080
go run ./cmd/api
```

> Biến `$env:DATABASE_URL` chỉ có hiệu lực trong cửa sổ PowerShell hiện tại. Nếu mở cửa sổ mới để chạy `go run ./cmd/api`, phải đặt lại biến này trước.

Khi thấy log báo API lắng nghe ở `:8080` là backend đã sẵn sàng.

---

## 6. Chạy Frontend

Mở **một terminal MỚI** (giữ terminal backend vẫn chạy). Vào thư mục `frontend`:

```powershell
cd frontend
npm install     # Cài thư viện — chỉ cần chạy lần đầu (mất vài phút)
npm run dev     # Khởi động giao diện web
```

Vite sẽ in ra địa chỉ, thường là:

```text
  ➜  Local:   http://localhost:5173/
```

Frontend tự động chuyển tiếp (proxy) các yêu cầu `/api` tới backend `:8080`, nên **không cần cấu hình thêm** khi chạy local.

---

## 7. Truy cập hệ thống & tài khoản demo

Mở trình duyệt vào **<http://localhost:5173>**.

- **Trang khách hàng (guest):** quét/mở QR bàn để vào phiên gọi món. Từ dữ liệu seed đã có sẵn bàn và phiên demo.
- **Trang quản trị/nhân viên:** vào `/login`, đăng nhập bằng tài khoản demo bên dưới.

Tài khoản do `make seed` tạo (mật khẩu **`demo1234`** cho tất cả):

| Tên đăng nhập | Vai trò         |
| ------------- | --------------- |
| `manager`     | Quản lý / Admin |
| `cashier`     | Thu ngân        |
| `server`      | Phục vụ         |
| `kitchen`     | Bếp             |

> Nếu chạy `cmd/setup` (thay vì `seed`) thì mật khẩu mặc định là `admin1234`.

---

## 8. Dừng & dọn dẹp

Dừng backend và frontend: bấm `Ctrl + C` ở từng terminal.

Dừng các container Docker (PostgreSQL, MinIO):

```powershell
cd backend
docker compose down
```

Xóa luôn dữ liệu database để chạy lại từ đầu (thêm cờ `-v`):

```powershell
docker compose down -v
```

Sau khi xóa dữ liệu, cần chạy lại `migrate` và `seed` ở lần khởi động sau.

---

## 9. Xử lý lỗi thường gặp

| Triệu chứng                                                 | Nguyên nhân & cách xử lý                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API tắt ngay khi khởi động, log báo không tìm thấy nhà hàng | Chưa chạy `seed` (hoặc `setup`). Chạy `make seed` / `go run ./cmd/seed` rồi khởi động lại.                                                                                   |
| `connection refused` khi migrate/chạy API                   | PostgreSQL chưa chạy hoặc sai cổng. Kiểm tra Docker Desktop đang chạy; đảm bảo đã `docker compose up -d postgres`; ở PowerShell nhớ đặt `$env:DATABASE_URL` trỏ cổng `5440`. |
| Cổng `8080`/`5173`/`5440` bị chiếm                          | Có ứng dụng khác đang dùng cổng. Tắt ứng dụng đó, hoặc dừng container cũ bằng `docker compose down`.                                                                         |
| `docker: command not found` / Docker không phản hồi         | Docker Desktop chưa mở. Mở Docker Desktop, đợi trạng thái "Running" rồi thử lại.                                                                                             |
| Frontend mở được nhưng gọi API lỗi                          | Backend chưa chạy hoặc đã tắt. Kiểm tra terminal backend còn chạy ở `:8080`.                                                                                                 |
| `make: command not found` (trên Windows)                    | `make` không có sẵn trên Windows thuần. Dùng **Cách B** (PowerShell) hoặc chạy trong WSL2.                                                                                   |

---

## 10. Ghi chú cho macOS / Linux

Các bước giống hệt, chỉ khác phần cài đặt phần mềm và lệnh sao chép file:

- **Cài phần mềm:**
  - macOS: `brew install --cask docker` và `brew install go node git`
  - Ubuntu/Debian: cài Docker Engine theo trang chủ Docker, `sudo apt install golang git`, và Node.js qua [nvm](https://github.com/nvm-sh/nvm) hoặc NodeSource.
- **Sao chép `.env`:** dùng `cp .env.example .env` (thay cho `copy`).
- **Chạy backend:** dùng **Cách A** (`make db-up` → `make migrate` → `make seed` → `make run`). `make` có sẵn trên macOS/Linux.
- **Chạy frontend:** giống hệt — `npm install` rồi `npm run dev`.

---

## Tóm tắt lệnh (bản rút gọn)

```bash
# Terminal 1 — Backend (trong WSL/macOS/Linux)
cd backend
cp .env.example .env      # Windows: copy .env.example .env
make db-up
make migrate
make seed                 # bắt buộc chạy 1 lần
make run                  # API → http://localhost:8080

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev               # Web → http://localhost:5173
```

Đăng nhập nhân viên: `manager` / `demo1234` tại <http://localhost:5173/login>.
