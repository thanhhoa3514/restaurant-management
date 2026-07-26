# Postman collection

Import hai file sau vào Postman:

- `restaurant-management.postman_collection.json`
- `restaurant-management.local.postman_environment.json`

Chọn environment **Restaurant Management - Local**, sau đó chạy theo thứ tự:

1. `01. Public / Staff login`
2. `01. Public / List guest tables and QR tokens`
3. `01. Public / Join dining session by QR`
4. Các request trong `02. Guest - Menu & Ordering`

Các test script tự lưu JWT, refresh token, QR token, session token và những UUID thường dùng vào collection variables.

Để gọi UAT, đổi:

```text
base_url = https://jackiengo.io.vn
ws_url   = wss://jackiengo.io.vn
```

Không chạy toàn bộ collection trên production: các request create, update, delete, payment và logout làm thay đổi dữ liệu thật. Một số folder cũng yêu cầu vai trò khác nhau; đổi `staff_username` rồi đăng nhập lại:

- `manager`
- `cashier`
- `server`
- `kitchen`

Mật khẩu seed mặc định là `demo1234`, hoặc giá trị `DEMO_SEED_PASSWORD` nếu môi trường đã ghi đè.

Sau khi thay đổi danh sách route hoặc DTO mẫu, sinh lại collection:

```bash
node scripts/generate-postman-collection.mjs
```
