import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'docs/activity-diagrams')
const combinedPath = resolve(outputDir, 'restaurant-use-cases-activity-diagrams.drawio')

const action = (text) => ({ lane: 'actor', type: 'action', text })
const system = (text) => ({ lane: 'system', type: 'system', text })
const event = (text) => ({ lane: 'system', type: 'event', text })
const store = (text) => ({ lane: 'system', type: 'store', text })
// skip: nhánh thay thế nhập lại luồng chính sau mấy bước. Mặc định 1 (bước kế
// tiếp). Đặt 2 khi nhánh đó phải bỏ qua đúng một bước chỉ dành cho nhánh chính.
const decision = (text, alternate, mainLabel = 'Có / hợp lệ', alternateLabel = 'Không', alternateKind = 'error', skip = 1) => ({
  lane: 'system',
  type: 'decision',
  text,
  alternate,
  mainLabel,
  alternateLabel,
  alternateKind,
  skip,
})

const uc = (group, id, slug, title, actor, source, steps) => ({
  group, id, slug, title, actor, source, steps,
})

const diagrams = [
  // KHÁCH
  uc('Khách hàng', 'UC-G01', 'quet-qr-vao-phien', 'Quét QR vào phiên', 'Khách', 'uc-khach-01-quet-qr-vao-phien.md', [
    action('Quét mã QR tại bàn và nhập tên khách'),
    system('Gửi yêu cầu tham gia phiên của bàn'),
    decision('Mã QR còn hiệu lực và đúng bàn?', 'Từ chối mã giả, hết hạn hoặc đã bị đổi'),
    system('Tìm phiên đang phục vụ của bàn'),
    decision('Bàn đã có phiên?', 'Mở phiên mới và báo nhân viên tới xác minh', 'Có', 'Chưa có', 'alternate'),
    system('Cấp quyền truy cập phiên và trả thông tin bàn'),
    action('Vào màn hình gọi món của đúng bàn'),
  ]),
  uc('Khách hàng', 'UC-G02', 'xem-thuc-don', 'Xem thực đơn', 'Khách', 'uc-khach-02-xem-thuc-don.md', [
    action('Mở màn hình thực đơn'),
    system('Tải danh mục và các món đang bán'),
    decision('Khách có lọc theo danh mục?', 'Hiển thị toàn bộ món đang được phép bán', 'Có', 'Không', 'alternate'),
    system('Lọc món theo danh mục và tình trạng còn bán'),
    action('Chọn món để xem biến thể, tùy chọn và giá'),
    system('Trả chi tiết món cùng biến thể và nhóm tùy chọn'),
    action('Xem chi tiết hoặc thêm món vào giỏ'),
  ]),
  uc('Khách hàng', 'UC-G03', 'dat-mon', 'Đặt món', 'Khách', 'uc-khach-03-dat-mon.md', [
    action('Chọn món, số lượng, biến thể, tùy chọn và ghi chú'),
    action('Xác nhận gửi giỏ hàng'),
    system('Kiểm tra quyền truy cập phiên của khách'),
    decision('Phiên đang phục vụ?', 'Từ chối vì phiên chưa xác minh, chờ thanh toán hoặc đã đóng'),
    system('Kiểm từng món và ghi lại giá tại thời điểm gọi'),
    decision('Mọi món hợp lệ và còn bán?', 'Báo lỗi từng dòng; giữ giỏ để khách sửa lại'),
    store('Lập đơn với các món chờ nhân viên xác nhận'),
    event('Báo nhân viên có đơn mới cần xác nhận'),
    action('Nhận mã đơn và chuyển sang theo dõi trạng thái'),
  ]),
  uc('Khách hàng', 'UC-G04', 'goi-them-mon', 'Gọi thêm món', 'Khách', 'uc-khach-04-goi-them-mon.md', [
    action('Chọn thêm món trong phiên hiện tại'),
    system('Kiểm tra phiên còn đang phục vụ'),
    decision('Phiên đã có đơn trước đó?', 'Xử lý như đơn đầu tiên của phiên', 'Có', 'Chưa', 'alternate'),
    system('Kiểm từng món và ghi lại giá tại thời điểm gọi'),
    decision('Giỏ gọi thêm hợp lệ?', 'Báo lỗi từng dòng; không tạo đơn dở dang'),
    store('Lập đơn gọi thêm cho phiên'),
    event('Báo nhân viên xác nhận và cập nhật tổng của phiên'),
    action('Nhận đơn gọi thêm và tiếp tục theo dõi'),
  ]),
  uc('Khách hàng', 'UC-G05a', 'sua-mon-da-goi', 'Sửa món đã gọi', 'Khách', 'uc-khach-05a-sua-mon-da-goi.md', [
    action('Mở đơn vừa gửi và sửa số lượng, ghi chú hoặc tùy chọn'),
    system('Gửi yêu cầu sửa kèm bản đơn khách đang xem'),
    decision('Đơn chưa bị người khác thay đổi?', 'Báo đơn đã thay đổi; yêu cầu tải lại'),
    system('Đọc trạng thái từng món trong đơn'),
    decision('Món cần sửa chưa được xác nhận?', 'Giữ nguyên món; nhân viên đã xác nhận nên khách hết quyền sửa'),
    system('Kiểm lại giá, tùy chọn và bỏ món khách đã gỡ khỏi đơn'),
    store('Lưu đơn sau chỉnh sửa và tính lại tổng của phiên'),
    event('Báo các màn hình liên quan đơn vừa thay đổi'),
    action('Nhận đơn mới sau chỉnh sửa'),
  ]),
  uc('Khách hàng', 'UC-G05b', 'huy-mon-da-goi', 'Hủy món đã gọi', 'Khách', 'uc-khach-05b-huy-mon-da-goi.md', [
    action('Chọn hủy toàn bộ đơn vừa đặt'),
    system('Kiểm tra phiên và đọc trạng thái từng món'),
    decision('Tất cả món chưa được xác nhận?', 'Không hủy thẳng; hướng dẫn gửi yêu cầu hủy từng món', 'Có', 'Không', 'error'),
    store('Hủy các món chưa xác nhận và gỡ khỏi phiếu bếp'),
    system('Nếu không còn món nào, chuyển cả đơn sang đã hủy'),
    event('Báo các màn hình liên quan đơn vừa hủy'),
    action('Nhận xác nhận đã hủy đơn'),
  ]),
  uc('Khách hàng', 'UC-G06', 'theo-doi-trang-thai-mon', 'Theo dõi trạng thái món tức thời', 'Khách', 'uc-khach-06-theo-doi-trang-thai-mon.md', [
    action('Mở màn hình theo dõi đơn'),
    system('Mở kênh cập nhật tức thời cho phiên'),
    decision('Quyền truy cập phiên còn hiệu lực?', 'Đóng kênh và yêu cầu khách tham gia lại phiên'),
    system('Đăng ký nhận tin của đúng bàn và đúng phiên'),
    event('Nhận tin món và đơn của riêng phiên này'),
    system('Cập nhật trạng thái món từ chờ bếp đến đã phục vụ'),
    decision('Kết nối bị gián đoạn?', 'Giữ dữ liệu hiện có và tự kết nối lại', 'Không', 'Có', 'alternate'),
    action('Theo dõi tiến độ mà không thấy dữ liệu bàn khác'),
  ]),
  uc('Khách hàng', 'UC-G07', 'goi-nhan-vien', 'Gọi nhân viên', 'Khách', 'uc-khach-07-goi-nhan-vien.md', [
    action('Nhấn nút gọi nhân viên'),
    system('Kiểm tra quyền truy cập và tìm phiên của bàn'),
    decision('Phiên đang phục vụ?', 'Từ chối vì phiên không còn phục vụ'),
    store('Ghi nhận thời điểm bàn gọi nhân viên'),
    event('Báo tín hiệu gọi tới màn hình phục vụ'),
    action('Nhận thông báo đã gửi yêu cầu'),
    system('Chặn gửi lặp trong khoảng thời gian ngắn'),
  ]),
  uc('Khách hàng', 'UC-G08', 'yeu-cau-thanh-toan', 'Yêu cầu thanh toán', 'Khách', 'uc-khach-08-yeu-cau-thanh-toan.md', [
    action('Nhấn yêu cầu tính tiền'),
    system('Kiểm tra quyền truy cập phiên của khách'),
    decision('Phiên đang phục vụ và có món cần thanh toán?', 'Từ chối yêu cầu không hợp lệ hoặc đã gửi trước đó'),
    store('Chuyển phiên sang chờ thanh toán và ghi thời điểm yêu cầu'),
    event('Báo phục vụ và thu ngân có bàn cần tính tiền'),
    action('Nhận xác nhận đang chờ thanh toán'),
  ]),

  // PHỤC VỤ
  uc('Phục vụ', 'UC-P09', 'mo-phien-walk-in', 'Mở phiên cho khách vãng lai', 'Phục vụ', 'uc-phuc-vu-09-mo-phien-walk-in.md', [
    action('Chọn một bàn trống và yêu cầu mở phiên'),
    system('Kiểm tra quyền phục vụ của nhân viên'),
    decision('Bàn tồn tại và chưa có phiên?', 'Báo bàn không hợp lệ hoặc đang được sử dụng'),
    system('Lấy mã QR đang dùng của bàn và cấp quyền truy cập phiên'),
    store('Mở phiên mới do nhân viên tạo'),
    action('Nhận mã phiên và mở chi tiết bàn'),
  ]),
  uc('Phục vụ', 'UC-P10', 'xem-luoi-ban', 'Xem sơ đồ bàn / lưới bàn', 'Phục vụ', 'uc-phuc-vu-10-luoi-ban.md', [
    action('Mở màn hình lưới bàn'),
    system('Kiểm tra quyền nhân viên'),
    system('Tải khu vực, bàn và phiên hiện tại'),
    decision('Bàn có phiên đang phục vụ?', 'Hiển thị bàn trống kèm trạng thái và sức chứa', 'Có', 'Không', 'alternate'),
    system('Gắn đơn, tổng tiền, tín hiệu gọi và yêu cầu tính tiền vào từng bàn'),
    action('Xem trạng thái toàn bộ bàn và chọn một bàn'),
  ]),
  uc('Phục vụ', 'UC-P11', 'theo-doi-tin-hieu-ban', 'Theo dõi tín hiệu bàn tức thời', 'Phục vụ', 'uc-phuc-vu-11-theo-doi-tin-hieu-ban.md', [
    action('Mở màn hình phục vụ'),
    system('Mở kênh cập nhật tức thời cho nhân viên'),
    decision('Phiên đăng nhập còn hiệu lực?', 'Từ chối hoặc đóng kênh khi phiên đăng nhập bị thu hồi'),
    system('Đăng ký nhận tin của đúng nhà hàng'),
    decision('Có tín hiệu mới từ cổng cập nhật?', 'Tiếp tục chờ tín hiệu', 'Có', 'Không', 'alternate', 0),
    system('Hiển thị tín hiệu gọi nhân viên, món mới hoặc yêu cầu tính tiền lên màn hình'),
    action('Mở đúng bàn cần xử lý'),
  ]),
  uc('Phục vụ', 'UC-P12', 'xac-nhan-goi-nhan-vien', 'Xác nhận gọi nhân viên', 'Phục vụ', 'uc-phuc-vu-12-xac-nhan-goi-nhan-vien.md', [
    action('Chọn bàn đang có tín hiệu gọi'),
    system('Kiểm tra quyền và phiên hiện tại của bàn'),
    decision('Phiên tồn tại và đang có tín hiệu gọi?', 'Trả trạng thái hiện tại; không tạo xác nhận giả'),
    store('Ghi nhận nhân viên đã tiếp nhận tín hiệu'),
    event('Báo các màn hình liên quan tín hiệu đã được nhận'),
    action('Tín hiệu trên lưới bàn tắt'),
  ]),
  uc('Phục vụ', 'UC-P13', 'danh-dau-da-phuc-vu', 'Đánh dấu món đã phục vụ', 'Phục vụ', 'uc-phuc-vu-13-danh-dau-da-phuc-vu.md', [
    action('Chọn món đã sẵn sàng và mang ra bàn'),
    system('Gửi cập nhật món đã phục vụ'),
    decision('Chuyển từ sẵn sàng sang đã phục vụ hợp lệ?', 'Từ chối bước chuyển sai hoặc món đã bị hủy'),
    store('Ghi nhận món đã phục vụ kèm người và thời điểm'),
    event('Báo trạng thái mới cho khách của đúng phiên'),
    action('Món rời khỏi danh sách chờ phục vụ'),
  ]),
  uc('Phục vụ', 'UC-P14', 'yeu-cau-thanh-toan-ho', 'Yêu cầu thanh toán hộ', 'Phục vụ', 'uc-phuc-vu-14-yeu-cau-thanh-toan-ho.md', [
    action('Mở bàn và chọn yêu cầu thanh toán'),
    system('Kiểm tra quyền nhân viên và trạng thái phiên'),
    decision('Phiên đang phục vụ và đủ điều kiện tính tiền?', 'Báo phiên không thể chuyển sang chờ thanh toán'),
    store('Chuyển phiên sang chờ thanh toán'),
    event('Báo thu ngân có phiên cần xử lý'),
    action('Nhận xác nhận đã gửi yêu cầu thanh toán'),
  ]),
  uc('Phục vụ', 'UC-P15', 'chi-tiet-phien-theo-ban', 'Xem chi tiết phiên/đơn theo bàn', 'Phục vụ', 'uc-phuc-vu-15-chi-tiet-phien-theo-ban.md', [
    action('Chọn bàn trên lưới'),
    system('Kiểm tra quyền và tải phiên hiện tại'),
    decision('Bàn có phiên?', 'Hiển thị thông tin bàn trống', 'Có', 'Không', 'alternate'),
    system('Tải các đơn, món, tùy chọn, lịch sử trạng thái và tổng tiền'),
    action('Xem chi tiết, ghi chú và trạng thái từng món'),
  ]),
  uc('Phục vụ', 'UC-P32', 'gop-phien', 'Gộp nhiều phiên/bàn', 'Phục vụ', 'uc-phuc-vu-32-gop-phien.md', [
    action('Chọn ít nhất hai phiên và nhập ghi chú gộp'),
    system('Kiểm tra quyền phục vụ'),
    decision('Đã chọn từ hai phiên khác nhau trở lên?', 'Báo cần chọn tối thiểu hai phiên'),
    system('Kiểm tra trạng thái từng phiên được chọn'),
    decision('Mọi phiên đang phục vụ và chưa thuộc nhóm gộp?', 'Hủy toàn bộ thao tác; báo phiên gây xung đột'),
    store('Lập nhóm bàn gộp và gắn các phiên vào nhóm'),
    event('Báo các màn hình liên quan nhóm bàn vừa gộp'),
    action('Nhận nhóm gộp và danh sách bàn trong nhóm'),
  ]),
  uc('Phục vụ', 'UC-P33', 'tach-phien', 'Tách phiên đã gộp', 'Phục vụ', 'uc-phuc-vu-33-tach-phien.md', [
    action('Chọn nhóm bàn đang gộp và yêu cầu tách'),
    system('Kiểm tra quyền và tìm nhóm gộp còn hiệu lực'),
    decision('Nhóm tồn tại và còn phiên thành viên?', 'Báo nhóm không tồn tại hoặc đã tách'),
    store('Gỡ các phiên khỏi nhóm và đóng nhóm gộp'),
    event('Báo các màn hình liên quan nhóm vừa tách'),
    action('Nhận danh sách phiên độc lập sau khi tách'),
  ]),
  uc('Phục vụ', 'UC-P38A', 'them-mon-mang-ve-tai-ban', 'Thêm món mang về vào phiên tại bàn', 'Phục vụ', 'uc-phuc-vu-38-don-mang-ve.md', [
    action('Chọn phiên tại bàn và thêm các món mang về'),
    system('Kiểm tra quyền và trạng thái phiên'),
    decision('Phiên đang phục vụ?', 'Từ chối thêm món vào phiên chờ thanh toán hoặc đã đóng'),
    system('Kiểm từng món và đánh dấu là món mang về'),
    decision('Mọi món hợp lệ?', 'Báo lỗi từng dòng; không lập đơn'),
    store('Lập đơn gắn vào phiên và chuyển phiếu xuống bếp'),
    event('Báo bếp có món mang về'),
    action('Nhận đơn và tổng mới của phiên'),
  ]),
  uc('Phục vụ', 'UC-P38B', 'don-mang-ve-walk-in', 'Tạo đơn mang về cho khách vãng lai', 'Phục vụ', 'uc-phuc-vu-38-don-mang-ve.md', [
    action('Nhập tên khách, số điện thoại, giờ lấy và các món'),
    system('Kiểm tra quyền nhân viên'),
    decision('Có tên khách và ít nhất một món?', 'Báo thiếu thông tin bắt buộc'),
    system('Kiểm từng món và đánh dấu toàn bộ là mang về'),
    decision('Mọi món hợp lệ?', 'Báo lỗi từng dòng; không lập đơn'),
    store('Lập đơn mang về độc lập và chuyển phiếu xuống bếp'),
    event('Báo bếp chuẩn bị đơn mang về'),
    action('Nhận mã đơn và tổng tiền'),
  ]),

  // BẾP
  uc('Bếp', 'UC-K16', 'hang-doi-mon', 'Tiếp nhận đơn / xem hàng đợi', 'Bếp', 'uc-bep-16-hang-doi-mon.md', [
    action('Mở màn hình hàng đợi bếp'),
    system('Kiểm tra quyền của bếp'),
    system('Tải các phiếu bếp và món đã được nhân viên xác nhận'),
    decision('Có món đang chờ hoặc đang chế biến?', 'Hiển thị hàng đợi trống và chờ tin mới', 'Có', 'Không', 'alternate'),
    system('Nhóm phiếu theo khu chế biến, độ ưu tiên và thời gian'),
    event('Nhận tin khi có món mới được nhân viên xác nhận'),
    action('Chọn phiếu hoặc món để bắt đầu chế biến'),
  ]),
  uc('Bếp', 'UC-K17', 'cap-nhat-trang-thai-mon', 'Cập nhật trạng thái món', 'Bếp', 'uc-bep-17-cap-nhat-trang-thai-mon.md', [
    action('Chọn món trong hàng đợi và trạng thái tiếp theo'),
    system('Kiểm tra quyền và trạng thái hiện tại của món'),
    decision('Bước chuyển trạng thái hợp lệ?', 'Từ chối nhảy bước, lùi bước hoặc sửa món đã kết thúc'),
    store('Ghi trạng thái mới kèm lịch sử thay đổi'),
    system('Ghi mốc thời gian tiếp nhận, bắt đầu và hoàn thành'),
    event('Báo trạng thái mới cho phục vụ và khách của đúng phiên'),
    action('Món chuyển sang cột tương ứng trên hàng đợi'),
  ]),
  uc('Bếp', 'UC-K18', 'xu-ly-yeu-cau-huy-mon', 'Xử lý yêu cầu hủy món', 'Bếp', 'uc-bep-18-xu-ly-yeu-cau-huy-mon.md', [
    action('Mở danh sách yêu cầu hủy đang chờ'),
    system('Chọn một yêu cầu và gửi quyết định'),
    decision('Yêu cầu còn đang chờ xử lý?', 'Báo yêu cầu đã được người khác xử lý'),
    decision('Bếp đồng ý hủy?', 'Từ chối yêu cầu; giữ nguyên món', 'Đồng ý', 'Từ chối', 'alternate', 2),
    store('Chấp nhận yêu cầu và hủy món tương ứng'),
    event('Báo kết quả cho khách và cập nhật hàng đợi'),
    action('Yêu cầu rời khỏi danh sách chờ'),
  ]),
  uc('Bếp', 'UC-K19', 'lich-su-trang-thai-mon', 'Xem lịch sử trạng thái món', 'Bếp', 'uc-bep-19-lich-su-trang-thai-mon.md', [
    action('Mở chi tiết món trong phiếu bếp'),
    system('Kiểm tra quyền và tải lịch sử trạng thái'),
    decision('Món thuộc đúng nhà hàng?', 'Báo không tìm thấy; không lộ dữ liệu nhà hàng khác'),
    system('Sắp xếp các mốc trạng thái theo thời gian'),
    action('Xem người thao tác, vai trò, lý do và thời điểm'),
  ]),
  uc('Bếp', 'UC-K39', 'bao-het-mon', 'Báo món không thể chế biến', 'Bếp', 'uc-bep-39-bao-het-mon.md', [
    action('Chọn món và nhập lý do hết nguyên liệu'),
    system('Kiểm tra quyền và trạng thái hiện tại của món'),
    decision('Món còn có thể báo không chế biến được?', 'Từ chối món đã phục vụ hoặc đã hủy'),
    store('Đánh dấu món không phục vụ được kèm lý do và lịch sử'),
    event('Báo phục vụ và khách của đúng phiên'),
    action('Món rời khỏi hàng đợi chế biến'),
  ]),

  // THU NGÂN
  uc('Thu ngân', 'UC-C20', 'danh-sach-phien-cho-thanh-toan', 'Xem danh sách phiên chờ thanh toán', 'Thu ngân', 'uc-thu-ngan-20-danh-sach-phien-cho-thanh-toan.md', [
    action('Mở màn hình thu ngân'),
    system('Kiểm tra quyền thu ngân'),
    system('Tải các bàn đang chờ thanh toán'),
    decision('Có phiên chờ thanh toán?', 'Hiển thị danh sách trống và chờ cập nhật', 'Có', 'Không', 'alternate'),
    system('Hiển thị bàn, thời gian yêu cầu và tổng tiền dự kiến'),
    action('Chọn một phiên để lập hoặc xem hóa đơn'),
  ]),
  uc('Thu ngân', 'UC-C21', 'xem-hoa-don', 'Lập và xem hóa đơn', 'Thu ngân', 'uc-thu-ngan-21-xem-hoa-don.md', [
    action('Chọn phiên cần thanh toán'),
    system('Tìm hóa đơn hiện có của phiên'),
    decision('Đã có hóa đơn còn hiệu lực?', 'Lập hóa đơn mới, chốt tên và giá món tại thời điểm này', 'Có', 'Chưa', 'alternate'),
    system('Tính tiền hàng, phí phục vụ, thuế, làm tròn và tổng phải trả'),
    store('Lưu và đọc lại hóa đơn đã chốt'),
    action('Xem các dòng tiền và số đã thanh toán'),
  ]),
  uc('Thu ngân', 'UC-C22', 'dieu-chinh-hoa-don', 'Điều chỉnh hóa đơn và giảm giá', 'Thu ngân', 'uc-thu-ngan-22-dieu-chinh-hoa-don-giam-gia.md', [
    action('Nhập số tiền giảm và lý do'),
    system('Kiểm tra quyền và trạng thái hóa đơn'),
    decision('Hóa đơn còn được sửa và mức giảm hợp lệ?', 'Từ chối hóa đơn đã thanh toán, đã hủy hoặc mức giảm vượt giới hạn'),
    store('Ghi khoản giảm và tính lại phí phục vụ, thuế, tổng tiền'),
    event('Ghi nhật ký điều chỉnh và báo các màn hình liên quan'),
    action('Nhận hóa đơn với tổng tiền mới'),
  ]),
  uc('Thu ngân', 'UC-C23', 'xu-ly-thanh-toan', 'Xử lý thanh toán toàn bộ', 'Thu ngân', 'uc-thu-ngan-23-xu-ly-thanh-toan.md', [
    action('Chọn phương thức và nhập số tiền nhận'),
    system('Khóa hóa đơn và tìm phương thức thanh toán đang mở'),
    decision('Hóa đơn chưa thanh toán và số tiền hợp lệ?', 'Từ chối thanh toán trùng hoặc thiếu tiền'),
    decision('Phương thức cần qua cổng thanh toán?', 'Ghi nhận tiền mặt hoặc thẻ, hoàn tất ngay', 'Có', 'Không', 'alternate', 3),
    store('Tạo giao dịch chờ và trả mã QR hoặc liên kết trả tiền'),
    event('Nhận kết quả từ cổng thanh toán, chống ghi nhận trùng'),
    store('Khi đủ tiền: chốt hóa đơn, tính tiền thừa và đóng phiên'),
    action('Nhận kết quả thanh toán và hóa đơn mới'),
  ]),
  uc('Thu ngân', 'UC-C24', 'in-hoa-don', 'In hóa đơn', 'Thu ngân', 'uc-thu-ngan-24-in-hoa-don.md', [
    action('Mở hóa đơn của phiên và chọn xuất bản hóa đơn'),
    system('Tải hóa đơn, các dòng món và các lần thanh toán'),
    decision('Hóa đơn tồn tại?', 'Báo không tìm thấy hóa đơn'),
    system('Dựng bản hóa đơn PDF kèm thông tin nhà hàng, thuế, giảm giá và tổng tiền'),
    action('Xem bản hóa đơn PDF trên màn hình'),
    action('Tải bản PDF về máy nếu cần lưu'),
  ]),
  uc('Thu ngân', 'UC-C25', 'dong-phien', 'Đóng phiên', 'Thu ngân', 'uc-thu-ngan-25-dong-phien.md', [
    action('Chọn đóng phiên sau thanh toán'),
    system('Kiểm tra quyền thu ngân và trạng thái phiên'),
    decision('Phiên đủ điều kiện đóng và không còn công nợ?', 'Từ chối đóng; hiển thị khoản chưa xử lý'),
    store('Đóng phiên kèm người thực hiện và thời điểm'),
    event('Báo các màn hình liên quan và giải phóng bàn'),
    action('Bàn trở về trạng thái sẵn sàng'),
  ]),
  uc('Thu ngân', 'UC-C34', 'tach-hoa-don', 'Tách hóa đơn', 'Thu ngân', 'uc-thu-ngan-34-tach-hoa-don.md', [
    action('Chia các món trong phiên thành ít nhất hai nhóm'),
    system('Gửi phiên và danh sách nhóm cần tách'),
    decision('Các nhóm phủ đúng món, không trùng và có từ hai nhóm?', 'Hủy thao tác; báo nhóm hoặc món không hợp lệ'),
    store('Lập nhiều hóa đơn và phân món theo từng nhóm'),
    event('Báo các màn hình liên quan danh sách hóa đơn con'),
    action('Nhận các hóa đơn con để thanh toán riêng'),
  ]),
  uc('Thu ngân', 'UC-C35', 'thanh-toan-mot-phan', 'Thanh toán một phần', 'Thu ngân', 'uc-thu-ngan-35-thanh-toan-mot-phan.md', [
    action('Nhập số tiền khách đưa và chọn phương thức'),
    system('Khóa hóa đơn và kiểm số tiền phải lớn hơn 0'),
    decision('Phương thức là ví điện tử?', 'Từ chối; ví điện tử phải thanh toán toàn bộ', 'Không', 'Có'),
    decision('Trả dư bằng thẻ hoặc chuyển khoản?', 'Từ chối; khoản dư phải hoàn qua ngân hàng', 'Không', 'Có'),
    store('Ghi nhận tối đa phần còn phải trả; tiền mặt đưa dư tính thành tiền thừa'),
    decision('Đã trả đủ tổng tiền?', 'Giữ hóa đơn ở mức trả một phần và báo số còn lại', 'Đủ', 'Chưa đủ', 'alternate', 2),
    store('Chốt hóa đơn đã thanh toán và tự đóng phiên'),
    event('Báo các màn hình liên quan kết quả thanh toán'),
    action('Nhận tổng đã trả, tiền thừa và trạng thái mới'),
  ]),
  uc('Thu ngân', 'UC-C36', 'huy-hoa-don', 'Hủy hóa đơn', 'Thu ngân', 'uc-thu-ngan-36-huy-hoa-don.md', [
    action('Chọn hóa đơn và nhập lý do hủy'),
    system('Kiểm tra quyền và trạng thái hóa đơn'),
    decision('Hóa đơn được phép hủy?', 'Từ chối hóa đơn đã thanh toán, đã hủy hoặc đang có giao dịch'),
    store('Hủy hóa đơn kèm người thực hiện, thời điểm và lý do'),
    event('Ghi nhật ký hủy và báo các màn hình liên quan'),
    action('Nhận hóa đơn ở trạng thái đã hủy'),
  ]),
  uc('Thu ngân', 'UC-C37', 'mo-lai-phien', 'Mở lại phiên', 'Thu ngân', 'uc-thu-ngan-37-mo-lai-phien.md', [
    action('Chọn phiên đang chờ thanh toán và yêu cầu mở lại'),
    system('Kiểm tra quyền nhân viên và trạng thái phiên'),
    decision('Phiên đang chờ thanh toán và chưa chốt tiền?', 'Từ chối mở lại phiên đã đóng hoặc đã thanh toán'),
    store('Đưa phiên về đang phục vụ và xóa mốc yêu cầu tính tiền'),
    event('Báo các màn hình liên quan phiên vừa mở lại'),
    action('Bàn tiếp tục nhận đơn mới'),
  ]),

  // QUẢN LÝ
  uc('Quản lý', 'UC-M26', 'quan-ly-thuc-don', 'Quản lý thực đơn', 'Quản lý', 'uc-quan-ly-26-quan-ly-thuc-don.md', [
    action('Mở quản lý thực đơn và chọn tạo, sửa hoặc xóa món'),
    system('Kiểm tra quyền quản lý thực đơn'),
    decision('Thông tin món, danh mục, giá và khu chế biến hợp lệ?', 'Báo lỗi dữ liệu; không ghi vào thực đơn'),
    store('Lưu món cùng biến thể và nhóm tùy chọn trong một lần ghi'),
    event('Ghi nhật ký và báo thực đơn vừa thay đổi'),
    action('Danh sách thực đơn cập nhật'),
  ]),
  uc('Quản lý', 'UC-M27', 'bat-tat-con-het', 'Bật/tắt trạng thái còn-hết', 'Quản lý', 'uc-quan-ly-27-bat-tat-con-het.md', [
    action('Chọn món và trạng thái còn hoặc hết'),
    system('Kiểm tra quyền và bản ghi món đang sửa'),
    decision('Trạng thái hợp lệ và bản ghi còn mới nhất?', 'Báo lỗi dữ liệu hoặc có người vừa sửa; yêu cầu tải lại'),
    store('Cập nhật tình trạng còn bán của món'),
    event('Ghi nhật ký và báo thực đơn khách vừa thay đổi'),
    action('Món được bật hoặc tắt trên thực đơn khách'),
  ]),
  uc('Quản lý', 'UC-M28', 'quan-ly-ma-qr', 'Quản lý mã QR theo bàn', 'Quản lý', 'uc-quan-ly-28-quan-ly-ma-qr.md', [
    action('Mở danh sách mã QR và chọn bàn'),
    system('Kiểm tra quyền quản lý bàn'),
    decision('Bàn tồn tại?', 'Báo không tìm thấy bàn'),
    decision('Bàn đã có mã QR và không yêu cầu đổi?', 'Thu hồi mã cũ và sinh mã mới', 'Có', 'Đổi mã / chưa có', 'alternate'),
    system('Trả mã QR đang dùng của bàn'),
    action('Hiển thị hoặc in mã QR; mã cũ mất hiệu lực nếu đã đổi'),
  ]),
  uc('Quản lý', 'UC-M29', 'quan-ly-ban-them', 'Thêm bàn', 'Quản lý', 'uc-quan-ly-29-quan-ly-ban.md', [
    action('Mở quản lý bàn và nhập mã, tên, sức chứa, khu vực'),
    system('Kiểm tra quyền quản lý bàn'),
    decision('Mã, sức chứa và trạng thái hợp lệ?', 'Báo lỗi dữ liệu'),
    store('Tạo bàn mới, trạng thái mặc định AVAILABLE'),
    action('Bàn mới xuất hiện trên lưới bàn'),
  ]),
  uc('Quản lý', 'UC-M29', 'quan-ly-ban-sua', 'Sửa bàn', 'Quản lý', 'uc-quan-ly-29-quan-ly-ban.md', [
    action('Chọn bàn cần sửa và cập nhật thông tin'),
    system('Kiểm tra quyền quản lý bàn'),
    decision('Bàn tồn tại?', 'Báo không tìm thấy bàn'),
    decision('Mã, sức chứa và trạng thái hợp lệ?', 'Báo lỗi dữ liệu'),
    store('Cập nhật thông tin bàn'),
    action('Lưới bàn cập nhật'),
  ]),
  uc('Quản lý', 'UC-M29', 'quan-ly-ban-xoa', 'Xóa bàn', 'Quản lý', 'uc-quan-ly-29-quan-ly-ban.md', [
    action('Chọn bàn và bấm xóa'),
    system('Kiểm tra quyền quản lý bàn'),
    decision('Bàn tồn tại?', 'Báo không tìm thấy bàn'),
    decision('Bàn còn phiên đang phục vụ?', 'Từ chối xóa, yêu cầu đóng phiên trước', 'Không', 'Có'),
    store('Vô hiệu mã QR của bàn và xóa mềm bàn'),
    action('Bàn biến mất khỏi lưới bàn'),
  ]),
  uc('Quản lý', 'UC-M29a', 'quan-ly-khu-vuc-them', 'Thêm khu vực', 'Quản lý', 'uc-quan-ly-29a-quan-ly-khu-vuc.md', [
    action('Mở quản lý khu vực và nhập tên, mô tả, thứ tự hiển thị'),
    system('Kiểm tra quyền quản lý khu vực'),
    decision('Tên hợp lệ (bắt buộc, tối đa 100 ký tự)?', 'Báo lỗi tên'),
    store('Tạo khu vực mới, đặt trạng thái hoạt động'),
    action('Khu vực mới xuất hiện trong danh sách'),
  ]),
  uc('Quản lý', 'UC-M29a', 'quan-ly-khu-vuc-sua', 'Sửa khu vực', 'Quản lý', 'uc-quan-ly-29a-quan-ly-khu-vuc.md', [
    action('Chọn khu vực cần sửa và cập nhật thông tin, trạng thái'),
    system('Kiểm tra quyền quản lý khu vực'),
    decision('Khu vực tồn tại?', 'Báo không tìm thấy khu vực'),
    decision('Tên hợp lệ (bắt buộc, tối đa 100 ký tự)?', 'Báo lỗi tên'),
    store('Cập nhật khu vực và tăng version'),
    action('Danh sách khu vực cập nhật'),
  ]),
  uc('Quản lý', 'UC-M29a', 'quan-ly-khu-vuc-xoa', 'Xóa khu vực', 'Quản lý', 'uc-quan-ly-29a-quan-ly-khu-vuc.md', [
    action('Chọn khu vực và bấm xóa'),
    system('Kiểm tra quyền quản lý khu vực'),
    store('Xóa mềm khu vực: đánh dấu đã xóa và tắt hoạt động'),
    action('Khu vực biến mất khỏi danh sách'),
  ]),
  uc('Quản lý', 'UC-M30', 'quan-ly-nguoi-dung-them', 'Thêm người dùng', 'Quản lý', 'uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md', [
    action('Bấm thêm nhân viên và nhập tài khoản, họ tên, liên hệ, vai trò, mật khẩu'),
    system('Kiểm tra phiên đăng nhập và quyền quản lý người dùng'),
    decision('Tên đăng nhập, họ tên và mật khẩu hợp lệ?', 'Báo dữ liệu không hợp lệ; mật khẩu phải có ít nhất 8 ký tự'),
    decision('Vai trò được chọn tồn tại?', 'Báo vai trò không tồn tại'),
    system('Chuẩn hóa tên đăng nhập, email và số điện thoại; băm mật khẩu'),
    decision('Tên đăng nhập, email và số điện thoại chưa được dùng?', 'Báo tài khoản hoặc thông tin liên hệ đã tồn tại'),
    store('Tạo tài khoản mới với trạng thái ACTIVE'),
    event('Ghi sự kiện quản trị không chứa mật khẩu và không phát realtime'),
    action('Danh sách người dùng hiển thị tài khoản mới'),
  ]),
  uc('Quản lý', 'UC-M30', 'quan-ly-nguoi-dung-sua', 'Sửa thông tin và phân quyền người dùng', 'Quản lý', 'uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md', [
    action('Chọn người dùng và sửa họ tên, email, số điện thoại hoặc vai trò'),
    system('Kiểm tra phiên đăng nhập và quyền quản lý người dùng'),
    decision('Có ít nhất một trường dữ liệu hợp lệ để cập nhật?', 'Báo không có dữ liệu cần cập nhật'),
    decision('Có đang tự đổi vai trò của chính mình?', 'Từ chối đổi vai trò của chính mình', 'Không', 'Có'),
    decision('Vai trò mới nếu có tồn tại?', 'Báo vai trò không tồn tại'),
    decision('Người dùng tồn tại trong nhà hàng?', 'Báo không tìm thấy người dùng'),
    store('Cập nhật hồ sơ, vai trò và tăng version người dùng'),
    event('Ghi sự kiện quản trị và không phát realtime'),
    action('Danh sách người dùng hiển thị thông tin mới'),
  ]),
  uc('Quản lý', 'UC-M30', 'quan-ly-nguoi-dung-trang-thai', 'Vô hiệu hóa hoặc kích hoạt tài khoản', 'Quản lý', 'uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md', [
    action('Chọn Vô hiệu hóa hoặc Kích hoạt; nhập tên đăng nhập để xác nhận khi vô hiệu hóa'),
    system('Kiểm tra phiên đăng nhập và quyền quản lý người dùng'),
    decision('Xác nhận thao tác hợp lệ?', 'Giữ nguyên tài khoản và yêu cầu xác nhận lại'),
    decision('Có đang đổi trạng thái tài khoản của chính mình?', 'Từ chối để tránh tự mất quyền truy cập', 'Không', 'Có'),
    decision('Trạng thái đích là ACTIVE hoặc INACTIVE?', 'Báo trạng thái không hợp lệ'),
    decision('Người dùng tồn tại trong nhà hàng?', 'Báo không tìm thấy người dùng'),
    store('Cập nhật trạng thái và tăng version người dùng'),
    event('Ghi sự kiện quản trị và không phát realtime'),
    action('Danh sách người dùng hiển thị trạng thái mới'),
  ]),
  uc('Quản lý', 'UC-M30', 'quan-ly-nguoi-dung-dat-lai-mat-khau', 'Đặt lại mật khẩu người dùng', 'Quản lý', 'uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen.md', [
    action('Chọn người dùng, nhập mật khẩu mới và xác nhận đặt lại'),
    system('Kiểm tra phiên đăng nhập và quyền quản lý người dùng'),
    decision('Mật khẩu mới có ít nhất 8 ký tự?', 'Báo mật khẩu không hợp lệ'),
    system('Băm mật khẩu mới bằng bcrypt'),
    decision('Người dùng tồn tại trong nhà hàng?', 'Báo không tìm thấy người dùng'),
    store('Lưu mật khẩu mới, xóa bộ đếm đăng nhập sai và thời hạn khóa tạm thời'),
    event('Ghi sự kiện quản trị không chứa mật khẩu và không phát realtime'),
    action('Nhận xác nhận đã đặt lại mật khẩu'),
  ]),
  uc('Quản lý', 'UC-M31', 'bao-cao-thong-ke', 'Xem báo cáo và thống kê', 'Quản lý', 'uc-quan-ly-31-bao-cao-thong-ke.md', [
    action('Mở báo cáo và chọn khoảng thời gian, bộ lọc'),
    system('Kiểm tra quyền xem báo cáo'),
    system('Tổng hợp phiên, doanh thu, hóa đơn và món đã bán'),
    decision('Dữ liệu và bộ lọc hợp lệ?', 'Hiển thị trạng thái không có dữ liệu hoặc lỗi tải báo cáo'),
    system('Tính các chỉ số và trả số liệu báo cáo'),
    action('Xem báo cáo, biểu đồ và số liệu tổng hợp'),
  ]),
]

const groups = ['Khách hàng', 'Phục vụ', 'Bếp', 'Thu ngân', 'Quản lý']

function escapeXML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

const ACTION_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=13;'
const FINAL_STYLE = 'ellipse;shape=doubleEllipse;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;'
const COMPACT_GROUPS = new Set(['Bếp', 'Thu ngân', 'Quản lý'])

function cell(id, value, style, x, y, width, height, extra = '') {
  return `<mxCell id="${id}" value="${escapeXML(value)}" style="${style}" parent="1" vertex="1"${extra}><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`
}

function compactCell(id, value, style, parent, x, y, width, height) {
  return `<mxCell id="${id}" value="${escapeXML(value)}" style="${style}" parent="${parent}" vertex="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`
}

// ponytail: control flow trong UML luôn nét liền, không có tham số dashed.
function edge(id, source, target, label = '') {
  const style = [
    'edgeStyle=orthogonalEdgeStyle',
    'rounded=1',
    'orthogonalLoop=1',
    'jettySize=auto',
    'html=1',
    'endArrow=block',
    'endFill=1',
    'strokeWidth=2',
  ].join(';')
  return `<mxCell id="${id}" value="${escapeXML(label)}" style="${style}" parent="1" source="${source}" target="${target}" edge="1"><mxGeometry relative="1" as="geometry"/></mxCell>`
}

function compactDiagramXML(definition) {
  const positions = []
  let currentY = 92

  definition.steps.forEach((step, index) => {
    if (index > 0) {
      const previous = definition.steps[index - 1]
      const initialLaneHandoff = index === 1 && previous.lane === 'actor' && step.lane === 'system'
      if (!initialLaneHandoff) currentY += previous.type === 'decision' ? 120 : 94
    }
    positions.push(currentY)
  })

  const last = definition.steps.at(-1)
  const lastY = positions.at(-1)
  const endY = last.lane === 'actor' ? lastY + 16 : lastY + (last.type === 'decision' ? 120 : 94)
  const laneHeight = Math.max(600, endY + 60)
  const pageHeight = Math.max(720, laneHeight + 140)
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
    compactCell(
      'title',
      `${definition.id} — SƠ ĐỒ HOẠT ĐỘNG: ${definition.title.toUpperCase()}`,
      'text;html=1;align=center;verticalAlign=middle;fontSize=20;fontStyle=1;strokeColor=none;fillColor=none;fontColor=#000000;',
      '1',
      50, 14, 1100, 42,
    ),
    compactCell(
      'actor-lane',
      `Tác nhân: ${definition.actor}`,
      'swimlane;html=1;horizontal=1;startSize=34;fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontStyle=1;fontSize=14;',
      '1',
      60, 68, 300, laneHeight,
    ),
    compactCell(
      'system-lane',
      'Hệ thống',
      'swimlane;html=1;horizontal=1;startSize=34;fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontStyle=1;fontSize=14;',
      '1',
      360, 68, 640, laneHeight,
    ),
    compactCell(
      'start',
      '',
      'ellipse;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;',
      '1',
      168, 110, 26, 26,
    ),
  ]
  const edges = []
  let previous = 'start'
  let edgeIndex = 0

  definition.steps.forEach((step, index) => {
    const id = `step-${index + 1}`
    const y = positions[index]
    const parent = step.lane === 'actor' ? 'actor-lane' : 'system-lane'
    let x = step.lane === 'actor' ? 20 : 72.5
    let width = step.lane === 'actor' ? 220 : 240
    let height = 64
    let style = ACTION_STYLE

    if (step.type === 'decision') {
      x = 42.5
      width = 300
      height = 84
      style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=13;fontStyle=1;'
    }

    cells.push(compactCell(id, step.text, style, parent, x, y, width, height))
    const mainLabel = previous.startsWith('step-') && definition.steps[index - 1]?.type === 'decision'
      ? definition.steps[index - 1].mainLabel
      : ''
    edges.push(edge(`edge-${++edgeIndex}`, previous, id, mainLabel))

    if (step.type === 'decision') {
      const alternateID = `alternate-${index + 1}`
      cells.push(compactCell(alternateID, step.alternate, ACTION_STYLE, 'system-lane', 440, y + 8, 180, 68))
      edges.push(edge(`edge-${++edgeIndex}`, id, alternateID, step.alternateLabel))

      if (step.alternateKind === 'error') {
        const alternateEndID = `alternate-end-${index + 1}`
        cells.push(compactCell(alternateEndID, '', FINAL_STYLE, 'system-lane', 600, y + 27, 30, 30))
        edges.push(edge(`edge-${++edgeIndex}`, alternateID, alternateEndID))
      } else {
        const target = index + step.skip
        const rejoin = target < definition.steps.length ? `step-${target + 1}` : 'end'
        edges.push(edge(`edge-${++edgeIndex}`, alternateID, rejoin))
      }
    }
    previous = id
  })

  cells.push(compactCell('end', '', FINAL_STYLE, 'system-lane', 312.5, endY, 32, 32))
  edges.push(edge(`edge-${++edgeIndex}`, previous, 'end', last.type === 'decision' ? last.mainLabel : ''))

  return `<diagram id="${escapeXML(definition.id.toLowerCase())}" name="${escapeXML(`${definition.id} — ${definition.title}`)}"><mxGraphModel dx="1200" dy="${pageHeight}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="${pageHeight}" background="#ffffff" math="0" shadow="0"><root>${[...cells, ...edges].join('')}</root></mxGraphModel></diagram>`
}

function diagramXML(definition) {
  if (COMPACT_GROUPS.has(definition.group)) return compactDiagramXML(definition)

  const startY = 132
  const rowHeight = 108
  const endY = startY + (definition.steps.length + 1) * rowHeight
  const pageHeight = Math.max(920, endY + 100)
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
    cell(
      'title',
      `${definition.id} — SƠ ĐỒ HOẠT ĐỘNG: ${definition.title.toUpperCase()}`,
      'text;html=1;align=center;verticalAlign=middle;fontSize=20;fontStyle=1;strokeColor=none;fillColor=none;fontColor=#000000;',
      50, 14, 1100, 42,
    ),
    cell(
      'actor-lane',
      `Tác nhân: ${definition.actor}`,
      'swimlane;html=1;horizontal=1;startSize=34;fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontStyle=1;fontSize=14;',
      20, 68, 340, pageHeight - 86,
    ),
    cell(
      'system-lane',
      'Hệ thống',
      'swimlane;html=1;horizontal=1;startSize=34;fillColor=#ffffff;swimlaneFillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontStyle=1;fontSize=14;',
      360, 68, 820, pageHeight - 86,
    ),
    cell(
      'start',
      '',
      'ellipse;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;',
      168, 92, 26, 26,
    ),
  ]
  const edges = []
  let previous = 'start'
  let edgeIndex = 0

  definition.steps.forEach((step, index) => {
    const id = `step-${index + 1}`
    const y = startY + index * rowHeight
    const isActor = step.lane === 'actor'
    let x = isActor ? 55 : 445
    let width = isActor ? 270 : 390
    let height = 64
    let style

    // ponytail: UML activity chỉ có action bo tròn + decision hình thoi.
    // store/event vẫn là action, chỉ khác nội dung chữ.
    if (step.type === 'decision') {
      x = 480
      width = 300
      height = 84
      style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=13;fontStyle=1;'
    } else {
      style = ACTION_STYLE
    }

    cells.push(cell(id, step.text, style, x, y, width, height))
    const mainLabel = previous.startsWith('step-') && definition.steps[index - 1]?.type === 'decision'
      ? definition.steps[index - 1].mainLabel
      : ''
    edges.push(edge(`edge-${++edgeIndex}`, previous, id, mainLabel))

    if (step.type === 'decision') {
      const alternateID = `alternate-${index + 1}`
      cells.push(cell(alternateID, step.alternate, ACTION_STYLE, 875, y + 4, 225, 68))
      edges.push(edge(`edge-${++edgeIndex}`, id, alternateID, step.alternateLabel))

      if (step.alternateKind === 'error') {
        // Nhánh lỗi: kết thúc bằng activity final riêng.
        const alternateEndID = `alternate-end-${index + 1}`
        cells.push(cell(alternateEndID, '', FINAL_STYLE, 1125, y + 23, 30, 30))
        edges.push(edge(`edge-${++edgeIndex}`, alternateID, alternateEndID))
      } else {
        // Nhánh thay thế hợp lệ: nhập lại luồng chính, bỏ qua step.skip bước.
        const target = index + step.skip
        const rejoin = target < definition.steps.length ? `step-${target + 1}` : 'end'
        edges.push(edge(`edge-${++edgeIndex}`, alternateID, rejoin))
      }
    }
    previous = id
  })

  cells.push(cell('end', '', FINAL_STYLE, 625, endY, 32, 32))
  const last = definition.steps.at(-1)
  edges.push(edge(`edge-${++edgeIndex}`, previous, 'end', last?.type === 'decision' ? last.mainLabel : ''))

  return `<diagram id="${escapeXML(definition.id.toLowerCase())}" name="${escapeXML(`${definition.id} — ${definition.title}`)}"><mxGraphModel dx="1200" dy="${pageHeight}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="${pageHeight}" math="0" shadow="0"><root>${[...cells, ...edges].join('')}</root></mxGraphModel></diagram>`
}

function mxfile(contents) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-07-23T00:00:00.000Z" agent="Codex activity diagram generator" version="24.7.17" type="device">${contents}</mxfile>\n`
}

function fileName(definition) {
  return `activity-${definition.id.toLowerCase()}-${definition.slug}.drawio`
}

function buildReadme() {
  const lines = [
    '# Sơ đồ hoạt động các use case',
    '',
    `Tổng cộng **${diagrams.length} sơ đồ hoạt động**. Mỗi use case có một file Draw.io riêng và tất cả được gom trong file nhiều trang [restaurant-use-cases-activity-diagrams.drawio](./restaurant-use-cases-activity-diagrams.drawio).`,
    '',
    'Ký hiệu:',
    '',
    '- Sơ đồ chỉ dùng đen–trắng; swimlane bên trái là hành động của tác nhân.',
    '- Swimlane Hệ thống: kiểm tra nghiệp vụ, xử lý dữ liệu và phát thông báo realtime.',
    '- Chấm đen: điểm bắt đầu; vòng tròn kép: điểm kết thúc.',
    '- Hình chữ nhật bo tròn: hành động; hình thoi: điều kiện rẽ nhánh (có nhãn guard).',
    '- Mọi luồng điều khiển đều là nét liền theo chuẩn UML.',
    '- Nhánh thay thế hợp lệ quay lại luồng chính; chỉ nhánh lỗi mới kết thúc riêng.',
    '',
    'File đã mở và chỉnh tay bằng Draw.io sẽ được script giữ nguyên, không sinh đè.',
    '',
  ]
  for (const group of groups) {
    lines.push(`## ${group}`, '', '| Mã | Use case | Activity diagram | Đặc tả nguồn |', '|---|---|---|---|')
    for (const item of diagrams.filter((diagram) => diagram.group === group)) {
      lines.push(`| ${item.id} | ${item.title} | [Mở Draw.io](./${fileName(item)}) | [Đặc tả](../use-cases/${item.source}) |`)
    }
    lines.push('')
  }
  lines.push(
    '## Sinh lại file',
    '',
    '```bash',
    'node scripts/generate-activity-diagrams.mjs   # sinh lại (giữ nguyên file đã sửa tay)',
    'node scripts/check-activity-diagrams.mjs      # kiểm tra luồng: không node mồ côi, không ngõ cụt',
    '```',
    '',
    'Các file `.drawio` dùng XML không nén để dễ review bằng Git.',
    '',
  )
  return `${lines.join('\n')}\n`
}

const GENERATOR_TAG = 'Codex activity diagram generator'

// File nào đã mở bằng Draw.io và sửa tay thì mất tag generator -> giữ nguyên,
// và file gộp lấy luôn trang từ bản sửa tay đó thay vì sinh đè.
function manualDiagram(path) {
  if (!existsSync(path)) return null
  const content = readFileSync(path, 'utf8')
  if (content.includes(GENERATOR_TAG)) return null
  const start = content.indexOf('<diagram')
  const stop = content.lastIndexOf('</diagram>')
  return start === -1 || stop === -1 ? null : content.slice(start, stop + '</diagram>'.length)
}

mkdirSync(outputDir, { recursive: true })
const pages = []
const kept = []
for (const definition of diagrams) {
  const path = resolve(outputDir, fileName(definition))
  const manual = manualDiagram(path)
  if (manual) {
    pages.push(manual)
    kept.push(fileName(definition))
    continue
  }
  const page = diagramXML(definition)
  pages.push(page)
  writeFileSync(path, mxfile(page))
}
writeFileSync(combinedPath, mxfile(pages.join('')))
writeFileSync(resolve(outputDir, 'README.md'), buildReadme())

console.log(`Generated ${diagrams.length - kept.length} activity diagrams, kept ${kept.length} manual: ${kept.join(', ') || '(none)'}`)
console.log(`Generated combined file: ${combinedPath}`)
