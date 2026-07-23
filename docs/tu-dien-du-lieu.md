# Từ điển dữ liệu hệ thống quản lý nhà hàng

> Hệ quản trị cơ sở dữ liệu: PostgreSQL 15+  
> Nguồn kiểu dữ liệu và ràng buộc: các migration trong `backend/migrations`.  
> Quy ước: **K** = khóa chính; **U** = thuộc ràng buộc duy nhất; **M** = bắt buộc (`NOT NULL`). Dấu `x` thể hiện thuộc tính có ràng buộc tương ứng.

Các khóa ngoại được nhận biết qua tên cột có hậu tố `_id`; quan hệ chi tiết và quy tắc xóa được định nghĩa trong migration.
Với ràng buộc duy nhất gồm nhiều cột, dấu `x` ở cột **U** cho biết thuộc tính là một thành phần của khóa duy nhất kết hợp.

## `roles`

Vai trò người dùng (quản lý, thu ngân, phục vụ, bếp).

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `name` | `VARCHAR(50)` |  | x | x | Tên |
| `display_name` | `VARCHAR(100)` |  |  | x | Tên hiển thị |
| `description` | `TEXT` |  |  |  | Mô tả |
| `is_system` | `BOOLEAN` |  |  | x | Đánh dấu vai trò hệ thống |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `permissions`

Quyền hạn chi tiết trong hệ thống.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `code` | `VARCHAR(100)` |  | x | x | Mã nghiệp vụ |
| `display_name` | `VARCHAR(150)` |  |  | x | Tên hiển thị |
| `module` | `VARCHAR(50)` |  |  | x | Phân hệ chức năng |
| `description` | `TEXT` |  |  |  | Mô tả |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `role_permissions`

Liên kết vai trò với quyền hạn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `role_id` | `UUID` | x |  | x | Mã vai trò |
| `permission_id` | `UUID` | x |  | x | Mã quyền hạn |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `restaurants`

Thông tin nhà hàng.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `name` | `VARCHAR(150)` |  |  | x | Tên |
| `code` | `VARCHAR(50)` |  | x | x | Mã nghiệp vụ |
| `address` | `TEXT` |  |  |  | Địa chỉ |
| `phone` | `VARCHAR(30)` |  |  |  | Số điện thoại |
| `email` | `VARCHAR(150)` |  |  |  | Địa chỉ email |
| `tax_code` | `VARCHAR(50)` |  |  |  | Mã số thuế |
| `logo_url` | `VARCHAR(500)` |  |  |  | Đường dẫn ảnh logo |
| `timezone` | `VARCHAR(80)` |  |  | x | Múi giờ |
| `currency` | `VARCHAR(10)` |  |  | x | Đơn vị tiền tệ |
| `vat_rate_basis_points` | `INT` |  |  | x | Thuế suất VAT theo basis point |
| `service_charge_basis_points` | `INT` |  |  | x | Tỷ lệ phí phục vụ theo basis point |
| `status` | `VARCHAR(30)` |  |  | x | Trạng thái |
| `settings` | `JSONB` |  |  |  | Cấu hình mở rộng dạng JSON |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `users`

Tài khoản nhân viên.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `username` | `VARCHAR(80)` |  | x | x | Tên đăng nhập |
| `email` | `VARCHAR(150)` |  | x |  | Địa chỉ email |
| `phone` | `VARCHAR(30)` |  | x |  | Số điện thoại |
| `password_hash` | `VARCHAR(255)` |  |  | x | Mật khẩu đã băm |
| `full_name` | `VARCHAR(150)` |  |  | x | Họ và tên |
| `avatar_url` | `VARCHAR(500)` |  |  |  | Đường dẫn ảnh đại diện |
| `role_id` | `UUID` |  |  |  | Mã vai trò |
| `status` | `VARCHAR(30)` |  |  | x | Trạng thái |
| `last_login_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm đăng nhập gần nhất |
| `failed_login_attempts` | `INT` |  |  | x | Số lần đăng nhập thất bại liên tiếp |
| `locked_until` | `TIMESTAMPTZ` |  |  |  | Thời điểm khóa tài khoản kết thúc |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `user_sessions`

Phiên đăng nhập của nhân viên.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `user_id` | `UUID` |  |  | x | Mã người dùng |
| `refresh_token_hash` | `VARCHAR(255)` |  |  | x | Refresh token đã băm |
| `device_info` | `JSONB` |  |  |  | Thông tin thiết bị dạng JSON |
| `ip_address` | `VARCHAR(80)` |  |  |  | Địa chỉ IP |
| `expires_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm hết hạn |
| `revoked_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm bị thu hồi |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `last_used_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm sử dụng gần nhất |

## `areas`

Khu vực trong nhà hàng.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `name` | `VARCHAR(100)` |  | x | x | Tên |
| `description` | `TEXT` |  |  |  | Mô tả |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `tables`

Bàn ăn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `area_id` | `UUID` |  |  |  | Mã khu vực |
| `code` | `VARCHAR(50)` |  | x | x | Mã nghiệp vụ |
| `name` | `VARCHAR(100)` |  |  | x | Tên |
| `capacity` | `INT` |  |  | x | Sức chứa của bàn |
| `status` | `VARCHAR(30)` |  |  | x | Trạng thái |
| `position_x` | `INT` |  |  |  | Tọa độ ngang trên sơ đồ |
| `position_y` | `INT` |  |  |  | Tọa độ dọc trên sơ đồ |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `qr_codes`

Mã QR gắn với bàn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `table_id` | `UUID` |  | x | x | Mã bàn |
| `token` | `VARCHAR(255)` |  | x | x | Chuỗi token của mã QR |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `activated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm kích hoạt |
| `deactivated_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm ngừng kích hoạt |
| `deactivated_by` | `UUID` |  |  |  | Mã người dùng thực hiện ngừng kích hoạt |
| `deactivated_reason` | `VARCHAR(255)` |  |  |  | Lý do ngừng kích hoạt |
| `created_by` | `UUID` |  |  |  | Mã người dùng thực hiện tạo |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |

## `categories`

Danh mục món ăn, hỗ trợ phân cấp cha–con.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `parent_id` | `UUID` |  |  |  | Mã parent |
| `name` | `VARCHAR(120)` |  |  | x | Tên |
| `slug` | `VARCHAR(150)` |  | x | x | Tên định danh dùng trên URL |
| `description` | `TEXT` |  |  |  | Mô tả |
| `image_url` | `VARCHAR(500)` |  |  |  | Đường dẫn ảnh đại diện |
| `icon` | `VARCHAR(80)` |  |  |  | Biểu tượng hiển thị |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `menu_items`

Món ăn trong thực đơn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `category_id` | `UUID` |  |  | x | Mã danh mục |
| `code` | `VARCHAR(80)` |  | x | x | Mã nghiệp vụ |
| `name` | `VARCHAR(180)` |  |  | x | Tên |
| `slug` | `VARCHAR(200)` |  | x | x | Tên định danh dùng trên URL |
| `description` | `TEXT` |  |  |  | Mô tả |
| `short_description` | `VARCHAR(300)` |  |  |  | Mô tả ngắn |
| `base_price_vnd` | `BIGINT` |  |  | x | Số tiền base price, đơn vị VND |
| `cost_price_vnd` | `BIGINT` |  |  |  | Số tiền cost price, đơn vị VND |
| `image_url` | `VARCHAR(500)` |  |  |  | Đường dẫn ảnh đại diện |
| `images` | `JSONB` |  |  |  | Danh sách ảnh dạng JSON |
| `preparation_time_minutes` | `INT` |  |  |  | Thời gian chế biến dự kiến, tính bằng phút |
| `is_available` | `BOOLEAN` |  |  | x | Đang sẵn sàng phục vụ hay không |
| `availability_status` | `VARCHAR(40)` |  |  | x | Trạng thái sẵn sàng phục vụ |
| `is_featured` | `BOOLEAN` |  |  | x | Có phải món nổi bật hay không |
| `is_spicy` | `BOOLEAN` |  |  | x | Món có vị cay hay không |
| `tags` | `JSONB` |  |  |  | Danh sách nhãn dạng JSON |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `available_from` | `TIME` |  |  |  | Giờ bắt đầu phục vụ |
| `available_to` | `TIME` |  |  |  | Giờ kết thúc phục vụ |
| `stock_quantity` | `INT` |  |  |  | Số lượng tồn kho |
| `station` | `VARCHAR(30)` |  |  |  | Trạm chế biến |
| `status` | `VARCHAR(30)` |  |  | x | Trạng thái |
| `created_by` | `UUID` |  |  |  | Mã người dùng thực hiện tạo |
| `updated_by` | `UUID` |  |  |  | Mã người dùng thực hiện cập nhật |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `menu_item_variants`

Biến thể của món ăn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `menu_item_id` | `UUID` |  | x | x | Mã món ăn |
| `name` | `VARCHAR(120)` |  |  | x | Tên |
| `sku` | `VARCHAR(80)` |  | x |  | Mã SKU của biến thể |
| `unit` | `VARCHAR(50)` |  |  |  | Đơn vị tính |
| `price_vnd` | `BIGINT` |  |  | x | Số tiền price, đơn vị VND |
| `cost_price_vnd` | `BIGINT` |  |  |  | Số tiền cost price, đơn vị VND |
| `is_default` | `BOOLEAN` |  |  | x | Có phải lựa chọn mặc định hay không |
| `is_available` | `BOOLEAN` |  |  | x | Đang sẵn sàng phục vụ hay không |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `option_groups`

Nhóm tùy chọn của món.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `name` | `VARCHAR(120)` |  |  | x | Tên |
| `description` | `TEXT` |  |  |  | Mô tả |
| `selection_type` | `VARCHAR(30)` |  |  | x | Kiểu lựa chọn một hoặc nhiều |
| `is_required` | `BOOLEAN` |  |  | x | Có bắt buộc lựa chọn hay không |
| `min_selections` | `INT` |  |  | x | Số lựa chọn tối thiểu |
| `max_selections` | `INT` |  |  |  | Số lựa chọn tối đa |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `options`

Tùy chọn thuộc một nhóm.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `option_group_id` | `UUID` |  |  | x | Mã nhóm tùy chọn |
| `name` | `VARCHAR(120)` |  |  | x | Tên |
| `price_delta_vnd` | `BIGINT` |  |  | x | Số tiền price delta, đơn vị VND |
| `is_default` | `BOOLEAN` |  |  | x | Có phải lựa chọn mặc định hay không |
| `is_available` | `BOOLEAN` |  |  | x | Đang sẵn sàng phục vụ hay không |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `menu_item_option_groups`

Liên kết món ăn với nhóm tùy chọn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `restaurant_id` | `UUID` | x |  | x | Mã nhà hàng |
| `menu_item_id` | `UUID` | x |  | x | Mã món ăn |
| `option_group_id` | `UUID` | x |  | x | Mã nhóm tùy chọn |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `is_required_override` | `BOOLEAN` |  |  |  | Giá trị ghi đè quy tắc bắt buộc của nhóm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `dining_sessions`

Phiên ăn của khách.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `table_id` | `UUID` |  | x | x | Mã bàn |
| `qr_code_id` | `UUID` |  |  |  | Mã mã QR |
| `session_code` | `VARCHAR(80)` |  | x | x | Mã phiên ăn |
| `session_token` | `VARCHAR(255)` |  | x |  | Token truy cập phiên ăn |
| `merge_group_id` | `UUID` |  |  |  | Mã nhóm gộp |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `customer_count` | `INT` |  |  |  | Số lượng khách |
| `customer_name` | `VARCHAR(150)` |  |  |  | Tên khách hàng |
| `customer_phone` | `VARCHAR(30)` |  |  |  | Số điện thoại khách hàng |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `opened_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm mở phiên |
| `closed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm đóng phiên |
| `opened_by` | `UUID` |  |  |  | Mã người dùng thực hiện mở phiên |
| `closed_by` | `UUID` |  |  |  | Mã người dùng thực hiện đóng phiên |
| `opened_via` | `VARCHAR(30)` |  |  | x | Kênh mở phiên |
| `waiter_called_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm khách gọi nhân viên |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `orders`

Đơn gọi món.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `dining_session_id` | `UUID` |  |  | x | Mã phiên ăn |
| `order_number` | `VARCHAR(80)` |  | x | x | Số đơn hàng |
| `order_type` | `VARCHAR(30)` |  |  | x | Loại đơn hàng |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `placed_by` | `VARCHAR(30)` |  |  | x | Loại chủ thể đặt món |
| `placed_by_user_id` | `UUID` |  |  |  | Mã người dùng nội bộ đặt món |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `customer_name` | `VARCHAR(150)` |  |  |  | Tên khách hàng |
| `customer_phone` | `VARCHAR(30)` |  |  |  | Số điện thoại khách hàng |
| `pickup_time` | `TIMESTAMPTZ` |  |  |  | Thời gian dự kiến nhận món mang về |
| `submitted_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm gửi đơn |
| `cancelled_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm hủy |
| `cancelled_by` | `UUID` |  |  |  | Mã người dùng thực hiện hủy |
| `cancelled_reason` | `VARCHAR(255)` |  |  |  | Lý do hủy |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `order_items`

Món cụ thể trong đơn hàng.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `order_id` | `UUID` |  |  | x | Mã đơn hàng |
| `dining_session_id` | `UUID` |  |  | x | Mã phiên ăn |
| `menu_item_id` | `UUID` |  |  |  | Mã món ăn |
| `menu_item_variant_id` | `UUID` |  |  |  | Mã biến thể món |
| `item_name_snapshot` | `VARCHAR(180)` |  |  | x | Tên món tại thời điểm đặt |
| `item_code_snapshot` | `VARCHAR(80)` |  |  |  | Mã món tại thời điểm đặt |
| `variant_name_snapshot` | `VARCHAR(120)` |  |  |  | Tên biến thể tại thời điểm đặt |
| `unit_price_vnd` | `BIGINT` |  |  | x | Số tiền unit price, đơn vị VND |
| `quantity` | `INT` |  |  | x | Số lượng |
| `options_total_vnd` | `BIGINT` |  |  | x | Số tiền options total, đơn vị VND |
| `subtotal_vnd` | `BIGINT` |  |  | x | Số tiền subtotal, đơn vị VND |
| `discount_amount_vnd` | `BIGINT` |  |  | x | Số tiền discount amount, đơn vị VND |
| `total_amount_vnd` | `BIGINT` |  |  | x | Số tiền total amount, đơn vị VND |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `station` | `VARCHAR(30)` |  |  |  | Trạm chế biến |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `is_takeaway` | `BOOLEAN` |  |  | x | Món có phải mang về hay không |
| `unavailable_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm được đánh dấu không sẵn sàng |
| `unavailable_reason` | `VARCHAR(255)` |  |  |  | Lý do không sẵn sàng |
| `cancelled_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm hủy |
| `cancelled_by` | `UUID` |  |  |  | Mã người dùng thực hiện hủy |
| `cancelled_reason` | `VARCHAR(255)` |  |  |  | Lý do hủy |
| `served_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm phục vụ món |
| `served_by` | `UUID` |  |  |  | Mã người dùng thực hiện phục vụ |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `order_item_options`

Tùy chọn đã chọn của món trong đơn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `order_item_id` | `UUID` |  |  | x | Mã món trong đơn |
| `option_id` | `UUID` |  |  |  | Mã tùy chọn |
| `option_group_id` | `UUID` |  |  |  | Mã nhóm tùy chọn |
| `option_name_snapshot` | `VARCHAR(120)` |  |  | x | Tên tùy chọn tại thời điểm đặt |
| `option_group_name_snapshot` | `VARCHAR(120)` |  |  | x | Tên nhóm tùy chọn tại thời điểm đặt |
| `price_delta_snapshot_vnd` | `BIGINT` |  |  | x | Phần chênh lệch giá tùy chọn tại thời điểm đặt, đơn vị VND |
| `quantity` | `INT` |  |  | x | Số lượng |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `order_item_status_history`

Lịch sử thay đổi trạng thái món.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `order_item_id` | `UUID` |  |  | x | Mã món trong đơn |
| `from_status` | `VARCHAR(40)` |  |  |  | Trạng thái trước khi thay đổi |
| `to_status` | `VARCHAR(40)` |  |  | x | Trạng thái sau khi thay đổi |
| `changed_by` | `UUID` |  |  |  | Mã người dùng thực hiện changed |
| `changed_by_role` | `VARCHAR(80)` |  |  |  | Vai trò của người thay đổi |
| `reason` | `VARCHAR(255)` |  |  |  | Reason |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `changed_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm thay đổi trạng thái |

## `cancel_requests`

Yêu cầu hủy món.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `order_item_id` | `UUID` |  |  | x | Mã món trong đơn |
| `requested_by` | `VARCHAR(30)` |  |  | x | Mã người dùng thực hiện gửi yêu cầu |
| `reason` | `VARCHAR(255)` |  |  |  | Reason |
| `status` | `VARCHAR(30)` |  |  | x | Trạng thái |
| `reviewed_by` | `UUID` |  |  |  | Mã người dùng thực hiện xét duyệt |
| `reviewed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xét duyệt |
| `review_note` | `TEXT` |  |  |  | Ghi chú xét duyệt |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `kitchen_tickets`

Phiếu gửi bếp theo trạm chế biến.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `order_id` | `UUID` |  |  | x | Mã đơn hàng |
| `dining_session_id` | `UUID` |  |  | x | Mã phiên ăn |
| `table_id` | `UUID` |  |  | x | Mã bàn |
| `ticket_number` | `VARCHAR(80)` |  | x | x | Số phiếu bếp |
| `station` | `VARCHAR(30)` |  |  | x | Trạm chế biến |
| `priority` | `VARCHAR(30)` |  |  | x | Mức độ ưu tiên |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `acknowledged_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm bếp xác nhận |
| `started_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm bắt đầu chế biến |
| `completed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm hoàn thành |
| `acknowledged_by` | `UUID` |  |  |  | Mã người dùng thực hiện xác nhận |
| `printed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm in phiếu |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `kitchen_ticket_items`

Món thuộc phiếu bếp.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `kitchen_ticket_id` | `UUID` |  |  | x | Mã phiếu bếp |
| `order_item_id` | `UUID` |  |  | x | Mã món trong đơn |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `started_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm bắt đầu chế biến |
| `ready_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm món sẵn sàng |
| `prepared_by` | `UUID` |  |  |  | Mã người dùng thực hiện chế biến |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `invoices`

Hóa đơn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `dining_session_id` | `UUID` |  |  | x | Mã phiên ăn |
| `order_id` | `UUID` |  |  |  | Mã đơn hàng |
| `invoice_number` | `VARCHAR(80)` |  | x | x | Số hóa đơn |
| `invoice_type` | `VARCHAR(30)` |  |  | x | Loại hóa đơn |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `subtotal_vnd` | `BIGINT` |  |  | x | Số tiền subtotal, đơn vị VND |
| `discount_amount_vnd` | `BIGINT` |  |  | x | Số tiền discount amount, đơn vị VND |
| `discount_reason` | `VARCHAR(255)` |  |  |  | Lý do discount |
| `service_charge_basis_points` | `INT` |  |  | x | Tỷ lệ phí phục vụ theo basis point |
| `service_charge_amount_vnd` | `BIGINT` |  |  | x | Số tiền service charge amount, đơn vị VND |
| `vat_basis_points` | `INT` |  |  | x | Thuế suất VAT chụp tại thời điểm lập hóa đơn |
| `vat_amount_vnd` | `BIGINT` |  |  | x | Số tiền vat amount, đơn vị VND |
| `rounding_amount_vnd` | `BIGINT` |  |  | x | Số tiền rounding amount, đơn vị VND |
| `total_amount_vnd` | `BIGINT` |  |  | x | Số tiền total amount, đơn vị VND |
| `paid_amount_vnd` | `BIGINT` |  |  | x | Số tiền paid amount, đơn vị VND |
| `change_amount_vnd` | `BIGINT` |  |  | x | Số tiền change amount, đơn vị VND |
| `customer_info` | `JSONB` |  |  |  | Thông tin khách hàng dạng JSON |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `issued_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm phát hành hóa đơn |
| `issued_by` | `UUID` |  |  |  | Mã người dùng thực hiện phát hành |
| `paid_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm thanh toán đủ |
| `voided_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm hủy hiệu lực hóa đơn |
| `voided_by` | `UUID` |  |  |  | Mã người dùng thực hiện hủy hiệu lực |
| `voided_reason` | `VARCHAR(255)` |  |  |  | Lý do hủy hiệu lực |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `invoice_items`

Dòng chi tiết trên hóa đơn.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `invoice_id` | `UUID` |  |  | x | Mã hóa đơn |
| `order_item_id` | `UUID` |  |  |  | Mã món trong đơn |
| `item_type` | `VARCHAR(40)` |  |  | x | Loại dòng hóa đơn |
| `name_snapshot` | `VARCHAR(180)` |  |  | x | Tên dòng tại thời điểm lập hóa đơn |
| `description` | `TEXT` |  |  |  | Mô tả |
| `unit_price_vnd` | `BIGINT` |  |  | x | Số tiền unit price, đơn vị VND |
| `quantity` | `INT` |  |  | x | Số lượng |
| `subtotal_vnd` | `BIGINT` |  |  | x | Số tiền subtotal, đơn vị VND |
| `discount_amount_vnd` | `BIGINT` |  |  | x | Số tiền discount amount, đơn vị VND |
| `total_amount_vnd` | `BIGINT` |  |  | x | Số tiền total amount, đơn vị VND |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `payment_methods`

Phương thức thanh toán.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `code` | `VARCHAR(50)` |  | x | x | Mã nghiệp vụ |
| `name` | `VARCHAR(100)` |  |  | x | Tên |
| `type` | `VARCHAR(40)` |  |  | x | Loại |
| `icon` | `VARCHAR(100)` |  |  |  | Biểu tượng hiển thị |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `requires_reference` | `BOOLEAN` |  |  | x | Có bắt buộc mã tham chiếu hay không |
| `config` | `JSONB` |  |  |  | Cấu hình dạng JSON |
| `display_order` | `INT` |  |  | x | Thứ tự hiển thị |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `payments`

Giao dịch thanh toán.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `invoice_id` | `UUID` |  |  | x | Mã hóa đơn |
| `dining_session_id` | `UUID` |  |  | x | Mã phiên ăn |
| `order_id` | `UUID` |  |  |  | Mã đơn hàng |
| `payment_number` | `VARCHAR(80)` |  | x | x | Số giao dịch thanh toán |
| `payment_method_id` | `UUID` |  |  | x | Mã phương thức thanh toán |
| `amount_vnd` | `BIGINT` |  |  | x | Số tiền amount, đơn vị VND |
| `status` | `VARCHAR(40)` |  |  | x | Trạng thái |
| `gateway_transaction_id` | `VARCHAR(150)` |  | x |  | Mã giao dịch tại cổng thanh toán |
| `transaction_data` | `JSONB` |  |  |  | Dữ liệu giao dịch dạng JSON |
| `reference_code` | `VARCHAR(150)` |  |  |  | Mã tham chiếu |
| `received_amount_vnd` | `BIGINT` |  |  |  | Số tiền received amount, đơn vị VND |
| `change_amount_vnd` | `BIGINT` |  |  | x | Số tiền change amount, đơn vị VND |
| `processed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xử lý |
| `processed_by` | `UUID` |  |  |  | Mã người dùng thực hiện xử lý |
| `refunded_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm hoàn tiền |
| `refunded_by` | `UUID` |  |  |  | Mã người dùng thực hiện hoàn tiền |
| `refunded_reason` | `VARCHAR(255)` |  |  |  | Lý do hoàn tiền |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `payment_webhook_events`

Sự kiện webhook từ cổng thanh toán.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `provider` | `VARCHAR(80)` |  | x | x | Nhà cung cấp cổng thanh toán |
| `event_id` | `VARCHAR(150)` |  | x | x | Mã sự kiện từ nhà cung cấp |
| `payment_id` | `UUID` |  |  |  | Mã giao dịch thanh toán |
| `payload` | `JSONB` |  |  | x | Nội dung webhook dạng JSON |
| `processed_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xử lý |
| `processing_error` | `TEXT` |  |  |  | Lỗi phát sinh khi xử lý |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `discounts`

Mã giảm giá hoặc chương trình khuyến mãi.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `code` | `VARCHAR(80)` |  | x | x | Mã nghiệp vụ |
| `name` | `VARCHAR(150)` |  |  | x | Tên |
| `description` | `TEXT` |  |  |  | Mô tả |
| `type` | `VARCHAR(40)` |  |  | x | Loại |
| `value_vnd` | `BIGINT` |  |  |  | Số tiền value, đơn vị VND |
| `percent_basis_points` | `INT` |  |  |  | Tỷ lệ phần trăm theo basis point |
| `min_order_amount_vnd` | `BIGINT` |  |  | x | Số tiền min order amount, đơn vị VND |
| `max_discount_amount_vnd` | `BIGINT` |  |  |  | Số tiền max discount amount, đơn vị VND |
| `applies_to` | `VARCHAR(40)` |  |  | x | Phạm vi áp dụng |
| `target_ids` | `JSONB` |  |  |  | Danh sách mã đối tượng áp dụng dạng JSON |
| `usage_limit` | `INT` |  |  |  | Giới hạn tổng số lần sử dụng |
| `usage_limit_per_session` | `INT` |  |  |  | Giới hạn số lần dùng trong một phiên |
| `used_count` | `INT` |  |  | x | Số lần đã sử dụng |
| `valid_from` | `TIMESTAMPTZ` |  |  |  | Thời điểm bắt đầu hiệu lực |
| `valid_to` | `TIMESTAMPTZ` |  |  |  | Thời điểm hết hiệu lực |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `created_by` | `UUID` |  |  |  | Mã người dùng thực hiện tạo |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `audit_logs`

Nhật ký thao tác hệ thống.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `user_id` | `UUID` |  |  |  | Mã người dùng |
| `actor_type` | `VARCHAR(30)` |  |  | x | Loại chủ thể thực hiện |
| `action` | `VARCHAR(100)` |  |  | x | Hành động |
| `entity_type` | `VARCHAR(80)` |  |  | x | Loại đối tượng bị tác động |
| `entity_id` | `UUID` |  |  |  | Mã đối tượng |
| `old_values` | `JSONB` |  |  |  | Dữ liệu cũ dạng JSON |
| `new_values` | `JSONB` |  |  |  | Dữ liệu mới dạng JSON |
| `metadata` | `JSONB` |  |  |  | Dữ liệu bổ sung dạng JSON |
| `ip_address` | `VARCHAR(80)` |  |  |  | Địa chỉ IP |
| `user_agent` | `TEXT` |  |  |  | Thông tin trình duyệt hoặc ứng dụng |
| `trace_id` | `VARCHAR(100)` |  |  |  | Mã truy vết yêu cầu |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |

## `system_settings`

Cấu hình hệ thống theo nhà hàng.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  | x | x | Mã nhà hàng |
| `key` | `VARCHAR(120)` |  | x | x | Khóa cấu hình |
| `value` | `JSONB` |  |  | x | Giá trị cấu hình |
| `value_type` | `VARCHAR(40)` |  |  | x | Kiểu dữ liệu của giá trị |
| `category` | `VARCHAR(80)` |  |  |  | Nhóm cấu hình |
| `description` | `TEXT` |  |  |  | Mô tả |
| `is_editable` | `BOOLEAN` |  |  | x | Cho phép chỉnh sửa hay không |
| `updated_by` | `UUID` |  |  |  | Mã người dùng thực hiện cập nhật |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |

## `table_merge_groups`

Nhóm các bàn hoặc phiên ăn được gộp.

| Thuộc tính | Kiểu | K | U | M | Diễn giải |
|---|---|:---:|:---:|:---:|---|
| `id` | `UUID` | x |  | x | Mã định danh |
| `restaurant_id` | `UUID` |  |  | x | Mã nhà hàng |
| `merged_by` | `UUID` |  |  |  | Mã người dùng thực hiện gộp |
| `note` | `TEXT` |  |  |  | Ghi chú |
| `is_active` | `BOOLEAN` |  |  | x | Đang hoạt động hay không |
| `deleted_at` | `TIMESTAMPTZ` |  |  |  | Thời điểm xóa mềm |
| `created_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` |  |  | x | Thời điểm cập nhật gần nhất |
