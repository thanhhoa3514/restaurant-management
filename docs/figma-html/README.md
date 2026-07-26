# HTML bàn giao cho Figma

Hai tệp trong thư mục này là bản dựng HTML độc lập, bám theo giao diện hiện tại của
`AdminShell`, KDS và POS trong frontend:

- `kitchen-view.html`: màn hình hàng đợi bếp, trạng thái có dữ liệu.
- `cashier-view.html`: màn hình thu ngân với danh sách phiên ở nền và hộp chi tiết
  hóa đơn/thanh toán đang mở.

## Cách import

1. Mở tệp cần lấy bằng trình duyệt.
2. Chọn viewport `1440 × 900` để lấy bản desktop. Hai tệp cũng có bố cục responsive
   cho `320`, `375`, `414` và `768` px.
3. Dùng plugin Figma hỗ trợ nhập HTML/web page (ví dụ plugin nhận URL hoặc HTML).
   Nếu plugin chỉ nhận URL, chạy một static server trong thư mục này:

   ```bash
   python3 -m http.server 4173 --directory docs/figma-html
   ```

   Sau đó nhập:
   - `http://localhost:4173/kitchen-view.html`
   - `http://localhost:4173/cashier-view.html`

## Ghi chú

- CSS, icon SVG và nội dung mẫu đều nằm trong từng tệp; không cần build frontend.
- Dữ liệu món dùng tên và giá từ seed hiện tại của dự án. Số bàn, thời gian, mã hóa
  đơn và trạng thái chỉ là dữ liệu minh họa để dựng đủ các trạng thái giao diện.
- Tệp thu ngân mở sẵn chi tiết Bàn 12. Nút đóng sẽ trả về danh sách phiên; bấm một
  thẻ bàn sẽ mở lại chi tiết.
- Đây là bản snapshot phục vụ thiết kế, không gọi API và không thay đổi source
  production.
