# QR token vs Session token — server biết bàn nào bằng cách nào?

> Giải thích chỗ dễ nhầm: "mã QR không chứa định danh bàn" **không** có nghĩa là server không
> biết bàn. Server vẫn biết — qua **bảng ánh xạ token ↔ bàn** lưu phía máy chủ, không phải đọc
> thẳng định danh từ chuỗi QR.

## 1. Vì sao QR không nhúng thẳng `table_id`

Hai cách nhúng bàn vào mã QR:

```
Cách NGÂY THƠ (KHÔNG dùng):  QR = "table_id=5"   → đoán được table_id=6 → truy cập sang bàn khác
Cách AN TOÀN (đang dùng):    QR = "a9f3k2xq..."  → chuỗi ngẫu nhiên, không đoán được
                             server tra sổ: a9f3k2xq → bàn 5
```

Mã QR chỉ chứa một **token ngẫu nhiên**. Server giữ bảng ánh xạ `qr_token → bàn`. Khi khách quét,
server tra bảng để ra bàn. Bàn được xác định **gián tiếp qua lookup**, không phải vì chuỗi tự khai
"tôi là bàn 5".

Lợi ích:
- Token ngẫu nhiên → không suy đoán để truy cập bàn khác.
- Thu hồi / xoay mã khi lộ mà không cần thay đổi bản thân bàn.

## 2. Hai loại token — đừng lẫn

| | **QR token** | **Session token** |
|---|---|---|
| Ở đâu | in cố định, dán trên bàn | sinh khi mở phiên, lưu ở điện thoại khách |
| Tính chất | công khai, cố định lâu dài | bí mật, theo phiên, hết hiệu lực khi đóng phiên |
| Vai trò | định danh bàn (gián tiếp) | "vé" xác thực gọi món |
| Server tra | `qr_token → bàn` | `session_token → phiên → bàn` |

## 3. Luồng đầy đủ — server biết bàn ở MỖI bước

```
1. Nhân viên mở phiên bàn 5   → DB: phiên#123 gắn bàn 5 (trạng thái ACTIVE)

2. Khách quét QR              → gửi qr_token "a9f3k2xq"
   server: qr_token → bàn 5 → tìm phiên ACTIVE của bàn 5 → phiên#123
   → trả session_token "S-secret" (gắn phiên#123)
   điện thoại LƯU session_token

3. Khách đặt món              → gửi danh sách món + header session_token "S-secret"
   server: session_token → phiên#123 → bàn 5
   → gắn đơn vào phiên#123 (đúng bàn 5)
```

- **Bước 2 dùng QR token**: định bàn → tìm phiên → phát "vé" (session token).
- **Bước 3 trở đi dùng session token**: vé → phiên → bàn. Không quét lại QR nữa.

## 4. Vì sao tách hai token

- **QR token cố định** → một tấm in dán dùng mãi, phục vụ nhiều lượt khách khác nhau.
- **Session token theo phiên** → mỗi lượt khách một vé riêng; đóng phiên là vé mất hiệu lực →
  khách của phiên cũ không thể gọi món vào phiên mới của bàn.
- **Ngẫu nhiên, không đoán được** → không nhảy sang bàn khác; xoay mã được khi lộ.

## Tóm tắt một câu

> Server biết bàn nào nhờ **bảng ánh xạ token ↔ bàn ở máy chủ** — mã QR chỉ cầm token, server tra
> ra bàn. QR token định danh bàn (gián tiếp); session token là vé xác thực mọi thao tác gọi món
> sau khi quét.

> Liên quan: UC-01 (Quét QR vào phiên) trong `sequence-diagrams-4cot.md`; sơ đồ nghiệp vụ
> `business-process-quan-ly-ma-qr.drawio` và `business-process-tiep-nhan-mo-phien.drawio`.
