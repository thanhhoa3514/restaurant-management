# QR token và device access token

Hai token này có phạm vi và mức độ bí mật khác nhau:

| | QR token | Device access token |
|---|---|---|
| Nguồn | QR cố định dán trên bàn | Backend sinh khi một thiết bị join |
| Lưu tại server | `qr_codes.token` | `session_devices.access_token` |
| Mức độ bí mật | Có thể bị nhìn thấy/chia sẻ | Bearer credential, chỉ lưu trên thiết bị |
| Mục đích | Tìm nhà hàng và bàn | Xác thực một thiết bị đã được duyệt |
| Hiệu lực | Khi QR còn active | Khi device `APPROVED` và phiên còn mở |

## Luồng xác thực

```text
Quét URL chứa qr_token
  → backend tìm qr_codes → restaurant_id + table_id
  → tìm hoặc tạo dining_sessions
  → tạo session_devices PENDING + access_token riêng
  → trả access_token cho đúng thiết bị
  → thiết bị poll trạng thái bằng X-Device-Access-Token
  → phục vụ approve
  → cùng access_token được phép gọi API khách
```

Mỗi request được bảo vệ gửi:

```http
X-Device-Access-Token: <access_token>
```

Backend tra `session_devices.access_token`, yêu cầu device có trạng thái `APPROVED`, rồi lấy
`session_id`. Từ `session_id`, backend lấy phiên, nhà hàng và bàn. Client không được tự khai
`restaurant_id`, `table_id` hay dùng `session_id` làm credential.

## Các định danh không phải credential

- `device_id`: định danh ổn định của trình duyệt, dùng tìm lại device row; không đủ để resume nếu
  thiếu access token cũ.
- `session_id`: UUID nội bộ của dòng `dining_sessions`.
- `session_code`: mã nghiệp vụ để nhân viên tìm và đối chiếu phiên.
- `qr_token`: chỉ là điểm vào để yêu cầu tham gia bàn, không cấp quyền gọi món trực tiếp.

## Realtime

Staff WebSocket gửi JWT bằng `access_token`; guest gửi credential thiết bị bằng trường riêng để
không nhập nhằng:

```json
{ "type": "_auth", "device_access_token": "..." }
```
