#!/usr/bin/env python3
"""Sinh sơ đồ đặc tả use-case (.drawio) cho từng file docs/use-cases/*.md.

Bố cục mỗi sơ đồ:
    [tác nhân chính]  ->  ((USE-CASE CHÍNH))  --«include»-->  ((thao tác con))
                                              --«extend»---   ((mở rộng))
                          ....liên quan (nét đứt, xám) -> ((UC kế tiếp/trước))
"""
import html
import os
import xml.sax.saxutils as su

OUT_DIR = os.path.join(os.path.dirname(__file__))

# ── Khung dữ liệu ───────────────────────────────────────────────────────────
# stem: (tiêu đề sơ đồ, actor chính, [actor phụ], use-case chính,
#        [include], [extend], [(nhãn, uc liên quan)])
SPECS = {
"uc-khach-01-quet-qr-vao-phien": (
  "ĐẶC TẢ USE-CASE KHÁCH — QUÉT QR VÀO PHIÊN", "Khách", [],
  "Quét QR vào phiên",
  ["Kiểm tra mã QR", "Ghi nhật ký quét QR"],
  ["Mở phiên cho khách\n(Phục vụ)"],
  [("dẫn sang", "Xem thực đơn\n(UC-02)")]),

"uc-khach-02-xem-thuc-don": (
  "ĐẶC TẢ USE-CASE KHÁCH — XEM THỰC ĐƠN", "Khách", [],
  "Xem thực đơn",
  ["Lấy danh mục & danh sách món", "Xem chi tiết món"],
  ["Cập nhật trạng thái còn/hết\n(Quản lý — realtime)"],
  [("tiếp nối", "Quét QR vào phiên\n(UC-01)"), ("dẫn sang", "Đặt món\n(UC-03)")]),

"uc-khach-03-dat-mon": (
  "ĐẶC TẢ USE-CASE KHÁCH — ĐẶT MÓN", "Khách", ["Bếp"],
  "Đặt món",
  ["Kiểm phiên ACTIVE", "Kiểm món còn hàng", "Đẩy ticket cho Bếp"],
  [],
  [("tiếp nối", "Xem thực đơn\n(UC-02)"), ("dẫn sang", "Theo dõi trạng thái món\n(UC-06)")]),

"uc-khach-04-goi-them-mon": (
  "ĐẶC TẢ USE-CASE KHÁCH — GỌI THÊM MÓN", "Khách", ["Bếp"],
  "Gọi thêm món",
  ["Kiểm phiên ACTIVE", "Kiểm món còn hàng", "Đẩy ticket cho Bếp"],
  [],
  [("tiếp nối", "Đặt món\n(UC-03)"), ("dẫn sang", "Theo dõi trạng thái món\n(UC-06)")]),

"uc-khach-05a-sua-mon-da-goi": (
  "ĐẶC TẢ USE-CASE KHÁCH — SỬA MÓN ĐÃ GỌI", "Khách", [],
  "Sửa món đã gọi",
  ["Đọc trạng thái món theo version\n(khóa lạc quan)"],
  ["Hủy món đã gọi\n(UC-05b) — khi món đã ACKNOWLEDGED+"],
  [("tiếp nối", "Theo dõi trạng thái món\n(UC-06)")]),

"uc-khach-05b-huy-mon-da-goi": (
  "ĐẶC TẢ USE-CASE KHÁCH — HỦY MÓN ĐÃ GỌI", "Khách", ["Bếp"],
  "Hủy món đã gọi",
  ["Đọc trạng thái món theo version", "Tạo yêu cầu hủy\n(khi ACKNOWLEDGED/PREPARING)"],
  ["Xác nhận / từ chối yêu cầu hủy\n(Bếp — UC-18)"],
  [("tiếp nối", "Sửa món đã gọi\n(UC-05a)")]),

"uc-khach-06-theo-doi-trang-thai-mon": (
  "ĐẶC TẢ USE-CASE KHÁCH — THEO DÕI TRẠNG THÁI MÓN", "Khách", [],
  "Theo dõi trạng thái món",
  ["Lấy món đã gọi của phiên"],
  ["Cập nhật trạng thái món\n(Bếp/Phục vụ — realtime)"],
  [("tiếp nối", "Đặt món / Gọi thêm món\n(UC-03, UC-04)")]),

"uc-khach-07-goi-nhan-vien": (
  "ĐẶC TẢ USE-CASE KHÁCH — GỌI NHÂN VIÊN", "Khách", ["Phục vụ"],
  "Gọi nhân viên",
  ["Đặt cờ gọi NV cho phiên", "Đẩy realtime cho Phục vụ"],
  [],
  [("dẫn sang", "Xác nhận gọi nhân viên\n(UC-12)")]),

"uc-khach-08-yeu-cau-thanh-toan": (
  "ĐẶC TẢ USE-CASE KHÁCH — YÊU CẦU THANH TOÁN", "Khách", ["Thu ngân"],
  "Yêu cầu thanh toán",
  ["Khóa order của phiên\n(→ AWAITING_PAYMENT)", "Đẩy realtime cho Thu ngân/Phục vụ"],
  [],
  [("dẫn sang", "Xem hóa đơn\n(UC-21)")]),

"uc-phuc-vu-09-mo-phien-walk-in": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — MỞ PHIÊN WALK-IN", "Phục vụ", [],
  "Mở phiên cho khách vãng lai",
  ["Kiểm bàn có phiên ACTIVE chưa", "Cấp session_token"],
  ["Đóng phiên cũ còn treo\n(rồi mở lại)"],
  [("dẫn sang", "Gọi món hộ / Khách quét QR\n(UC-01)")]),

"uc-phuc-vu-10-luoi-ban": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — LƯỚI BÀN", "Phục vụ", [],
  "Xem sơ đồ / lưới bàn",
  ["Lấy bàn + trạng thái + tín hiệu"],
  [],
  [("dẫn sang", "Theo dõi tín hiệu bàn\n(UC-11)"), ("dẫn sang", "Chi tiết phiên theo bàn\n(UC-15)")]),

"uc-phuc-vu-11-theo-doi-tin-hieu-ban": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — THEO DÕI TÍN HIỆU BÀN", "Phục vụ", [],
  "Theo dõi tín hiệu bàn",
  ["Nhận realtime: món READY", "Nhận realtime: gọi nhân viên", "Nhận realtime: yêu cầu tính tiền"],
  [],
  [("tiếp nối", "Lưới bàn\n(UC-10)"), ("dẫn sang", "Xác nhận gọi NV\n(UC-12)"),
   ("dẫn sang", "Đánh dấu đã phục vụ\n(UC-13)")]),

"uc-phuc-vu-12-xac-nhan-goi-nhan-vien": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — XÁC NHẬN GỌI NHÂN VIÊN", "Phục vụ", [],
  "Xác nhận gọi nhân viên",
  ["Xóa cờ gọi của phiên", "Phát realtime cho phục vụ khác"],
  [],
  [("tiếp nối", "Theo dõi tín hiệu bàn\n(UC-11)"), ("nguồn tín hiệu", "Gọi nhân viên\n(UC-07)")]),

"uc-phuc-vu-13-danh-dau-da-phuc-vu": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — ĐÁNH DẤU ĐÃ PHỤC VỤ", "Phục vụ", ["Khách"],
  "Đánh dấu đã phục vụ\n(READY → SERVED)",
  ["Ghi lịch sử trạng thái (audit)", "Phát realtime cho Khách"],
  [],
  [("tiếp nối", "Theo dõi tín hiệu bàn\n(UC-11)")]),

"uc-phuc-vu-14-yeu-cau-thanh-toan-ho": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — YÊU CẦU THANH TOÁN HỘ", "Phục vụ", ["Thu ngân"],
  "Yêu cầu thanh toán hộ",
  ["Khóa order của phiên\n(→ AWAITING_PAYMENT)", "Đẩy realtime cho Thu ngân"],
  [],
  [("dùng chung", "Yêu cầu thanh toán\n(UC-08)"), ("dẫn sang", "Xem hóa đơn\n(UC-21)")]),

"uc-phuc-vu-15-chi-tiet-phien-theo-ban": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — CHI TIẾT PHIÊN THEO BÀN", "Phục vụ", [],
  "Xem chi tiết phiên / đơn theo bàn",
  ["Lấy đơn + order_item + trạng thái"],
  [],
  [("tiếp nối", "Lưới bàn\n(UC-10)")]),

"uc-phuc-vu-32-gop-phien": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — GỘP PHIÊN", "Phục vụ", [],
  "Gộp phiên",
  ["Kiểm phiên ACTIVE &\nchưa thuộc nhóm gộp", "Tạo merge_group"],
  [],
  [("nghịch đảo", "Tách phiên\n(UC-33)"), ("dẫn sang", "Xem hóa đơn gộp\n(UC-21)")]),

"uc-phuc-vu-33-tach-phien": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — TÁCH PHIÊN", "Phục vụ", [],
  "Tách phiên",
  ["Kiểm nhóm gộp còn hiệu lực", "Vô hiệu merge_group"],
  [],
  [("nghịch đảo", "Gộp phiên\n(UC-32)")]),

"uc-phuc-vu-38-don-mang-ve": (
  "ĐẶC TẢ USE-CASE PHỤC VỤ — ĐƠN MANG VỀ", "Phục vụ", ["Bếp"],
  "Đơn mang về tại bàn\n(is_takeaway trong phiên)",
  ["Kiểm phiên ACTIVE", "Đẩy ticket cho Bếp"],
  ["Đơn mang về walk-in\n(không gắn phiên)"],
  [("tính chung", "Xem hóa đơn\n(UC-21)")]),

"uc-bep-16-hang-doi-mon": (
  "ĐẶC TẢ USE-CASE BẾP — HÀNG ĐỢI MÓN", "Bếp", [],
  "Xem hàng đợi món",
  ["Lấy order_item chưa hoàn tất", "Nhận ticket realtime món mới"],
  [],
  [("nguồn ticket", "Đặt món / Gọi thêm món\n(UC-03, UC-04)"),
   ("dẫn sang", "Cập nhật trạng thái món\n(UC-17)")]),

"uc-bep-17-cap-nhat-trang-thai-mon": (
  "ĐẶC TẢ USE-CASE BẾP — CẬP NHẬT TRẠNG THÁI MÓN", "Bếp", ["Khách", "Phục vụ"],
  "Cập nhật trạng thái món\n(PENDING → ACKNOWLEDGED\n→ PREPARING → READY)",
  ["Ghi lịch sử trạng thái", "Phát realtime cho Khách/Phục vụ"],
  ["Bấm nhanh \"cả đơn\"\n(áp cho từng món)"],
  [("tiếp nối", "Hàng đợi món\n(UC-16)"), ("dẫn sang", "Đánh dấu đã phục vụ\n(UC-13)")]),

"uc-bep-18-xu-ly-yeu-cau-huy-mon": (
  "ĐẶC TẢ USE-CASE BẾP — DUYỆT YÊU CẦU HỦY MÓN", "Bếp", ["Khách"],
  "Xác nhận / từ chối\nyêu cầu hủy món",
  ["Đọc yêu cầu hủy", "Cập nhật món + yêu cầu\n(một transaction)", "Phát realtime cho Khách"],
  [],
  [("nguồn yêu cầu", "Hủy món đã gọi\n(UC-05b)")]),

"uc-bep-19-lich-su-trang-thai-mon": (
  "ĐẶC TẢ USE-CASE BẾP — LỊCH SỬ TRẠNG THÁI MÓN", "Bếp", [],
  "Xem lịch sử trạng thái món",
  ["Lấy order_item_status_history"],
  [],
  [("tiếp nối", "Hàng đợi món\n(UC-16)")]),

"uc-bep-39-bao-het-mon": (
  "ĐẶC TẢ USE-CASE BẾP — BÁO HẾT MÓN", "Bếp", ["Khách", "Phục vụ"],
  "Báo hết món\n(order_item → UNAVAILABLE)",
  ["Ghi lịch sử trạng thái", "Phát realtime cho Khách/Phục vụ"],
  [],
  [("tiếp nối", "Hàng đợi món\n(UC-16)"),
   ("khác với", "Bật/tắt còn-hết thực đơn\n(UC-27, Quản lý)")]),

"uc-thu-ngan-20-danh-sach-phien-cho-thanh-toan": (
  "ĐẶC TẢ USE-CASE THU NGÂN — DANH SÁCH PHIÊN CHỜ THANH TOÁN", "Thu ngân", [],
  "Xem danh sách phiên\nchờ thanh toán",
  ["Lấy trạng thái bàn/phiên"],
  [],
  [("nguồn tín hiệu", "Yêu cầu thanh toán\n(UC-08)"), ("dẫn sang", "Xem hóa đơn\n(UC-21)")]),

"uc-thu-ngan-21-xem-hoa-don": (
  "ĐẶC TẢ USE-CASE THU NGÂN — XEM HÓA ĐƠN", "Thu ngân", [],
  "Xem hóa đơn",
  ["Lập hóa đơn (snapshot)\n— idempotent"],
  [],
  [("tiếp nối", "Chọn phiên\n(UC-20)"), ("dẫn sang", "Điều chỉnh hóa đơn\n(UC-22)"),
   ("dẫn sang", "Xử lý thanh toán\n(UC-23)")]),

"uc-thu-ngan-22-dieu-chinh-hoa-don-giam-gia": (
  "ĐẶC TẢ USE-CASE THU NGÂN — ĐIỀU CHỈNH HÓA ĐƠN & GIẢM GIÁ", "Thu ngân", [],
  "Điều chỉnh hóa đơn & giảm giá",
  ["Kiểm hóa đơn chưa thanh toán", "Tính lại tổng +\nghi log điều chỉnh"],
  [],
  [("tiếp nối", "Xem hóa đơn\n(UC-21)"), ("dẫn sang", "Xử lý thanh toán\n(UC-23)")]),

"uc-thu-ngan-23-xu-ly-thanh-toan": (
  "ĐẶC TẢ USE-CASE THU NGÂN — XỬ LÝ THANH TOÁN", "Thu ngân", ["Cổng thanh toán"],
  "Xử lý thanh toán",
  ["Ghi giao dịch &\ncập nhật hóa đơn",
   "Khởi tạo giao dịch cổng\n(ví điện tử — pha 1)",
   "Xác thực webhook\n(ví điện tử — pha 2, idempotent)"],
  [],
  [("tiếp nối", "Lập hóa đơn / Điều chỉnh\n(UC-21, UC-22)"),
   ("dẫn sang", "In hóa đơn\n(UC-24)"), ("dẫn sang", "Đóng phiên\n(UC-25)")]),

"uc-thu-ngan-24-in-hoa-don": (
  "ĐẶC TẢ USE-CASE THU NGÂN — IN HÓA ĐƠN", "Thu ngân", [],
  "In hóa đơn",
  ["Lấy hóa đơn snapshot\n(invoice + invoice_items)"],
  [],
  [("tiếp nối", "Xử lý thanh toán\n(UC-23)")]),

"uc-thu-ngan-25-dong-phien": (
  "ĐẶC TẢ USE-CASE THU NGÂN — ĐÓNG PHIÊN", "Thu ngân", [],
  "Đóng phiên\n(→ CLOSED, bàn AVAILABLE)",
  ["Kiểm ràng buộc đóng phiên\n(hóa đơn đã PAID/VOID)"],
  [],
  [("tiếp nối", "Xử lý thanh toán\n(UC-23)")]),

"uc-thu-ngan-34-tach-hoa-don": (
  "ĐẶC TẢ USE-CASE THU NGÂN — TÁCH HÓA ĐƠN", "Thu ngân", [],
  "Tách hóa đơn",
  ["Gán món vào nhóm", "Lập nhiều hóa đơn con\n(giữ snapshot)"],
  [],
  [("tiếp nối", "Xem hóa đơn\n(UC-21)"),
   ("dẫn sang", "Thanh toán từng hóa đơn\n(UC-23, UC-35)")]),

"uc-thu-ngan-35-thanh-toan-mot-phan": (
  "ĐẶC TẢ USE-CASE THU NGÂN — THANH TOÁN MỘT PHẦN", "Thu ngân", [],
  "Thanh toán một phần\n(tiền mặt / thẻ)",
  ["Cộng dồn số đã trả", "Đóng phiên khi trả đủ"],
  [],
  [("tiếp nối", "Xem hóa đơn\n(UC-21)"),
   ("không hỗ trợ ví →", "Thanh toán đủ\n(UC-23)")]),

"uc-thu-ngan-36-huy-hoa-don": (
  "ĐẶC TẢ USE-CASE THU NGÂN — HỦY HÓA ĐƠN", "Thu ngân", [],
  "Hủy hóa đơn\n(→ VOID)",
  ["Ghi lý do hủy (audit)"],
  [],
  [("tiếp nối", "Xem hóa đơn\n(UC-21)"), ("cho phép", "Đóng phiên\n(UC-25)")]),

"uc-thu-ngan-37-mo-lai-phien": (
  "ĐẶC TẢ USE-CASE THU NGÂN — MỞ LẠI PHIÊN", "Thu ngân / Phục vụ", [],
  "Mở lại phiên\n(AWAITING_PAYMENT → ACTIVE)",
  ["Gỡ khóa order của phiên", "Phát realtime cho Khách/Phục vụ"],
  [],
  [("đảo lại", "Yêu cầu thanh toán\n(UC-08)"), ("dẫn sang", "Gọi thêm món\n(UC-04)")]),

"uc-quan-ly-26-quan-ly-thuc-don": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — QUẢN LÝ THỰC ĐƠN", "Quản lý", [],
  "Quản lý thực đơn",
  ["Xem danh mục / món", "Thêm món", "Sửa món", "Xóa món (soft delete)",
   "Kiểm khóa lạc quan (version)", "Ghi audit + phát realtime"],
  [],
  [("ảnh hưởng", "Xem thực đơn\n(UC-02)")]),

"uc-quan-ly-27-bat-tat-con-het": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — BẬT/TẮT CÒN-HẾT", "Quản lý", [],
  "Bật/tắt còn-hết\n(is_available = true|false)",
  ["Ghi audit", "Phát realtime tới màn Khách"],
  [],
  [("ảnh hưởng", "Xem thực đơn\n(UC-02)"),
   ("khác với", "Báo hết món\n(UC-39, Bếp)")]),

"uc-quan-ly-28-quan-ly-ma-qr": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — QUẢN LÝ MÃ QR THEO BÀN", "Quản lý", [],
  "Quản lý mã QR",
  ["Xem mã QR các bàn",
   "Sinh mã QR (idempotent,\nrotate=false)",
   "Đổi mã QR (rotate=true:\nvô hiệu cũ + mint mới,\nmột transaction)"],
  [],
  [("ảnh hưởng", "Quét QR vào phiên\n(UC-01)")]),

"uc-quan-ly-29-quan-ly-ban": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — QUẢN LÝ BÀN", "Quản lý", [],
  "Quản lý bàn",
  ["Thêm bàn", "Sửa bàn", "Xóa bàn"],
  [],
  [("ảnh hưởng", "Lưới bàn\n(UC-10)")]),

"uc-quan-ly-29a-quan-ly-khu-vuc": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — QUẢN LÝ KHU VỰC", "Quản lý", [],
  "Quản lý khu vực",
  ["Thêm khu vực", "Sửa khu vực", "Xóa khu vực"],
  [],
  []),

"uc-quan-ly-30-quan-ly-nguoi-dung-phan-quyen": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN", "Quản lý", [],
  "Quản lý người dùng &\nphân quyền (RBAC)",
  ["Tạo người dùng", "Sửa người dùng", "Khóa / Mở (set_status)",
   "Đặt lại mật khẩu", "Chặn tự-thao-tác"],
  [],
  []),

"uc-quan-ly-31-bao-cao-thong-ke": (
  "ĐẶC TẢ USE-CASE QUẢN LÝ — XEM BÁO CÁO & THỐNG KÊ", "Quản lý", [],
  "Xem báo cáo & thống kê",
  ["Chọn loại báo cáo +\nkhoảng thời gian",
   "Tổng hợp KPI từ dữ liệu vận hành\n(gồm order_item_status_history)"],
  [],
  []),
}

# ── Dựng XML ────────────────────────────────────────────────────────────────
ACTOR_W, ACTOR_H = 40, 70
UC_W, UC_H = 190, 70
INC_W, INC_H = 200, 60
GAP_Y = 26
X_ACTOR, X_MAIN, X_INC, X_REL = 40, 210, 500, 800


def esc(s):
    return su.escape(s, {'"': "&quot;", "'": "&apos;"}).replace("\n", "&#10;")


def ellipse(cid, label, x, y, w, h, style_extra=""):
    style = ("ellipse;whiteSpace=wrap;html=1;fontSize=11;verticalAlign=middle;"
             "fillColor=#FFFFFF;strokeColor=#000000;" + style_extra)
    return (f'        <mxCell id="{cid}" value="{esc(label)}" style="{style}" '
            f'vertex="1" parent="1">\n'
            f'          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />\n'
            f'        </mxCell>\n')


def actor(cid, label, x, y):
    style = ("shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;"
             "html=1;outlineConnect=0;fontSize=12;fontStyle=1;"
             "fillColor=#FFFFFF;strokeColor=#000000;")
    return (f'        <mxCell id="{cid}" value="{esc(label)}" style="{style}" '
            f'vertex="1" parent="1">\n'
            f'          <mxGeometry x="{x}" y="{y}" width="{ACTOR_W}" height="{ACTOR_H}" as="geometry" />\n'
            f'        </mxCell>\n')


def edge(cid, src, dst, label="", dashed=False, arrow=True, gray=False):
    style = "edgeStyle=none;html=1;fontSize=10;endArrow=" + ("open;endFill=0;" if arrow else "none;")
    if dashed:
        style += "dashed=1;"
    style += "strokeColor=#808080;fontColor=#808080;" if gray else "strokeColor=#000000;"
    return (f'        <mxCell id="{cid}" value="{esc(label)}" style="{style}" '
            f'edge="1" parent="1" source="{src}" target="{dst}">\n'
            f'          <mxGeometry relative="1" as="geometry" />\n'
            f'        </mxCell>\n')


MARGIN = 40          # lề trang, đều 4 phía
TITLE_BAND = 50      # dải tiêu đề phía trên nội dung
ACTOR_LABEL_H = 22   # nhãn tác nhân nằm dưới hình → tính thêm vào bbox


def build(stem, spec):
    title, main_actor, sub_actors, uc, includes, extends, related = spec
    n_right = len(includes) + len(extends)
    n_rel = len(related)

    right_h = n_right * INC_H + max(0, n_right - 1) * GAP_Y
    rel_h = n_rel * INC_H + max(0, n_rel - 1) * GAP_Y
    body_h = max(right_h, rel_h, UC_H, 200)
    top = 90
    mid = top + body_h / 2

    # Pass 1: đặt toạ độ thô. V = (kind, cid, label, x, y, w, h, style_extra)
    V, E = [], []

    bx, bw = X_MAIN - 40, (X_INC + INC_W + 30) - (X_MAIN - 40)
    V.append(("box", "boundary", "Hệ thống QR Ordering", bx, top - 30, bw, body_h + 60, ""))

    V.append(("actor", "a0", main_actor, X_ACTOR, mid - ACTOR_H / 2, ACTOR_W, ACTOR_H, ""))
    V.append(("ell", "uc", uc, X_MAIN, mid - UC_H / 2, UC_W, UC_H, "fontStyle=1;fillColor=#F5F5F5;"))
    E.append(edge("e-a0", "a0", "uc", "", arrow=False))

    for i, sa in enumerate(sub_actors):
        V.append(("actor", f"as{i}", sa, X_MAIN + 20 + i * 120, top + body_h + 20,
                  ACTOR_W, ACTOR_H, ""))
        E.append(edge(f"e-as{i}", "uc", f"as{i}", "", arrow=False))

    y = top + (body_h - right_h) / 2
    for i, label in enumerate(includes):
        V.append(("ell", f"inc{i}", label, X_INC, y, INC_W, INC_H, ""))
        E.append(edge(f"e-inc{i}", "uc", f"inc{i}", "«include»", dashed=True))
        y += INC_H + GAP_Y
    for i, label in enumerate(extends):
        V.append(("ell", f"ext{i}", label, X_INC, y, INC_W, INC_H, "dashed=1;"))
        E.append(edge(f"e-ext{i}", f"ext{i}", "uc", "«extend»", dashed=True))
        y += INC_H + GAP_Y

    y = top + (body_h - rel_h) / 2
    for i, (lbl, target) in enumerate(related):
        V.append(("ell", f"rel{i}", target, X_REL, y, INC_W, INC_H,
                  "fillColor=#FAFAFA;strokeColor=#9E9E9E;fontColor=#616161;dashed=1;"))
        E.append(edge(f"e-rel{i}", "uc", f"rel{i}", lbl, dashed=True, gray=True))
        y += INC_H + GAP_Y

    # Pass 2: bbox thật của nội dung → dịch về lề đều, page vừa khít
    x0 = min(v[3] for v in V)
    y0 = min(v[4] for v in V)
    x1 = max(v[3] + v[5] for v in V)
    y1 = max(v[4] + v[6] + (ACTOR_LABEL_H if v[0] == "actor" else 0) for v in V)
    dx = MARGIN - x0
    dy = MARGIN + TITLE_BAND - y0
    page_w = int(x1 - x0 + 2 * MARGIN)
    page_h = int(y1 - y0 + 2 * MARGIN + TITLE_BAND)

    b = ['<mxfile host="app.diagrams.net" agent="claude" version="24.7.7">\n',
         f'  <diagram id="{stem}" name="{esc(title)}">\n',
         f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" '
         f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
         f'pageWidth="{page_w}" pageHeight="{page_h}" math="0" shadow="0">\n',
         '      <root>\n        <mxCell id="0" />\n        <mxCell id="1" parent="0" />\n',
         f'        <mxCell id="title" value="{esc(title)}" '
         f'style="text;html=1;fontSize=14;fontStyle=1;align=center;verticalAlign=middle;" '
         f'vertex="1" parent="1">\n'
         f'          <mxGeometry x="{MARGIN}" y="{MARGIN}" width="{page_w - 2 * MARGIN}" '
         f'height="{TITLE_BAND - 10}" as="geometry" />\n        </mxCell>\n']

    for kind, cid, label, x, y, w, h, extra in V:
        x, y = x + dx, y + dy
        if kind == "actor":
            b.append(actor(cid, label, x, y))
        elif kind == "box":
            b.append(f'        <mxCell id="{cid}" value="{esc(label)}" '
                     f'style="rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;fontSize=11;'
                     f'fontStyle=2;fillColor=none;strokeColor=#000000;" vertex="1" parent="1">\n'
                     f'          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />\n'
                     f'        </mxCell>\n')
        else:
            b.append(ellipse(cid, label, x, y, w, h, extra))
    b.extend(E)

    b.append('      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')
    return "".join(b)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for stem, spec in SPECS.items():
        path = os.path.join(OUT_DIR, stem + ".drawio")
        with open(path, "w", encoding="utf-8") as f:
            f.write(build(stem, spec))
    print(f"{len(SPECS)} file → {OUT_DIR}")


if __name__ == "__main__":
    main()
