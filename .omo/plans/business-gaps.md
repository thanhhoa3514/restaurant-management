# Business Gaps — Real-World Cases Not Yet Handled

> Trang này ghi lại tất cả các nghiệp vụ thực tế mà hệ thống chưa cover.
> Sẽ xử lý lần lượt theo thứ tự ưu tiên.

---

## Priority 1: 🟥 Cốt lõi — không thể thiếu trong nhà hàng thật

### 1. Chia hóa đơn (Split bill)
- **Vấn đề**: Nhóm khách (4-5 người) muốn chia tiền mỗi người trả phần món của mình. Hiện tại chỉ có "pay combined total" — 1 hóa đơn / 1 session.
- **Yêu cầu**: Cho phép cashier chọn từng món trong hóa đơn để tách thành các hóa đơn con. Mỗi hóa đơn con thanh toán riêng.
- **Phân loại**: Backend + Frontend (cashier)

### 2. Thanh toán hỗn hợp (Partial payment / multi-method)
- **Vấn đề**: 1 hóa đơn 700k, khách trả 200k tiền mặt + 500k quẹt thẻ. `ProcessPayment` hiện tại chỉ nhận 1 method duy nhất.
- **Yêu cầu**: Cho phép 1 invoice thanh toán bằng nhiều payment method, ghi nhận từng phần.
- **Phân loại**: Backend (billing) + Frontend (cashier)

### 3. Gộp bàn / Tách bàn (Merge / split tables)
- **Vấn đề**: 2 bàn nhỏ ghép lại cho nhóm 8 người. Họ muốn 1 hóa đơn cuối cùng. Hoặc ngược lại: 1 bàn lớn muốn tách ra 2 hóa đơn riêng.
- **Yêu cầu**: Merge dining sessions → 1 invoice. Split session items → 2+ invoices.
- **Ghi chú**: Đã có bàn luận trước đó, chưa implement.
- **Phân loại**: Backend (dining + billing) + Frontend (waiter/cashier)

### 4. In phiếu bếp & in hóa đơn (Kitchen receipt & invoice printing)
- **Vấn đề**: Kitchen queue chỉ hiển thị trên màn hình. Bếp VN thường cần phiếu in giấy để đứng chế biến. Cashier cần in hóa đơn cho khách.
- **Yêu cầu**: API trả dữ liệu đã format sẵn cho máy in nhiệt (ESC/POS). Hoặc xuất PDF invoice.
- **Ghi chú**: Frontend có PDF invoice qua `@react-pdf/renderer` — có thể tận dụng. Cần backend API trả dữ liệu in.
- **Phân loại**: Backend (format + print API) + Frontend (in từ thiết bị)

### 5. Đặt mang về (Takeaway / to-go)
- **Vấn đề**: Hệ thống hiện tại gắn chặt với dining session (QR bàn). Khách muốn mua mang về không có session → không order được.
- **Yêu cầu**: Luồng takeaway: không cần QR bàn, không cần session. Guest chọn món → đặt → nhận số thứ tự → thanh toán → nhận món.
- **Phân loại**: Backend (ordering) + Frontend (takeaway flow mới)

---

## Priority 2: 🟧 Vận hành — cần thiết cho nhà hàng ổn định

### 6. Phí dịch vụ (Service charge)
- **Vấn đề**: Nhiều nhà hàng VN thu thêm 5-10% phí dịch vụ trên tổng hóa đơn (riêng với VAT). Hiện tại chỉ có VAT 10% hardcode trong i18n frontend, backend không có khái niệm service charge.
- **Yêu cầu**: Thêm service charge % configurable trên invoice. Tách biệt giữa service charge và VAT.
- **Phân loại**: Backend (billing) + Frontend (cashier + guest invoice)

### 7. Hoàn tiền / Refund sau thanh toán
- **Vấn đề**: `VoidInvoice` chỉ hoạt động pre-payment. Nếu invoice đã paid (vd: e-wallet) mà cần hủy → không có cách.
- **Yêu cầu**: Refund flow: ghi nhận giao dịch hoàn tiền, reverse payment nếu là e-wallet (webhook), cập nhật trạng thái invoice → REFUNDED.
- **Phân loại**: Backend (billing, gateway)

### 8. Combo / Set món
- **Vấn đề**: Menu chỉ hỗ trợ món lẻ + option group. Không có combo giá gộp kiểu "Lẩu Thái + đĩa thịt bò + rau + nước ngọt = 299k".
- **Yêu cầu**: Thêm concept "combo" trong catalog: 1 combo = nhiều menu items đi kèm, giá riêng, có thể giới hạn số lượng.
- **Phân loại**: Backend (catalog) + Frontend (menu)

### 9. Khuyến mãi / Coupon / Auto discount
- **Vấn đề**: Discount hiện tại là thủ công qua `AdjustInvoice` — cashier tự nhập số tiền. Không có mã giảm giá, khuyến mãi theo giờ, hoặc giảm % tự động.
- **Yêu cầu**: Coupon codes, promotion rules (theo giờ, theo món, theo tổng hóa đơn), áp dụng tự động khi build invoice.
- **Phân loại**: Backend (billing + catalog) + Frontend (cashier)

### 10. Sơ đồ bàn trực quan (Table floor plan)
- **Vấn đề**: Waiter có danh sách bàn dạng text. Không có sơ đồ mặt bằng trực quan — bàn nào occupied / free / cleaning / reserved.
- **Yêu cầu**: UI dạng grid / map với trạng thái bàn, cho phép waiter chọn bàn nhanh, xem session info.
- **Phân loại**: Frontend (waiter)

---

## Priority 3: 🟨 Tiện ích mở rộng

### 11. Lịch sử gọi món / Gọi lại món cũ
- **Vấn đề**: Khách quay lại lần sau không xem được lịch sử lần trước đã gọi gì. Không có tính năng "gọi lại món cũ".
- **Yêu cầu**: Lưu lịch sử session theo guest (nếu có thông tin). Cho phép re-order từ order cũ.
- **Phân loại**: Backend (ordering) + Frontend (guest)

### 12. Quản lý tồn kho nguyên liệu
- **Vấn đề**: Out-of-stock hiện tại do staff đánh dấu thủ công trên từng menu item hoặc order item. Không có kho nguyên liệu → không biết món nào hết cho đến khi khách gọi.
- **Yêu cầu**: Inventory module: nguyên liệu → tồn kho → mapping với menu items → auto set unavailable khi hết nguyên liệu.
- **Phân loại**: Backend (module mới: inventory) + Frontend (admin)

### 13. Báo cáo doanh thu (Dashboard)
- **Vấn đề**: Không có số liệu: doanh thu hôm nay, món bán chạy, khung giờ cao điểm, session trung bình.
- **Yêu cầu**: Dashboard với biểu đồ, thống kê theo ngày/tuần/tháng, top items, payment method distribution.
- **Phân loại**: Backend (module mới: reports) + Frontend (admin)

### 14. Đặt bàn trước (Reservation)
- **Vấn đề**: Tất cả khách đều walk-in + QR. Không có đặt bàn trước. Nhà hàng không biết hôm nay có bao nhiêu khách đã đặt.
- **Yêu cầu**: Reservation module: đặt bàn theo khung giờ, xác nhận, check-in, tích hợp với dining.
- **Phân loại**: Backend (module mới: reservation) + Frontend (guest + admin)

### 15. Gửi hóa đơn điện tử (E-invoice / Email / Zalo)
- **Vấn đề**: Khách không nhận được hóa đơn sau khi thanh toán. Chỉ có bản in (nếu có) hoặc PDF tải trên màn hình.
- **Yêu cầu**: Gửi hóa đơn qua email hoặc Zalo cho khách. Export PDF invoice.
- **Ghi chú**: Frontend đã có PDF rendering (guest invoice screen). Cần backend để send.
- **Phân loại**: Backend (notification) + Frontend (PDF)

---

## Legend

| Priority | Ý nghĩa |
|---|---|
| 🟥 Cốt lõi | Blocking — nhà hàng không thể vận hành thiếu |
| 🟧 Vận hành | Important — cần có để vận hành mượt |
| 🟨 Tiện ích | Nice-to-have — mở rộng, tăng trải nghiệm |
