# HTML bàn giao cho Figma

Các tệp trong thư mục này là bản dựng HTML độc lập, bám theo giao diện hiện tại của
`AdminShell`, KDS, POS và luồng gọi món của khách trong frontend.

### Màn quản trị / vận hành (desktop, `1440 × 900`)

- `kitchen-view.html`: màn hình hàng đợi bếp, trạng thái có dữ liệu.
- `cashier-view.html`: màn hình thu ngân với danh sách phiên ở nền và hộp chi tiết
  hóa đơn/thanh toán đang mở.
- `admin-view.html`: màn quản trị (AdminShell) — sidebar đầy đủ 2 nhóm
  Quản lý/Vận hành, topbar, và nội dung Tổng quan (thẻ chỉ số, bảng ca trực,
  lệnh nhanh).
- `table-qrs-view.html`: màn Quản lý bàn — thanh công cụ Lưới/Sơ đồ, các nhóm khu
  vực với thẻ bàn (mã QR xanh/xám), và sheet chi tiết bàn (QR, link gọi món,
  chép/tải/xoay mã) mở sẵn.
- `sessions-view.html`: màn Nhật ký phiên ăn — thanh lọc theo ngày, 4 thẻ KPI,
  tab trạng thái + tìm kiếm, bảng dữ liệu phiên, và modal chi tiết phiên (món đã
  gọi theo đợt, hóa đơn, tổng tiền) mở sẵn.
- `invoices-view.html`: màn Hóa đơn đã thu — bộ lọc đối soát (tìm kiếm, từ/đến
  ngày, phương thức), dải 4 chỉ số (Hóa đơn/Doanh thu/Giảm giá/Trung bình), sổ hóa
  đơn (bảng: mã hóa đơn + số món, bàn/phiên, khách hàng, phương thức, tổng tiền,
  thời điểm thanh toán) + phân trang, và sheet chi tiết bên phải (mã + badge "Đã
  thanh toán", thông tin phiên/khách, món đã tính tiền, thanh toán, tổng cộng)
  mở sẵn.
- `catalog-view.html`: màn Quản lý thực đơn — rail danh mục bên trái, lưới thẻ món
  (ảnh/nổi bật, giá, badge trạng thái xuất bản/bán, nút Sửa/Tạm ngưng/Xóa).
- `staff-view.html`: màn Nhân viên — bảng tài khoản (vai trò, badge trạng thái
  hoạt động/khóa/ngưng, thao tác sửa/đặt lại mật khẩu/khóa) và sheet sửa nhân viên
  mở sẵn bên phải.

### Màn khách gọi món (mobile, khung điện thoại `~390px`)

- `menu-view.html`: màn thực đơn của khách — header kính (logo, pill Bàn, dịch
  vụ/lịch sử/giỏ hàng), ô tìm món, thanh danh mục cuộn ngang, lưới thẻ món (giá,
  nút thêm nhanh / xem chi tiết, badge số lượng trong giỏ).
- `item-detail-view.html`: màn chi tiết món — ảnh lớn + dải thumbnail, thẻ thông
  tin & đơn giá, chọn kích cỡ/biến thể (Bắt buộc), nhóm tùy chọn (độ cay + topping
  cộng giá), bộ đếm số lượng & ghi chú, thanh "Thêm vào giỏ" cố định dưới.
- `order-status-view.html`: màn trạng thái đơn của khách — header + badge số lượt
  gọi, các đợt gọi ("Gọi lúc …") với hàng món (ảnh + số lượng, tên + biến thể,
  badge trạng thái Chờ duyệt/Đã xác nhận/Đang chuẩn bị/Sẵn sàng/Đã phục vụ,
  món hết nguyên liệu gạch ngang + "Chọn món khác"), nút sửa món đang chờ duyệt,
  và thanh cố định "Đặt thêm món" + "Thanh toán". **Không hiển thị giá** (quy tắc
  nghiệp vụ).
- `join-pending-view.html`: màn chờ duyệt vào phiên — thương hiệu, thẻ trạng thái
  với hiệu ứng chờ (vòng lan tỏa + cung xoay), badge "Đang chờ duyệt", thông báo
  "Đang chờ phục vụ xác nhận…" + gợi ý, ba chấm nhấp nháy, nút "Vui lòng chờ..."
  bị vô hiệu.
- `cart-view.html`: màn giỏ hàng — bottom sheet trên nền thực đơn mờ, banner "đã
  gửi món trước đó", các dòng món (ảnh, tên + biến thể/tùy chọn, ghi chú, giá, bộ
  đếm số lượng, nút xóa), chân cố định "Tạm tính" + tổng xanh + nút "Đặt món".
- `payment-view.html`: màn thanh toán QR (SePay) — header giữa, thẻ chứa mã QR,
  số tiền lớn, nhãn "Nội dung chuyển khoản" + chip mã mono kèm nút chép, gợi ý,
  pill "Đang chờ giao dịch", chân "Không đóng trang trong lúc chờ thanh toán".

Màn khách là **light-only** (guest UI luôn sáng), bố cục mobile-first, đóng khung
`max-width: 28rem` căn giữa như production (`sm:max-w-md sm:mx-auto sm:border-x`).

## Cách import

1. Mở tệp cần lấy bằng trình duyệt.
2. Màn quản trị: chọn viewport `1440 × 900` cho bản desktop (cũng responsive ở
   `320/375/414/768` px). Màn khách: chọn khung điện thoại `390 × 844` (iPhone).
3. Dùng plugin Figma hỗ trợ nhập HTML/web page (ví dụ plugin nhận URL hoặc HTML).
   Nếu plugin chỉ nhận URL, chạy một static server trong thư mục này:

   ```bash
   python3 -m http.server 4173 --directory docs/figma-html
   ```

   Sau đó nhập:
   - `http://localhost:4173/kitchen-view.html`
   - `http://localhost:4173/cashier-view.html`
   - `http://localhost:4173/admin-view.html`
   - `http://localhost:4173/table-qrs-view.html`
   - `http://localhost:4173/sessions-view.html`
   - `http://localhost:4173/invoices-view.html`
   - `http://localhost:4173/catalog-view.html`
   - `http://localhost:4173/staff-view.html`
   - `http://localhost:4173/menu-view.html`
   - `http://localhost:4173/item-detail-view.html`
   - `http://localhost:4173/order-status-view.html`
   - `http://localhost:4173/join-pending-view.html`
   - `http://localhost:4173/cart-view.html`
   - `http://localhost:4173/payment-view.html`

## Ghi chú

- CSS, icon SVG và nội dung mẫu đều nằm trong từng tệp; không cần build frontend.
- Dữ liệu món dùng tên và giá từ seed hiện tại của dự án. Số bàn, thời gian, mã hóa
  đơn và trạng thái chỉ là dữ liệu minh họa để dựng đủ các trạng thái giao diện.
- Tệp thu ngân mở sẵn chi tiết Bàn 12. Nút đóng sẽ trả về danh sách phiên; bấm một
  thẻ bàn sẽ mở lại chi tiết.
- Đây là bản snapshot phục vụ thiết kế, không gọi API và không thay đổi source
  production.
