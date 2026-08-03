# Bảo mật phiên QR — mô hình hiện tại

## Tài sản và định danh

| Thành phần | Vai trò bảo mật |
|---|---|
| `qr_token` | Token opaque công khai trên QR, chỉ dùng tìm đúng nhà hàng và bàn |
| `device_id` | Định danh trình duyệt; không phải credential |
| `dining_sessions.id` | Khóa nội bộ của phiên ăn; không phải credential |
| `session_code` | Mã nghiệp vụ cho nhân viên; không phải credential |
| `session_devices.access_token` | Bearer credential bí mật, riêng cho từng thiết bị |

## Luồng cấp quyền

1. Client gửi `qr_token`, `device_id` và tên khách tới endpoint join public.
2. Backend rate-limit theo IP, tra QR để xác định tenant và bàn.
3. Nếu bàn chưa có phiên mở, backend tạo `dining_sessions` ở trạng thái chờ xác minh và tạo owner
   device. Nếu đã có phiên, backend tạo thêm device `PENDING`.
4. Backend sinh access token ngẫu nhiên riêng cho device và trả trong `access_token` với
   `Cache-Control: no-store`.
5. Token `PENDING` chỉ poll được trạng thái; middleware gọi món từ chối nó.
6. Nhân viên nhìn tên khách và bàn rồi approve/reject device. Chỉ owner được phép kích hoạt phiên.
7. Sau approve, client gửi `X-Device-Access-Token` trên mỗi request. Backend tra device, yêu cầu
   `APPROVED`, rồi kiểm tra phiên còn mở.

Access token không nằm trong URL, do đó không bị chia sẻ cùng link QR hoặc lưu trong browser history,
proxy URL và access log thông thường.

## Join lại và chống chiếm device

Khi một `device_id` đã tồn tại, join lại phải gửi chính access token đã cấp trước đó trong
`X-Device-Access-Token`. Biết hoặc sao chép `device_id` không đủ để lấy lại credential. So sánh token
dùng constant-time comparison.

Frontend lưu credential trên thiết bị để reload vẫn resume được. Link chia sẻ chỉ chứa `qr_token`, nên
điện thoại nhận link trở thành device mới `PENDING` và cần nhân viên duyệt.

## Các kiểm soát chính

- Join public có rate limit theo IP để hạn chế spam device chờ duyệt.
- `session_devices` ràng buộc tenant cùng `dining_sessions` bằng foreign key kép.
- Mỗi phiên chỉ có một owner bằng partial unique index.
- Mỗi `(session_id, device_id)` chỉ có một device row.
- Access token unique, ngẫu nhiên và không dùng làm query parameter.
- Owner bị reject sẽ đóng/reject cả yêu cầu liên quan; device không được poll vô hạn vào phiên đã xóa.
- Đóng phiên hoặc thanh toán hoàn tất làm access token mất hiệu lực vì validator yêu cầu phiên còn mở.
- Staff HTTP dùng JWT `Authorization`; guest HTTP dùng header riêng `X-Device-Access-Token`.
- Staff WebSocket dùng `access_token`; guest WebSocket dùng `device_access_token`, tránh nhập nhằng.
- Audit QR scan ghi `ip_hash`, user agent, trace id và outcome qua outbox.

## Rủi ro còn lại

| Rủi ro | Giới hạn hiện tại |
|---|---|
| Người dùng tự chia sẻ access token bí mật | Bearer credential không thể chống chủ sở hữu cố ý chuyển tiếp; không đưa token vào URL và cần bảo vệ thiết bị |
| Người có ảnh QR spam join | Rate limit theo IP, mọi device mới vẫn `PENDING`, nhân viên có thể reject |
| Nhân viên duyệt nhầm người | UI phải luôn hiển thị tên khách, bàn và danh sách device; đây là bước kiểm soát con người |
| Token bị lấy khỏi local storage trên thiết bị đã nhiễm mã độc | Giảm bằng CSP/XSS hygiene; đóng phiên thu hồi hiệu lực server-side |
| Rate limit in-memory khi chạy nhiều replica | Cần shared limiter như Redis nếu scale ngang nhiều API instance |

## Bất biến cần giữ khi sửa code

- Không xác thực bằng `device_id`, `session_id`, `session_code` hoặc `qr_token`.
- Không nhận tenant/bàn do guest tự khai; luôn suy ra từ access token đã validate.
- Không trả access token của device đã tồn tại nếu request thiếu token resume đúng.
- Không cho device `PENDING` hoặc `REJECTED` gọi API nghiệp vụ hay mở WebSocket guest.
- Không kích hoạt phiên từ approval của device không phải owner.
