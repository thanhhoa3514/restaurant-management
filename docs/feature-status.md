# Bảng trạng thái tính năng theo vai trò

## Tác nhân (Actor)

| Actor | Vai trò | Loại |
|---|---|---|
| Khách hàng | Người dùng cuối quét QR để gọi món, theo dõi đơn, gọi hỗ trợ. Không cần đăng nhập — mã QR + phiên là thứ xác thực. | Chính |
| Phục vụ | Nhân viên sàn: mở phiên, theo dõi bàn, mang món ra, tiếp nhận tín hiệu của khách. | Chính |
| Bếp | Nhân viên bếp: nhận đơn, cập nhật trạng thái chế biến, xử lý yêu cầu hủy. | Chính |
| Thu ngân | Lập/điều chỉnh hóa đơn, thu tiền, in hóa đơn, đóng phiên. | Chính |
| Quản lý | Quản trị thực đơn, QR, bàn/khu vực, người dùng, xem báo cáo. | Chính |
| Cổng thanh toán | Hệ thống ngoài (Momo/ZaloPay/VNPay) xác nhận giao dịch ví điện tử qua webhook. | Phụ (ngoài) |

---

## Trạng thái tính năng

Đối chiếu trực tiếp với mã nguồn (`backend/internal/modules`, route handler, `frontend/src/features`).

**Chú thích trạng thái**

| Ký hiệu | Nghĩa |
|---|---|
| Done | Hoàn thành (backend + frontend) |
| Partial | Một phần (thiếu backend / chỉ có UI / chưa đủ chức năng) |
| Chưa | Chưa làm |

**Tổng kết:** Done 21 · Partial 7 · Chưa 3.

---

## 1. Khách hàng (Customer)

| # | Tính năng | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|---|
| 1 | Quét QR mở phiên / vào phiên đang mở | Done | `dining/join_session.go` + `open_session.go` |
| 2 | Xem menu (danh mục, tìm kiếm, hết món) | Done | `catalog/list_categories.go`, `list_menu_items.go`; guest menu lọc field |
| 3 | Xem menu — món bán chạy | Chưa | Cần analytics, chưa có |
| 4 | Tùy chọn món (size, mức cay, topping, ghi chú) | Done | Snapshot option trong `guest_place_order.go` |
| 5 | Giỏ hàng (sửa/xóa trước khi đặt) | Done | Client-side frontend ordering |
| 6 | Đặt món | Done | `ordering/guest_place_order.go` |
| 7 | Gọi thêm món | Done | `order_type = ADDITIONAL`, cùng handler |
| 8 | Theo dõi trạng thái món tức thời | Done | `guest_view_orders.go` + realtime hub |
| 9 | Gọi nhân viên | Chưa | Chỉ có label UI i18n, không có route backend |
| 10 | Yêu cầu thanh toán | Partial | Staff `request-bill` có; guest không có route (chỉ tín hiệu) |

## 2. Bếp (Kitchen)

| # | Tính năng | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|---|
| 11 | Nhận ticket realtime | Done | `kitchen GET /queue` + realtime hub |
| 12 | Cập nhật trạng thái món | Done | `kitchen PATCH /items/:id/status` |
| 13 | Xem lịch sử trạng thái món | Partial | Timeline có trong `staff_views` (StatusDTO); chưa có endpoint riêng |

## 3. Phục vụ (Waiter)

| # | Tính năng | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|---|
| 14 | Xem lưới bàn | Done | `staff GET /tables` + frontend waiter grid |
| 15 | Xem sơ đồ bàn (floor-plan) | Partial | Frontend `admin.floor-plan.tsx`; backend chưa |
| 16 | Theo dõi tín hiệu (ready / gọi NV / yêu cầu bill) | Partial | Ready + bill realtime OK; gọi NV chưa có backend |
| 17 | Đánh dấu đã phục vụ (SERVED) | Done | `staff PATCH order-items/:id/status` |
| 18 | Xác nhận gọi nhân viên | Chưa | Phụ thuộc tín hiệu gọi NV — chưa có |
| 19 | Mở phiên cho khách walk-in | Done | `dining/open_session.go` |
| 20 | Yêu cầu thanh toán hộ khách | Done | `staff POST /sessions/:id/request-bill` |
| 21 | Xem chi tiết phiên/đơn theo bàn | Done | `ordering/staff_views.go` |

## 4. Thu ngân (Cashier)

| # | Tính năng | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|---|
| 22 | Xem danh sách phiên chờ thanh toán | Done | Frontend cashier live + phiên AWAITING_PAYMENT |
| 23 | Xem hóa đơn (snapshot giá/tên) | Done | `billing/build_invoice.go` |
| 24 | Áp dụng / hủy giảm giá | Done | `billing/adjust_invoice.go` (+ ghi log) |
| 25 | Thanh toán (tiền mặt / thẻ / ví 2 pha) | Done | `process_payment.go` + `handle_webhook.go` (batch F/G) |
| 26 | In hóa đơn | Partial | Print phía frontend; không có backend riêng |
| 27 | Đóng phiên | Done | `dining/close_session.go` |

## 5. Admin / Manager

| # | Tính năng | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|---|
| 28 | Quản lý menu (CRUD món, danh mục, option) | Done | `catalog` create/update/delete + frontend `admin.catalog` |
| 29 | Quản lý trạng thái món (propagate realtime) | Done | `catalog/toggle_availability.go` |
| 30 | Quản lý QR theo bàn (tạo/in/xoay/vô hiệu) | Done | `dining/manage_table_qr.go` + `list_table_qrs.go` (MANAGER-only) |
| 31 | Quản lý bàn / khu vực | Partial | Frontend `admin.floor-plan.tsx` shell; backend CRUD chưa có |
| 32 | Báo cáo / phân tích (KPI từ status_history) | Partial | Frontend dashboard + `admin.reports.tsx`; backend KPI endpoint chưa có |
| 33 | Quản lý người dùng / phân quyền | Done | `identity/manage_users.go` + `list_staff.go` |

---

## Khoảng trống chính cần hoàn thiện

| Hạng mục | Việc cần làm |
|---|---|
| Gọi nhân viên (9) + Xác nhận gọi NV (18) | Thêm signal endpoint backend + realtime |
| Quản lý bàn / khu vực (31) | Thêm CRUD bàn/khu vực ở backend |
| Báo cáo KPI (32) | Thêm endpoint tổng hợp từ `order_item_status_history` |
| Yêu cầu thanh toán guest (10), In hóa đơn (26), Lịch sử trạng thái (13) | Bổ sung route guest request-bill, in backend, endpoint history |
</content>
