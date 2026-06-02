# PRD - Hệ thống quản lý nhà hàng lẩu nướng, mỳ cay gọi món qua QR

## 1. Tổng quan sản phẩm

Hệ thống quản lý nhà hàng lẩu nướng, mỳ cay gọi món qua QR là một website/app hỗ trợ vận hành nhà hàng theo mô hình khách ngồi tại bàn, quét mã QR để xem thực đơn, đặt món, gọi thêm món, theo dõi trạng thái món và yêu cầu thanh toán.

Hệ thống phục vụ đồng thời nhiều nhóm người dùng trong nhà hàng gồm khách hàng, phục vụ, bếp, thu ngân và quản lý. Trọng tâm của sản phẩm là tối ưu luồng vận hành tại bàn:

```
QR bàn → mở phiên phục vụ → xem thực đơn → đặt món → bếp nhận ticket → phục vụ món → thanh toán → đóng phiên
```

Về mặt kỹ thuật, hệ thống được định hướng triển khai bằng Go, PostgreSQL và WebSocket/realtime. Backend được thiết kế theo hướng modular monolith, chia module theo bounded context để phù hợp với phạm vi luận văn nhưng vẫn có khả năng mở rộng.

---

## 2. Bối cảnh và vấn đề cần giải quyết

Các nhà hàng lẩu nướng và mỳ cay thường có nhiều món, nhiều khu xử lý món và nhiều lượt gọi thêm trong cùng một bữa. Nếu quy trình gọi món, chuyển đơn xuống bếp và cập nhật trạng thái món làm thủ công, nhà hàng dễ gặp các vấn đề:

- Nhân viên phải ghi order thủ công, dễ sai món hoặc thiếu món.
- Khách phải chờ nhân viên tới bàn để gọi thêm món.
- Bếp khó theo dõi món mới, món đang chế biến và món đã sẵn sàng.
- Phục vụ khó biết bàn nào cần phục vụ món, gọi nhân viên hoặc yêu cầu thanh toán.
- Thu ngân phải tổng hợp hóa đơn thủ công từ nhiều lượt gọi món.
- Quản lý khó theo dõi doanh thu, món bán chạy và hiệu suất phục vụ.

Sản phẩm giải quyết các vấn đề trên bằng cách số hóa quy trình gọi món tại bàn, tự động tạo phiên phục vụ theo bàn, gửi ticket realtime đến bếp và tổng hợp hóa đơn cuối phiên.

---

## 3. Mục tiêu sản phẩm

### 3.1. Mục tiêu chính

- Cho phép khách hàng gọi món trực tiếp tại bàn thông qua mã QR.
- Giảm thao tác thủ công của phục vụ trong quá trình nhận order.
- Giúp bếp nhận món mới theo thời gian thực và cập nhật trạng thái chế biến.
- Giúp phục vụ theo dõi tín hiệu bàn, món sẵn sàng và yêu cầu thanh toán.
- Giúp thu ngân lập hóa đơn dựa trên dữ liệu snapshot của toàn bộ phiên phục vụ.
- Giúp quản lý cấu hình thực đơn, trạng thái món, bàn, khu vực và mã QR.

### 3.2. Mục tiêu trong phạm vi luận văn

- Xây dựng được luồng nghiệp vụ cốt lõi từ quét QR đến đóng phiên.
- Thiết kế được mô hình dữ liệu phù hợp với nhà hàng lẩu nướng, mỳ cay.
- Chứng minh được khả năng realtime trong các luồng chính: đặt món, bếp cập nhật trạng thái, phục vụ nhận tín hiệu.
- Thiết kế backend có cấu trúc rõ ràng, dễ bảo trì, theo hướng modular monolith/DDD.

---

## 4. Đối tượng người dùng

| Nhóm người dùng | Mô tả | Nhu cầu chính |
| --- | --- | --- |
| Khách hàng | Người dùng cuối ngồi tại bàn | Quét QR, xem menu, đặt món, gọi thêm, theo dõi món, yêu cầu thanh toán |
| Phục vụ | Nhân viên phục vụ bàn | Theo dõi bàn, nhận tín hiệu, phục vụ món, mở phiên walk-in |
| Bếp | Nhân viên chế biến món | Nhận ticket realtime, cập nhật trạng thái món, xử lý yêu cầu hủy món |
| Thu ngân | Nhân viên thanh toán | Xem phiên chờ thanh toán, lập hóa đơn, xử lý thanh toán, đóng phiên |
| Quản lý | Người quản lý nhà hàng | Quản lý menu, món còn/hết, bàn, QR, nhân viên, báo cáo |

---

## 5. Phạm vi MVP

MVP tập trung vào các chức năng cần thiết nhất để vận hành một nhà hàng lẩu nướng, mỳ cay gọi món tại bàn.

### 5.1. Khách hàng

- Quét QR để vào phiên phục vụ tại bàn.
- Xem danh mục món và thực đơn.
- Xem chi tiết món, giá, hình ảnh, mô tả, biến thể và tùy chọn.
- Đặt món lần đầu.
- Gọi thêm món trong cùng phiên.
- Hủy/sửa món khi món chưa được bếp tiếp nhận.
- Gửi yêu cầu hủy món khi bếp đã tiếp nhận.
- Theo dõi trạng thái món realtime.
- Gọi nhân viên.
- Yêu cầu thanh toán.

### 5.2. Phục vụ

- Đăng nhập hệ thống.
- Xem sơ đồ/lưới bàn theo khu vực.
- Mở phiên walk-in cho khách không quét QR.
- Theo dõi tín hiệu bàn realtime.
- Xác nhận đã tiếp nhận tín hiệu gọi nhân viên.
- Đánh dấu món đã phục vụ.
- Xem chi tiết phiên/đơn theo bàn.
- Yêu cầu thanh toán hộ khách.

### 5.3. Bếp

- Đăng nhập màn hình bếp.
- Xem hàng đợi ticket realtime.
- Lọc ticket theo station: lẩu, nướng, mỳ cay, đồ uống.
- Cập nhật trạng thái món: PENDING → ACKNOWLEDGED → PREPARING → READY.
- Xác nhận hoặc từ chối yêu cầu hủy món.
- Xem lịch sử trạng thái món.

### 5.4. Thu ngân

- Xem danh sách phiên chờ thanh toán.
- Xem hóa đơn snapshot của phiên.
- Điều chỉnh hóa đơn hoặc giảm giá ở mức cơ bản.
- Xử lý thanh toán tiền mặt hoặc chuyển khoản.
- In/xuất hóa đơn.
- Đóng phiên và giải phóng bàn.

### 5.5. Quản lý

- Quản lý danh mục món.
- Quản lý món ăn, biến thể món và tùy chọn món.
- Bật/tắt trạng thái còn/hết món.
- Quản lý bàn và khu vực.
- Quản lý mã QR theo bàn.
- Quản lý người dùng và phân quyền cơ bản.
- Xem báo cáo doanh thu và món bán chạy ở mức cơ bản.

---

## 6. Phạm vi chưa triển khai trong MVP

Các chức năng sau có thể được thiết kế ở mức mở rộng hoặc hướng phát triển, chưa bắt buộc triển khai đầy đủ trong luận văn:

- Tích hợp cổng thanh toán thật như VNPay, MoMo, ZaloPay.
- Webhook thanh toán điện tử đầy đủ.
- Quản lý kho nguyên liệu chi tiết.
- Tự động trừ kho theo công thức món ăn.
- Chương trình khách hàng thân thiết.
- Tài khoản khách hàng đăng nhập.
- Đặt bàn trước.
- Giao hàng/takeaway.
- Tích hợp hóa đơn điện tử.
- Multi-branch SaaS nâng cao.
- AI gợi ý món hoặc dự báo nhu cầu.
- Event outbox/dead-letter production đầy đủ nếu thời gian triển khai hạn chế.

---

## 7. Use case chính

### 7.1. Nhóm khách hàng

| Mã | Tên use case | Tác nhân chính |
| --- | --- | --- |
| UC-01 | Quét QR vào phiên | Khách hàng |
| UC-02 | Xem thực đơn | Khách hàng |
| UC-03 | Đặt món | Khách hàng |
| UC-04 | Gọi thêm món | Khách hàng |
| UC-05 | Hủy/sửa món đã gọi | Khách hàng |
| UC-06 | Theo dõi trạng thái món realtime | Khách hàng |
| UC-07 | Gọi nhân viên | Khách hàng |
| UC-08 | Yêu cầu thanh toán | Khách hàng |

### 7.2. Nhóm phục vụ

| Mã | Tên use case | Tác nhân chính |
| --- | --- | --- |
| UC-09 | Mở phiên walk-in | Phục vụ |
| UC-10 | Xem sơ đồ bàn/lưới bàn | Phục vụ |
| UC-11 | Theo dõi tín hiệu bàn | Phục vụ |
| UC-12 | Xác nhận gọi nhân viên | Phục vụ |
| UC-13 | Đánh dấu đã phục vụ | Phục vụ |
| UC-14 | Yêu cầu thanh toán hộ | Phục vụ |
| UC-15 | Xem chi tiết phiên/đơn theo bàn | Phục vụ |

### 7.3. Nhóm bếp

| Mã | Tên use case | Tác nhân chính |
| --- | --- | --- |
| UC-16 | Tiếp nhận đơn/xem hàng đợi realtime | Bếp |
| UC-17 | Cập nhật trạng thái món | Bếp |
| UC-18 | Xác nhận/từ chối yêu cầu hủy món | Bếp |
| UC-19 | Xem lịch sử trạng thái món | Bếp |

### 7.4. Nhóm thu ngân

| Mã | Tên use case | Tác nhân chính |
| --- | --- | --- |
| UC-20 | Xem danh sách phiên chờ thanh toán | Thu ngân |
| UC-21 | Xem hóa đơn snapshot | Thu ngân |
| UC-22 | Điều chỉnh hóa đơn và giảm giá | Thu ngân |
| UC-23 | Xử lý thanh toán | Thu ngân |
| UC-24 | In hóa đơn | Thu ngân |
| UC-25 | Đóng phiên | Thu ngân |

### 7.5. Nhóm quản lý

| Mã | Tên use case | Tác nhân chính |
| --- | --- | --- |
| UC-26 | Quản lý thực đơn | Quản lý |
| UC-27 | Bật/tắt trạng thái còn-hết | Quản lý |
| UC-28 | Quản lý mã QR theo bàn | Quản lý |
| UC-29 | Quản lý bàn/khu vực | Quản lý |
| UC-30 | Quản lý người dùng và phân quyền | Quản lý |
| UC-31 | Xem báo cáo và thống kê | Quản lý |

---

## 8. Yêu cầu chức năng theo module

### 8.1. Module Identity

- Đăng nhập nhân viên.
- Quản lý người dùng.
- Gán vai trò: phục vụ, bếp, thu ngân, quản lý.
- Kiểm tra quyền truy cập theo vai trò.
- Quản lý phiên đăng nhập.

### 8.2. Module Dining

- Quản lý nhà hàng, khu vực và bàn.
- Quản lý mã QR gắn với bàn.
- Mở phiên phục vụ qua QR hoặc walk-in.
- Đảm bảo mỗi bàn chỉ có một phiên active tại một thời điểm.
- Chuyển trạng thái phiên: ACTIVE → AWAITING_PAYMENT → CLOSED.

### 8.3. Module Catalog

- Quản lý danh mục món.
- Quản lý món ăn.
- Quản lý biến thể món như khẩu phần, định lượng, tô thường/tô đặc biệt.
- Quản lý tùy chọn món như cấp độ cay, sốt nướng, loại nước lẩu, món thêm.
- Bật/tắt trạng thái còn/hết món.
- Đẩy cập nhật trạng thái món đến màn khách nếu có realtime.

### 8.4. Module Ordering

- Tạo order lần đầu.
- Tạo order gọi thêm.
- Snapshot tên/giá món tại thời điểm gọi.
- Tạo order item và option đã chọn.
- Tạo kitchen ticket theo station.
- Cập nhật trạng thái món.
- Xử lý yêu cầu hủy/sửa món theo trạng thái.
- Lưu lịch sử trạng thái món.

### 8.5. Module Kitchen

- Hiển thị ticket realtime.
- Lọc ticket theo station: hotpot, grill, noodle, drink.
- Cập nhật trạng thái chế biến.
- Xử lý yêu cầu hủy món.

Ghi chú: trong thiết kế backend, kitchen có thể không tách thành bounded context riêng. Phần bếp là interface/read model thuộc module ordering.

### 8.6. Module Billing

- Lập hóa đơn từ một dining session.
- Tạo invoice item dạng snapshot.
- Điều chỉnh hóa đơn và giảm giá cơ bản.
- Ghi nhận thanh toán tiền mặt/chuyển khoản.
- In hoặc xuất hóa đơn.
- Đóng phiên sau khi thanh toán.

### 8.7. Module Reporting

- Xem doanh thu theo ngày/khoảng thời gian.
- Xem món bán chạy.
- Xem số lượng order.
- Xem thời gian chế biến/phục vụ trung bình dựa trên lịch sử trạng thái món.

---

## 9. Yêu cầu phi chức năng

### 9.1. Hiệu năng

- API thao tác thông thường phản hồi trong thời gian chấp nhận được cho môi trường nhà hàng.
- Cập nhật realtime cho bếp/phục vụ/khách cần đủ nhanh để không làm gián đoạn vận hành.
- Hệ thống hỗ trợ nhiều bàn và nhiều khách cùng đặt món trong cùng thời điểm.

### 9.2. Bảo mật

- Nhân viên đăng nhập bằng tài khoản và được phân quyền theo vai trò.
- Khách hàng không cần đăng nhập; truy cập phiên thông qua QR/session token.
- QR token cần đủ khó đoán và có thể vô hiệu hóa khi cần.
- Các thao tác nhạy cảm như hủy món, void hóa đơn, đổi giá, đổi quyền cần được ghi log.

### 9.3. Tính nhất quán dữ liệu

- Mỗi bàn chỉ có tối đa một phiên active.
- Món đã gọi phải giữ snapshot tên/giá tại thời điểm đặt.
- Hóa đơn phải dùng dữ liệu snapshot, không bị ảnh hưởng khi thực đơn thay đổi sau này.
- Cập nhật trạng thái món phải tuân theo thứ tự hợp lệ.

### 9.4. Khả năng mở rộng

- Thiết kế modular monolith, chia module rõ ràng để dễ bảo trì.
- Có thể mở rộng sang nhiều chi nhánh hoặc SaaS trong tương lai.
- Có thể bổ sung payment gateway, quản lý kho, loyalty hoặc đặt bàn sau này.

### 9.5. Khả năng sử dụng

- Giao diện khách hàng tối ưu cho điện thoại.
- Màn hình bếp dễ nhìn, thể hiện rõ món mới, món đang chế biến và món sẵn sàng.
- Màn hình phục vụ thể hiện rõ tín hiệu bàn và trạng thái món.
- Màn hình thu ngân giúp lập hóa đơn nhanh và hạn chế sai sót.

---

## 10. Quy tắc nghiệp vụ quan trọng

### 10.1. Quy tắc phiên phục vụ

- Mỗi bàn chỉ có một phiên active tại một thời điểm.
- Phiên được mở khi khách quét QR hoặc phục vụ mở walk-in.
- Phiên được đóng sau khi hóa đơn đã thanh toán.
- Khi phiên ở trạng thái chờ thanh toán, hệ thống có thể khóa gọi thêm món.

### 10.2. Quy tắc QR

- Mỗi bàn có thể có nhiều QR theo lịch sử, nhưng chỉ một QR active.
- QR cũ phải bị vô hiệu khi đổi QR mới.
- QR không hợp lệ hoặc hết hiệu lực không được vào phiên.

### 10.3. Quy tắc thực đơn

- Món có thể có biến thể chính như phần 2 người/4 người, 100g/200g, tô thường/tô đặc biệt.
- Món có thể có tùy chọn phụ như cấp độ cay, sốt nướng, món thêm, loại nước lẩu.
- Trạng thái còn/hết cần được cập nhật nhanh để tránh khách đặt món không còn phục vụ.

### 10.4. Quy tắc đặt món

- Khi đặt món, hệ thống phải kiểm tra phiên active và trạng thái món.
- Tên, giá và tùy chọn của món phải được snapshot.
- Mỗi lần gọi thêm có thể tạo một order mới thuộc cùng dining session.
- Order item là đơn vị theo dõi trạng thái chính.

### 10.5. Quy tắc trạng thái món

Trạng thái món đi theo luồng:

```
PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED
```

- Bếp cập nhật đến READY.
- Phục vụ chuyển READY sang SERVED.
- Chỉ món còn PENDING mới được khách hủy/sửa trực tiếp.
- Nếu món đã ACKNOWLEDGED/PREPARING, yêu cầu hủy cần bếp duyệt.

### 10.6. Quy tắc thanh toán

- Hóa đơn được lập từ toàn bộ món thuộc dining session.
- Invoice item phải là snapshot.
- Chỉ đóng phiên khi hóa đơn đã thanh toán.
- Thanh toán MVP ưu tiên tiền mặt và chuyển khoản.

---

## 11. Tiêu chí thành công

Sản phẩm MVP được xem là đạt yêu cầu khi hoàn thành các tiêu chí sau:

- Khách có thể quét QR vào đúng bàn và phiên phục vụ.
- Khách có thể xem menu và đặt món thành công.
- Bếp nhận được ticket món mới.
- Bếp có thể cập nhật trạng thái món.
- Khách/phục vụ thấy được trạng thái món cập nhật.
- Phục vụ có thể đánh dấu món đã phục vụ.
- Thu ngân có thể lập hóa đơn từ toàn bộ phiên.
- Hóa đơn giữ đúng tên/giá snapshot.
- Thu ngân có thể ghi nhận thanh toán và đóng phiên.
- Quản lý có thể quản lý menu, món còn/hết, bàn và QR.
- Dữ liệu không cho phép một bàn có hai phiên active cùng lúc.

---

## 12. Rủi ro và giả định

### 12.1. Rủi ro

- Scope hệ thống dễ bị phình do có nhiều nhóm chức năng.
- Realtime và WebSocket có thể làm tăng độ phức tạp kỹ thuật.
- Payment gateway thật có webhook/idempotency phức tạp, không nên đưa vào MVP nếu thời gian hạn chế.
- Quản lý kho nguyên liệu có thể làm database và nghiệp vụ lớn hơn nhiều.
- Sequence diagram/use case quá nhiều có thể làm báo cáo bị loãng.

### 12.2. Giả định

- Nhà hàng có WiFi hoặc mạng ổn định.
- Khách hàng có điện thoại có khả năng quét QR.
- Nhân viên nhà hàng được phân quyền theo vai trò.
- Hệ thống triển khai cho một nhà hàng hoặc một chi nhánh trong phạm vi luận văn.
- Thanh toán MVP xử lý ở mức ghi nhận tiền mặt/chuyển khoản, chưa bắt buộc tích hợp cổng thanh toán thật.

---

## 13. Hướng phát triển

- Tích hợp cổng thanh toán VNPay, MoMo, ZaloPay.
- Hỗ trợ webhook thanh toán idempotent.
- Quản lý kho nguyên liệu và định lượng món.
- Quản lý đặt bàn trước.
- Chương trình khách hàng thân thiết.
- Hóa đơn điện tử.
- Báo cáo nâng cao theo giờ cao điểm, món bán chạy, hiệu suất bếp.
- Multi-branch hoặc SaaS cho nhiều nhà hàng.
- Tối ưu realtime bằng outbox worker, retry và dead-letter đầy đủ.
- Ứng dụng mobile cho nhân viên hoặc quản lý.

---

## 14. Ghi chú kiến trúc liên quan

Backend định hướng theo modular monolith kết hợp Clean Architecture/DDD. Một service Go duy nhất được chia thành các module như identity, catalog, dining, ordering và billing. Cách thiết kế này phù hợp với quy mô luận văn, tránh độ phức tạp của microservices nhưng vẫn giữ khả năng tách module rõ ràng.

Trong biểu đồ sequence nghiệp vụ, có thể gom backend thành một lifeline như `Backend API` hoặc `Backend API (Order Module)` thay vì vẽ chi tiết `Service`, `Repository`, `Domain Entity`. Các chi tiết như outbox worker hoặc WebSocket hub có thể mô tả trong phần kiến trúc kỹ thuật thay vì đưa vào mọi sequence diagram.