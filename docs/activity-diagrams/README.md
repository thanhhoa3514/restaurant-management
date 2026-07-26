# Sơ đồ hoạt động các use case

Tổng cộng **49 sơ đồ hoạt động**. Mỗi use case có một file Draw.io riêng và tất cả được gom trong file nhiều trang [restaurant-use-cases-activity-diagrams.drawio](./restaurant-use-cases-activity-diagrams.drawio).

Ký hiệu:

- Sơ đồ chỉ dùng đen–trắng; swimlane bên trái là hành động của tác nhân.
- Swimlane Hệ thống: kiểm tra nghiệp vụ, xử lý dữ liệu và phát thông báo realtime.
- Chấm đen: điểm bắt đầu; vòng tròn kép: điểm kết thúc.
- Hình chữ nhật bo tròn: hành động; hình thoi: điều kiện rẽ nhánh (có nhãn guard).
- Mọi luồng điều khiển đều là nét liền theo chuẩn UML.
- Nhánh thay thế hợp lệ quay lại luồng chính; chỉ nhánh lỗi mới kết thúc riêng.

File đã mở và chỉnh tay bằng Draw.io sẽ được script giữ nguyên, không sinh đè.

## Khách hàng

| Mã | Use case | Activity diagram | Đặc tả nguồn |
|---|---|---|---|
| UC-G01 | Quét QR vào phiên | [Mở Draw.io](./activity-uc-g01-quet-qr-vao-phien.drawio) | [Đặc tả](../use-cases/uc-khach-01-quet-qr-vao-phien.md) |
| UC-G02 | Xem thực đơn | [Mở Draw.io](./activity-uc-g02-xem-thuc-don.drawio) | [Đặc tả](../use-cases/uc-khach-02-xem-thuc-don.md) |
| UC-G03 | Đặt món | [Mở Draw.io](./activity-uc-g03-dat-mon.drawio) | [Đặc tả](../use-cases/uc-khach-03-dat-mon.md) |
| UC-G04 | Gọi thêm món | [Mở Draw.io](./activity-uc-g04-goi-them-mon.drawio) | [Đặc tả](../use-cases/uc-khach-04-goi-them-mon.md) |
| UC-G05a | Sửa món đã gọi | [Mở Draw.io](./activity-uc-g05a-sua-mon-da-goi.drawio) | [Đặc tả](../use-cases/uc-khach-05a-sua-mon-da-goi.md) |
| UC-G05b | Hủy món đã gọi | [Mở Draw.io](./activity-uc-g05b-huy-mon-da-goi.drawio) | [Đặc tả](../use-cases/uc-khach-05b-huy-mon-da-goi.md) |
| UC-G06 | Theo dõi trạng thái món tức thời | [Mở Draw.io](./activity-uc-g06-theo-doi-trang-thai-mon.drawio) | [Đặc tả](../use-cases/uc-khach-06-theo-doi-trang-thai-mon.md) |
| UC-G07 | Gọi nhân viên | [Mở Draw.io](./activity-uc-g07-goi-nhan-vien.drawio) | [Đặc tả](../use-cases/uc-khach-07-goi-nhan-vien.md) |
| UC-G08 | Yêu cầu thanh toán | [Mở Draw.io](./activity-uc-g08-yeu-cau-thanh-toan.drawio) | [Đặc tả](../use-cases/uc-khach-08-yeu-cau-thanh-toan.md) |

## Phục vụ

| Mã | Use case | Activity diagram | Đặc tả nguồn |
|---|---|---|---|
| UC-P09 | Mở phiên cho khách vãng lai | [Mở Draw.io](./activity-uc-p09-mo-phien-walk-in.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-09-mo-phien-walk-in.md) |
| UC-P10 | Xem sơ đồ bàn / lưới bàn | [Mở Draw.io](./activity-uc-p10-xem-luoi-ban.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-10-luoi-ban.md) |
| UC-P11 | Theo dõi tín hiệu bàn tức thời | [Mở Draw.io](./activity-uc-p11-theo-doi-tin-hieu-ban.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-11-theo-doi-tin-hieu-ban.md) |
| UC-P12 | Xác nhận gọi nhân viên | [Mở Draw.io](./activity-uc-p12-xac-nhan-goi-nhan-vien.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-12-xac-nhan-goi-nhan-vien.md) |
| UC-P13 | Đánh dấu món đã phục vụ | [Mở Draw.io](./activity-uc-p13-danh-dau-da-phuc-vu.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-13-danh-dau-da-phuc-vu.md) |
| UC-P14 | Yêu cầu thanh toán hộ | [Mở Draw.io](./activity-uc-p14-yeu-cau-thanh-toan-ho.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-14-yeu-cau-thanh-toan-ho.md) |
| UC-P15 | Xem chi tiết phiên/đơn theo bàn | [Mở Draw.io](./activity-uc-p15-chi-tiet-phien-theo-ban.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-15-chi-tiet-phien-theo-ban.md) |
| UC-P32 | Gộp nhiều phiên/bàn | [Mở Draw.io](./activity-uc-p32-gop-phien.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-32-gop-phien.md) |
| UC-P33 | Tách phiên đã gộp | [Mở Draw.io](./activity-uc-p33-tach-phien.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-33-tach-phien.md) |
| UC-P38A | Thêm món mang về vào phiên tại bàn | [Mở Draw.io](./activity-uc-p38a-them-mon-mang-ve-tai-ban.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-38-don-mang-ve.md) |
| UC-P38B | Tạo đơn mang về cho khách vãng lai | [Mở Draw.io](./activity-uc-p38b-don-mang-ve-walk-in.drawio) | [Đặc tả](../use-cases/uc-phuc-vu-38-don-mang-ve.md) |

## Bếp

| Mã | Use case | Activity diagram | Đặc tả nguồn |
|---|---|---|---|
| UC-K16 | Tiếp nhận đơn / xem hàng đợi | [Mở Draw.io](./activity-uc-k16-hang-doi-mon.drawio) | [Đặc tả](../use-cases/uc-bep-16-hang-doi-mon.md) |
| UC-K17 | Cập nhật trạng thái món | [Mở Draw.io](./activity-uc-k17-cap-nhat-trang-thai-mon.drawio) | [Đặc tả](../use-cases/uc-bep-17-cap-nhat-trang-thai-mon.md) |
| UC-K18 | Xử lý yêu cầu hủy món | [Mở Draw.io](./activity-uc-k18-xu-ly-yeu-cau-huy-mon.drawio) | [Đặc tả](../use-cases/uc-bep-18-xu-ly-yeu-cau-huy-mon.md) |
| UC-K19 | Xem lịch sử trạng thái món | [Mở Draw.io](./activity-uc-k19-lich-su-trang-thai-mon.drawio) | [Đặc tả](../use-cases/uc-bep-19-lich-su-trang-thai-mon.md) |
| UC-K39 | Báo món không thể chế biến | [Mở Draw.io](./activity-uc-k39-bao-het-mon.drawio) | [Đặc tả](../use-cases/uc-bep-39-bao-het-mon.md) |

## Thu ngân

| Mã | Use case | Activity diagram | Đặc tả nguồn |
|---|---|---|---|
| UC-C20 | Xem danh sách phiên chờ thanh toán | [Mở Draw.io](./activity-uc-c20-danh-sach-phien-cho-thanh-toan.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-20-danh-sach-phien-cho-thanh-toan.md) |
| UC-C21 | Lập và xem hóa đơn | [Mở Draw.io](./activity-uc-c21-xem-hoa-don.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-21-xem-hoa-don.md) |
| UC-C22 | Điều chỉnh hóa đơn và giảm giá | [Mở Draw.io](./activity-uc-c22-dieu-chinh-hoa-don.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-22-dieu-chinh-hoa-don-giam-gia.md) |
| UC-C23 | Xử lý thanh toán toàn bộ | [Mở Draw.io](./activity-uc-c23-xu-ly-thanh-toan.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-23-xu-ly-thanh-toan.md) |
| UC-C24 | In hóa đơn | [Mở Draw.io](./activity-uc-c24-in-hoa-don.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-24-in-hoa-don.md) |
| UC-C25 | Đóng phiên | [Mở Draw.io](./activity-uc-c25-dong-phien.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-25-dong-phien.md) |
| UC-C34 | Tách hóa đơn | [Mở Draw.io](./activity-uc-c34-tach-hoa-don.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-34-tach-hoa-don.md) |
| UC-C35 | Thanh toán một phần | [Mở Draw.io](./activity-uc-c35-thanh-toan-mot-phan.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-35-thanh-toan-mot-phan.md) |
| UC-C36 | Hủy hóa đơn | [Mở Draw.io](./activity-uc-c36-huy-hoa-don.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-36-huy-hoa-don.md) |
| UC-C37 | Mở lại phiên | [Mở Draw.io](./activity-uc-c37-mo-lai-phien.drawio) | [Đặc tả](../use-cases/uc-thu-ngan-37-mo-lai-phien.md) |

## Quản lý

| Mã | Use case | Activity diagram | Đặc tả nguồn |
|---|---|---|---|
| UC-M26 | Quản lý thực đơn | [Mở Draw.io](./activity-uc-m26-quan-ly-thuc-don.drawio) | [Đặc tả](../use-cases/uc-quan-ly-26-quan-ly-thuc-don.md) |
| UC-M27 | Bật/tắt trạng thái còn-hết | [Mở Draw.io](./activity-uc-m27-bat-tat-con-het.drawio) | [Đặc tả](../use-cases/uc-quan-ly-27-bat-tat-con-het.md) |
| UC-M28 | Quản lý mã QR theo bàn | [Mở Draw.io](./activity-uc-m28-quan-ly-ma-qr.drawio) | [Đặc tả](../use-cases/uc-quan-ly-28-quan-ly-ma-qr.md) |
| UC-M29 | Thêm bàn | [Mở Draw.io](./activity-uc-m29-quan-ly-ban-them.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29-quan-ly-ban.md) |
| UC-M29 | Sửa bàn | [Mở Draw.io](./activity-uc-m29-quan-ly-ban-sua.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29-quan-ly-ban.md) |
| UC-M29 | Xóa bàn | [Mở Draw.io](./activity-uc-m29-quan-ly-ban-xoa.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29-quan-ly-ban.md) |
| UC-M29a | Thêm khu vực | [Mở Draw.io](./activity-uc-m29a-quan-ly-khu-vuc-them.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29a-quan-ly-khu-vuc.md) |
| UC-M29a | Sửa khu vực | [Mở Draw.io](./activity-uc-m29a-quan-ly-khu-vuc-sua.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29a-quan-ly-khu-vuc.md) |
| UC-M29a | Xóa khu vực | [Mở Draw.io](./activity-uc-m29a-quan-ly-khu-vuc-xoa.drawio) | [Đặc tả](../use-cases/uc-quan-ly-29a-quan-ly-khu-vuc.md) |
| UC-M30 | Thêm người dùng | [Mở Draw.io](./activity-uc-m30-quan-ly-nguoi-dung-them.drawio) | [Đặc tả](../use-cases/uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md) |
| UC-M30 | Sửa thông tin và phân quyền người dùng | [Mở Draw.io](./activity-uc-m30-quan-ly-nguoi-dung-sua.drawio) | [Đặc tả](../use-cases/uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md) |
| UC-M30 | Vô hiệu hóa hoặc kích hoạt tài khoản | [Mở Draw.io](./activity-uc-m30-quan-ly-nguoi-dung-trang-thai.drawio) | [Đặc tả](../use-cases/uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md) |
| UC-M30 | Đặt lại mật khẩu người dùng | [Mở Draw.io](./activity-uc-m30-quan-ly-nguoi-dung-dat-lai-mat-khau.drawio) | [Đặc tả](../use-cases/uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md) |
| UC-M31 | Xem báo cáo và thống kê | [Mở Draw.io](./activity-uc-m31-bao-cao-thong-ke.drawio) | [Đặc tả](../use-cases/uc-quan-ly-31-bao-cao-thong-ke.md) |

## Sinh lại file

```bash
node scripts/generate-activity-diagrams.mjs   # sinh lại (giữ nguyên file đã sửa tay)
node scripts/check-activity-diagrams.mjs      # kiểm tra luồng: không node mồ côi, không ngõ cụt
```

Các file `.drawio` dùng XML không nén để dễ review bằng Git.

