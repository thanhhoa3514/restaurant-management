# CHƯƠNG 4. THỬ NGHIỆM

Chương này trình bày kế hoạch kiểm thử, các kịch bản được xây dựng từ những use case
chính ở Chương 3, kết quả thực tế khi chạy kiểm thử và cách hệ thống xử lý các trường
hợp ngoại lệ.

## Kế hoạch thực hiện

Quá trình thử nghiệm được thực hiện theo năm bước:

1. Chọn các luồng chính của Khách, Phục vụ, Bếp, Thu ngân và Quản lý.
2. Ghép từng luồng với kiểm thử tự động đang có trong dự án.
3. Kiểm tra đóng gói hệ thống, chất lượng mã, bảo mật và tranh chấp dữ liệu.
4. Khởi tạo cơ sở dữ liệu tạm, chạy thử API và đo tải trên đường dẫn đọc thực đơn.
5. Tổng hợp kết quả; trường hợp chưa được kiểm tra đầy đủ được ghi rõ, không mặc định
   là đạt.

### Môi trường thử nghiệm

| Thành phần | Thông tin |
|---|---|
| Thời gian thực hiện | 25/07/2026, múi giờ Asia/Bangkok |
| Hệ điều hành | Linux amd64 |
| Go | 1.26.2 |
| Node.js / npm | 20.20.2 / 10.8.2 |
| Cơ sở dữ liệu | PostgreSQL 15 chạy tạm trong Docker, dữ liệu chỉ lưu trong bộ nhớ |
| Dữ liệu mẫu | 1 nhà hàng, 12 bàn, 12 mã QR và thực đơn mẫu |
| Công cụ đo tải | ApacheBench 2.3 |
| Phạm vi | Kiểm thử tự động phía máy chủ, kiểm tra đóng gói giao diện, kiểm thử API cục bộ và đo tải đường dẫn đọc thực đơn |

Sau khi hoàn tất, API và cơ sở dữ liệu tạm đã được dừng và xóa. Không sử dụng dữ liệu
thật của nhà hàng.

## 4.1 CÁC KỊCH BẢN THỬ NGHIỆM

Các kịch bản dưới đây bao phủ chức năng chính, trường hợp ngoại lệ, bảo mật, độ ổn định
và khả năng đáp ứng tải.

**Bảng 4-1: Danh sách các kịch bản thử nghiệm**

| Mã KB | Chức năng | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| KB-01 | Quét QR vào phiên (UC-G01) | Bàn có mã QR hợp lệ | Quét QR của bàn đang có phiên; quét lại; quét QR của bàn chưa có phiên; thử mã sai và mã đã vô hiệu | Phiên đang hoạt động trả đúng mã phiên; quét lại không tạo phiên mới; bàn chưa có phiên tạo phiên chờ xác nhận; mã sai bị từ chối |
| KB-02 | Xem thực đơn (UC-G02) | Có dữ liệu danh mục và món | Lấy danh mục, danh sách món và chi tiết một món; thử mã danh mục hoặc mã món không hợp lệ | Trả đúng dữ liệu khách được phép xem; mã sai trả lỗi `400/404` |
| KB-03 | Đặt món và gọi thêm món (UC-G03, UC-G04) | Phiên đang hoạt động, món còn bán | Đặt món có số lượng và tùy chọn; gọi thêm món; thử số lượng sai, thiếu tùy chọn, món hết và phiên đã chờ thanh toán | Tính tiền đúng, tạo đơn và phiếu bếp; dữ liệu sai hoặc phiên không hợp lệ bị từ chối |
| KB-04 | Sửa và hủy món đã gọi (UC-G05a, UC-G05b) | Đơn còn được phép sửa | Sửa số lượng; hủy món; thử phiên bản cũ, món đã khóa, món hết và yêu cầu hủy trùng | Chỉ món hợp lệ được cập nhật; trường hợp xung đột bị từ chối và không làm thay đổi đơn |
| KB-05 | Xử lý yêu cầu hủy món (UC-K18) | Có yêu cầu hủy đang chờ Bếp xem xét | Bếp chấp nhận; Bếp từ chối và nhập ghi chú; thử yêu cầu đã được xử lý hoặc món không còn được hủy | Chấp nhận thì hủy món; từ chối thì giữ món; yêu cầu không còn hợp lệ bị từ chối và không làm thay đổi dữ liệu |
| KB-06 | Thanh toán một phần (UC-C35) | Hóa đơn chưa thanh toán đủ | Trả nhiều lần; đưa dư bằng tiền mặt; đưa dư bằng thẻ; trả thêm khi hóa đơn đã đủ | Cộng đúng số tiền; tiền mặt dư được tính tiền thối; thẻ đưa dư và hóa đơn đã đủ bị từ chối |
| KB-07 | Quản lý thực đơn (UC-M26, UC-M27) | Người dùng có quyền quản lý thực đơn | Thêm, sửa, xóa mềm và đổi trạng thái món; thử danh mục sai và phiên bản cũ | Dữ liệu hợp lệ được lưu; có nhật ký và thông báo; dữ liệu sai hoặc cũ bị từ chối |
| KB-08 | Quản lý bàn và mã QR (UC-M28, UC-M29) | Có nhà hàng và danh sách bàn | Thêm/sửa/xóa bàn; tạo mã QR; gọi lại thao tác tạo; đổi mã QR | Kiểm tra trùng mã bàn; không xóa bàn đang có phiên; tạo lại trả mã hiện có; đổi mã làm mã cũ mất hiệu lực |
| KB-09 | Đăng nhập và phân quyền (UC-M30) | Có tài khoản theo từng vai trò | Đăng nhập đúng/sai; thử mã đăng nhập thiếu, sai chữ ký, hết hạn; truy cập chức năng không có quyền | Đăng nhập hợp lệ thành công; yêu cầu không hợp lệ trả `401`; thiếu quyền trả `403` |
| KB-10 | Kết nối thời gian thực (UC-G06, UC-K16, UC-P11) | Có mã đăng nhập nhân viên hoặc mã phiên khách | Xác thực kết nối; thử nguồn truy cập không được phép; gửi thông báo khác nhà hàng hoặc khác phiên | Chỉ nguồn hợp lệ được kết nối; khách chỉ nhận thông báo thuộc đúng nhà hàng và phiên |
| KB-11 | An toàn lớp HTTP | API đang hoạt động | Gửi nội dung vượt giới hạn; gửi nguồn CORS lạ; gây lỗi bất ngờ trong bộ xử lý; kiểm tra mã yêu cầu | Từ chối nội dung quá lớn và nguồn lạ; lỗi bất ngờ trả `500`; mỗi yêu cầu có mã theo dõi |
| KB-12 | Đóng gói giao diện | Đã cài thư viện giao diện | Chạy kiểm tra kiểu dữ liệu và tạo bản đóng gói dùng cho triển khai | Hoàn tất không lỗi; tạo được thư mục `dist` |
| KB-13 | Quy chuẩn mã giao diện | Đã cài ESLint và Prettier | Chạy kiểm tra quy tắc mã và định dạng | Không có lỗi hoặc cảnh báo cần xử lý |
| KB-14 | Tranh chấp dữ liệu | Bộ test Go có thể chạy với chế độ dò tranh chấp | Chạy toàn bộ kiểm thử Go với tùy chọn `-race` | Không phát hiện hai luồng truy cập dữ liệu không an toàn |
| KB-15 | Hiệu năng và chịu tải | API cục bộ và PostgreSQL tạm đang hoạt động | Gửi 1.000 yêu cầu với 20 kết nối đồng thời, sau đó 5.000 yêu cầu với 50 kết nối đồng thời tới danh sách món | Không có yêu cầu lỗi; thời gian trung bình dưới 100 ms và 95% yêu cầu dưới 200 ms trong môi trường cục bộ |
| KB-16 | Trang tài liệu API | API đã khởi động | Mở `/openapi.yaml` và trang Swagger | Trả nội dung OpenAPI hợp lệ và giao diện Swagger đọc được nội dung đó |

## 4.2 KẾT QUẢ THỬ NGHIỆM CÁC KỊCH BẢN

Dự án hiện có 25 tệp kiểm thử Go trong 16 gói, gồm 96 hàm kiểm thử chính và 27
kịch bản con. Khi chạy toàn bộ, 95/96 hàm kiểm thử chính đạt; một kiểm thử trang tài
liệu API không đạt.

**Bảng 4-2: Kết quả thử nghiệm các kịch bản**

| Mã KB | Kết quả mong đợi | Kết quả thực tế | Đạt / Không đạt | Ghi chú |
|---|---|---|---|---|
| KB-01 | Xử lý đúng QR hợp lệ, QR lặp lại, QR chưa có phiên và QR sai | Các nhánh đều cho kết quả đúng; yêu cầu tham gia phiên thật trả HTTP `200` trong 14,509 ms | Đạt | Được kiểm tra bằng `TestJoinSession` và lần gọi API trên dữ liệu mẫu |
| KB-02 | Trả đúng danh mục, món và chi tiết; mã sai bị từ chối | Hai đường dẫn danh mục và món trả HTTP `200`; lần gọi mẫu lần lượt mất 3,363 ms và 6,704 ms; kiểm thử dữ liệu và mã sai đạt | Đạt | Chưa có kiểm thử trình duyệt tự động cho phần hiển thị |
| KB-03 | Tạo đơn, tính tiền, chia phiếu bếp và chặn dữ liệu sai | Tính tiền và chia phiếu bếp đúng; món hết, số lượng sai, thiếu tùy chọn và phiên không hoạt động đều bị chặn | Đạt | Kiểm thử tại lớp xử lý nghiệp vụ |
| KB-04 | Chỉ sửa/hủy món còn hợp lệ | Phiên bản cũ, món đã khóa, tăng số lượng món hết, hủy trùng và phiên không hoạt động đều bị từ chối | Đạt | Giảm số lượng món vừa hết vẫn được phép để khách bỏ bớt món |
| KB-05 | Bếp xử lý đúng yêu cầu hủy và chặn trường hợp không còn hợp lệ | Chức năng đã có trong mã nguồn nhưng chưa có kiểm thử tự động riêng cho `KitchenReviewCancelRequest`; đợt này cũng chưa chạy luồng đó qua API thật | Không đạt | Không kết luận chức năng sai; kết luận chưa đủ bằng chứng kiểm thử cho UC-K18 |
| KB-06 | Tính đúng thanh toán một phần và tiền thối | Hai lần thanh toán cộng đúng; tiền mặt dư 300.000 đồng được ghi là tiền thối; thẻ đưa dư và hóa đơn đã đủ bị từ chối | Đạt | Bao phủ luật thanh toán mới |
| KB-07 | Thêm/sửa/xóa/đổi trạng thái món an toàn | Các thao tác hợp lệ tạo nhật ký và thông báo; danh mục sai và phiên bản cũ bị từ chối | Đạt | Kiểm thử thao tác và dữ liệu đọc thực đơn |
| KB-08 | Quản lý bàn và mã QR đúng ràng buộc | Các trường hợp thêm/sửa/xóa bàn, tạo lại và đổi mã QR đều đạt | Đạt | Có kiểm tra bàn đang có phiên và mã QR đã tồn tại |
| KB-09 | Chặn đăng nhập và quyền không hợp lệ | Mã thiếu, sai chữ ký, sai cách ký và hết hạn trả `401`; thiếu quyền trả `403`; đăng nhập đúng thành công | Đạt | Yêu cầu xem đơn không có mã phiên cũng được thử trực tiếp và trả HTTP `401` |
| KB-10 | Kết nối và thông báo được giới hạn đúng phạm vi | Kiểm tra nguồn truy cập, xác thực nhân viên/khách và giới hạn theo nhà hàng/phiên đều đạt | Đạt | Chưa mô phỏng mất mạng rồi tự kết nối lại trên trình duyệt |
| KB-11 | Lớp HTTP xử lý an toàn các yêu cầu bất thường | Kiểm tra giới hạn nội dung, CORS, khôi phục sau lỗi và mã theo dõi đều đạt | Đạt | 12 hàm kiểm thử cho lớp HTTP |
| KB-12 | Tạo được bản đóng gói giao diện | `tsc -b` và `vite build` hoàn tất, 2.686 mô-đun được xử lý | Đạt | Có cảnh báo hai tệp đóng gói lớn hơn 500 kB; lớn nhất 1.426,96 kB trước nén |
| KB-13 | Không có lỗi quy chuẩn hoặc định dạng | ESLint báo 41 lỗi và 14 cảnh báo; Prettier báo một tệp chưa đúng định dạng | Không đạt | Một phần lỗi đến từ cấu hình quy tắc `react-doctor` chưa được khai báo; ngoài ra còn lỗi kiểu dữ liệu và cách dùng React Hook |
| KB-14 | Không phát hiện tranh chấp dữ liệu | Không có cảnh báo tranh chấp ở các gói đã chạy; lệnh tổng vẫn kết thúc lỗi vì KB-16 | Đạt | Lỗi trang tài liệu API không liên quan đến tranh chấp dữ liệu |
| KB-15 | Không lỗi, trung bình dưới 100 ms, 95% dưới 200 ms | Mức 1: 1.000/1.000 thành công, trung bình 6,842 ms, 95% dưới 11 ms. Mức 2: 5.000/5.000 thành công, trung bình 15,030 ms, 95% dưới 19 ms | Đạt | Chỉ đo đường dẫn đọc thực đơn trên máy cục bộ; chưa đại diện cho mạng và máy chủ triển khai thật |
| KB-16 | OpenAPI và Swagger có nội dung hợp lệ | `/openapi.yaml` trả HTTP `200` nhưng nội dung rỗng, kích thước 0 byte; `TestRegisterServesSpecAndUI` không đạt | Không đạt | Tệp `backend/api/embed.go` khai báo biến nhưng chưa nhúng `openapi.yaml` vào chương trình |

### Kết quả kiểm tra bổ sung

- 17 bản cập nhật cơ sở dữ liệu được áp dụng thành công trên PostgreSQL tạm.
- `go build ./...` đạt.
- `go vet ./...` đạt.
- Bản đóng gói giao diện được tạo thành công.
- Cơ sở dữ liệu và API tạm đã được dừng sau khi đo tải.

## 4.3 XỬ LÝ CÁC TRƯỜNG HỢP NGOẠI LỆ

Ngoài các luồng chính, hệ thống được kiểm tra với các tình huống thường gặp trong vận
hành nhà hàng.

**Bảng 4-3: Các trường hợp ngoại lệ và cách xử lý**

| STT | Trường hợp ngoại lệ | Cách xử lý của hệ thống | Kết quả kiểm thử |
|---:|---|---|---|
| 1 | Món vừa hết hàng khi khách đang đặt | Khi gửi đơn, hệ thống kiểm tra lại trạng thái món và từ chối món không còn bán; không tạo đơn dở dang | Đạt |
| 2 | Món hết sau khi đã nằm trong đơn đang sửa | Không cho tăng số lượng; vẫn cho giảm số lượng để khách bỏ bớt món | Đạt |
| 3 | Mất kết nối thời gian thực tới bếp hoặc khách | Giao diện có cơ chế kết nối lại và tải lại dữ liệu, nhưng chưa có kiểm thử trình duyệt tự động mô phỏng mất mạng | Chưa kết luận |
| 4 | Mã QR không tồn tại hoặc đã bị vô hiệu | Từ chối tham gia phiên với lỗi không được phép; không cấp mã phiên | Đạt ở lớp nghiệp vụ |
| 5 | Quét lại QR của phiên đang hoạt động | Trả lại cùng mã phiên, không tạo thêm phiên mới | Đạt |
| 6 | Bàn chưa có phiên khi khách quét QR | Tạo phiên chờ xác nhận và cấp mã phiên để khách chờ Phục vụ xác nhận | Đạt |
| 7 | Khách đặt món khi phiên đã chờ thanh toán | Từ chối yêu cầu, không tạo đơn mới | Đạt |
| 8 | Khách gửi phiên bản đơn cũ khi sửa | Trả lỗi xung đột, không ghi đè thay đổi mới hơn | Đạt |
| 9 | Khách yêu cầu hủy món đã bắt đầu chế biến | Tạo yêu cầu chờ Bếp xem xét thay vì hủy ngay | Đạt |
| 10 | Bếp chấp nhận hoặc từ chối yêu cầu hủy | Hệ thống đã có phần xử lý nhưng chưa có kiểm thử tự động riêng trong đợt này | Chưa kết luận |
| 11 | Thanh toán dư bằng tiền mặt | Chỉ ghi nhận phần còn thiếu của hóa đơn; phần dư được lưu thành tiền thối | Đạt |
| 12 | Thanh toán dư bằng thẻ hoặc chuyển khoản | Từ chối giao dịch; không thối tiền mặt cho giao dịch ngân hàng | Đạt |
| 13 | Hóa đơn đã trả đủ nhưng tiếp tục thanh toán | Từ chối, không tạo thêm khoản thanh toán | Đạt |
| 14 | Thiếu mã đăng nhập, mã sai hoặc hết hạn | Trả `401`, không cho đi tiếp vào chức năng được bảo vệ | Đạt |
| 15 | Người dùng không có quyền thực hiện chức năng | Trả `403`, không thực hiện thay đổi dữ liệu | Đạt |
| 16 | Nguồn truy cập WebSocket không nằm trong danh sách cho phép | Từ chối kết nối | Đạt |
| 17 | Không tìm thấy chi tiết món | Phía máy chủ trả `400/404`; giao diện chi tiết hiện vẫn giữ màn chờ tải và chưa có thông báo riêng | Chưa đạt đầy đủ |
| 18 | Nội dung yêu cầu vượt giới hạn | Từ chối trước khi vào phần xử lý nghiệp vụ | Đạt |
| 19 | Trang OpenAPI được yêu cầu nhưng nội dung chưa được nhúng | Trả HTTP `200` với nội dung rỗng | Không đạt |

## 4.4 ĐÁNH GIÁ VÀ HƯỚNG KHẮC PHỤC

Kết quả cho thấy phần lớn luật nghiệp vụ cốt lõi về QR, gọi món, sửa món, tạo yêu cầu
hủy, thanh toán, phân quyền và giới hạn thông báo đã có kiểm thử tự động và đạt. Luồng
Bếp duyệt yêu cầu hủy vẫn thiếu kiểm thử riêng. Hệ thống tạo được bản đóng gói giao
diện và đáp ứng tốt phép đo đọc thực đơn trong môi trường cục bộ.

Các việc cần ưu tiên sau đợt thử nghiệm:

1. Nhúng nội dung `openapi.yaml` vào chương trình để sửa KB-16.
2. Sửa cấu hình ESLint và các lỗi còn lại để KB-13 đạt.
3. Bổ sung trạng thái báo lỗi và nút quay lại cho màn chi tiết món.
4. Bổ sung kiểm thử cho luồng Bếp chấp nhận/từ chối yêu cầu hủy món ở UC-K18.
5. Thêm kiểm thử giao diện tự động cho luồng quét QR → xem thực đơn → đặt món.
6. Thêm kịch bản tự động mô phỏng mất kết nối và kết nối lại.
7. Lưu bài đo tải thành kịch bản có thể chạy lại, sau đó đo trên môi trường gần với
   triển khai thật, gồm cả thao tác ghi dữ liệu và nhiều phiên đồng thời.

### Các lệnh đã sử dụng

```bash
go build ./...
go vet ./...
go test -count=1 ./...
go test -race -count=1 ./...
npm run build
npm run lint
npm run format:check
ab -k -n 1000 -c 20 http://127.0.0.1:18080/api/v1/customer/menu/items
ab -k -n 5000 -c 50 http://127.0.0.1:18080/api/v1/customer/menu/items
```
