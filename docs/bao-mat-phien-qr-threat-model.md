# Bảo mật phiên QR — Phân tích rủi ro & phòng thủ

> Tài liệu tổng hợp mô hình đe dọa (threat model) của cơ chế gọi món qua QR theo bàn,
> phục vụ phản biện hội đồng. Mọi kết luận bám theo phần đã hiện thực trong mã nguồn.

---

## 1. Mục đích

Hệ thống cho phép khách **quét mã QR dán trên bàn → tham gia phiên ăn của bàn → gọi món theo lượt → thanh toán chung cuối bữa**. Tài liệu này trả lời câu hỏi hội đồng thường đặt: *"Cơ chế QR này có bị lạm dụng không? Nếu có thì xử lý thế nào?"*

Luận điểm trung tâm cần bảo vệ:

> Với mô hình **token mang theo (bearer token) chia sẻ theo bàn**, ta **không thể chống việc chia sẻ/chuyển tiếp truy cập bằng kỹ thuật thuần phần mềm**. Thay vì cố "ngăn tuyệt đối", hệ thống được thiết kế để **lạm dụng trở nên vô hại và có thể phục hồi** — và đây là lựa chọn đúng cho mô hình ăn tại chỗ (dine-in).

---

## 2. Mô hình & giả định

| Thành phần | Cơ chế thực tế trong mã nguồn |
|---|---|
| Mã QR | Mã hóa **URL gọi món chứa token opaque** (`buildQROrderURL(token)`), **không nhúng table_id**. |
| Token | Gắn **theo BÀN**, không theo phiên. Ràng buộc `uq_qr_codes_one_active_per_table` → mỗi bàn tối đa **1 QR active**, sống lâu dài. |
| Tham gia phiên | `POST /customer/sessions/join` với token → `FindQRByToken` → `FindActiveSessionByTable`. |
| Không có phiên ACTIVE | Trả `status: "not_opened"`, **KHÔNG cấp session token** → token ngoài giờ là **vô dụng**. |
| Có phiên ACTIVE | Trả `SessionToken` → thiết bị được coi là "người cùng bàn". |
| Mở phiên | **Nhân viên mở** (walk-in, `POST /restaurant/sessions`, quyền DiningServe). Khách không tự mở. |
| UI khách | **Không hiển thị giá/tổng tiền** (quy tắc nghiệp vụ #7) — chỉ tên món + trạng thái. |
| Snapshot | Tên & giá món chép vào `order_item` lúc đặt → đổi menu **không** ảnh hưởng đơn/hóa đơn cũ. |
| Audit | Mỗi lần quét ghi sự kiện `dining.qr_scanned` kèm `ip_hash` + dedupe (outbox). |
| Sửa sai | Thu ngân có `POST /invoices/:id/void` và `/adjust`. |

**Bản chất "bearer token":** ai cầm token trong lúc phiên đang mở đều được đối xử như bạn cùng bàn. Đây là *tính năng* (khách cùng bàn dùng nhiều điện thoại cùng gọi món), đồng thời là *bề mặt tấn công*.

---

## 3. Nguyên lý cốt lõi (dùng để phản biện)

1. **Không thể ngăn chuyển tiếp (forward).** Bất kỳ thứ gì khách hợp lệ cầm (token/URL/QR) đều có thể gửi cho người khác. Đây là bài toán chung của mọi hệ bearer-token (vé xem phim, boarding pass, mã cửa) — **không giải bằng crypto**.
2. **Định danh bàn qua mạng là bất khả thi.** IP: cả quán chung 1 IP công cộng (NAT) → không tách được bàn. MAC: là Layer-2, **không tới được server**, trình duyệt không cho JS đọc, lại bị randomize.
3. **Chiến lợi phẩm bị khóa vào bàn vật lý.** Kẻ chiếm phiên chỉ **gọi món cho bàn đó** — món được bưng ra **bàn thật trong quán**. Kẻ ở xa **không nhận được gì ăn được**; nó chỉ **phá** (nhét món vào hóa đơn khách thật).
4. **Dine-in có điểm quyết toán bắt buộc.** Khác thương mại điện tử, luôn có bước **thanh toán với khách thật đứng tại chỗ** → lưới an toàn tự nhiên để phát hiện & gỡ món gian.

→ Kết luận: phòng thủ = **giới hạn quyền + phát hiện + phục hồi**, KHÔNG phải ngăn chặn tuyệt đối.

---

## 4. Bảng tổng hợp rủi ro

| # | Tình huống rủi ro | Vì sao xảy ra | Tác động tối đa | Cách hệ thống xử lý |
|---|---|---|---|---|
| R1 | Kẻ chụp trộm QR rồi **quét liên tục**, chờ đúng lúc bàn mở phiên | Token gắn theo bàn, sống lâu | Join được **chỉ khi** phiên đang ACTIVE; ngoài giờ → `not_opened`, vô hại | Ngoài giờ token chết; trong giờ → chỉ phá bill (xem R-core) |
| R2 | Khách hợp lệ **tự gửi QR/URL** cho người khác | Bearer token — không chống được | Người nhận join & gọi món cho bàn đó | Chấp nhận; chặn thiệt hại ở thanh toán |
| R3 | "Join hết hạn" **không cứu được** vì forward khi còn hạn | Hết hạn chỉ giới hạn thời gian, không giới hạn *ai* | Như R2 | Chấp nhận; hết hạn chỉ thu hẹp cửa sổ, không phải rào chắn |
| R4 | Ràng buộc **IP quán** để chặn kẻ ở xa | Cả quán 1 IP (NAT) | Chặn nhầm **khách dùng 4G/5G** (IP khác wifi) → hỏng khách thật; kẻ ngồi trong quán vẫn qua | **Không** hard-gate bằng IP; chỉ dùng `ip_hash` như tín hiệu mềm để gắn cờ |
| R5 | Ràng buộc **IP theo từng bàn** | NAT gộp mọi bàn về 1 IP | Không phân biệt được bàn ⇒ vô nghĩa | Loại bỏ (bất khả thi trừ khi mỗi bàn 1 VLAN — hạ tầng nặng) |
| R6 | Dùng **MAC address** của thiết bị/bàn | MAC là Layer-2 | Server không thấy MAC; JS trình duyệt không lấy được; MAC bị randomize; bàn không có MAC | Loại bỏ (ngõ cụt kỹ thuật) |
| R7 | **Xoay QR (rotate)** để vô hiệu QR bị lộ | Token mới ⇒ QR in cũ chết | Phải **in lại + dán lại** đúng bàn đó | Rotate là **công cụ xử lý sự cố hiếm**, không phải thao tác thường ngày (xem §6) |
| R8 | Nhét món **đã được bếp chế biến** vào bill | Món qua PENDING → bếp nấu | Mất **nguyên liệu** món đã nấu | Bếp lọc thủ công + hủy free khi còn PENDING; đây là rủi ro thật *duy nhất*, giá trị nhỏ |

**R-core (điểm mấu chốt của R1–R3):** kẻ chiếm phiên **chỉ làm được 1 việc — thêm món vào hóa đơn bàn vật lý.** Không trộm được đồ (món ra bàn thật), không xem được tiền (UI khách ẩn giá/tổng). Thiệt hại = *phá bill*, được bắt ở bước thanh toán.

---

## 5. Các giải pháp đã cân nhắc & vì sao bác bỏ

| Giải pháp | Ý tưởng | Vì sao KHÔNG dùng |
|---|---|---|
| **OTP điện thoại** | Khách nhập SĐT → nhận mã SMS → gõ mã mới vào phiên | Giết trải nghiệm "quét là gọi": 3 bước/30–60s, mỗi người 1 máy đều phải làm, tốn phí SMS, sóng yếu thì kẹt. Sai với mô hình lẩu-nướng ăn nhanh/đông. |
| **QR trỏ URL cố định `/t/{table_id}`** (indirection) | Server map bàn→token active lúc quét → rotate không cần in lại | **Mất luôn ý nghĩa rotate**: URL cố định thì ai chụp cũng dùng mãi, không khóa được QR lộ. |
| **Gate theo IP quán** | Chỉ IP trong quán mới gọi được | Chặn nhầm khách 4G (R4); kẻ ngồi trong quán vẫn qua. Lợi ích < thiệt hại. |
| **IP theo bàn / MAC** | Định danh bàn qua mạng | Bất khả thi (NAT gộp IP; MAC không tới server) — R5, R6. |
| **QR theo phiên (session-scoped)** | Mỗi lượt seat sinh QR mới hiện trên phiếu/POS | Đổi cả mô hình vận hành, không dán sticker cố định; over-engineer cho quán dine-in. |
| **NFC/BLE beacon theo bàn** | Điện thoại phải chạm/gần bàn mới gọi được | Đây là **cách duy nhất định danh bàn thật**, nhưng cần **phần cứng** → xếp vào "Hướng phát triển". |

---

## 6. Các tuyến phòng thủ đang áp dụng (containment)

Thay cho một "bức tường" duy nhất, hệ thống dùng **nhiều tuyến chứa thiệt hại**. Hầu hết **đã hiện thực**.

| # | Kiểm soát | Vai trò | Trạng thái |
|---|---|---|---|
| C1 | **Nhân viên mở phiên** (khách không tự mở) | Ngoài giờ / bàn trống → token vô dụng | ✅ đã có |
| C2 | **Bếp xác nhận thủ công** ticket | Con người lọc đơn bất thường ("bàn 5 gọi 40 phần bò → hỏi lại") | ✅ đã có |
| C3 | **Thu ngân void/adjust** món tranh chấp | Chốt chặn tại thanh toán, khách thật đối soát | ✅ đã có |
| C4 | **Hủy free khi món còn PENDING** | Đơn phá chưa nấu → gỡ, mất 0đ | ✅ đã có |
| C5 | **Audit log `qr_scanned` + ip_hash + dedupe** | Phát hiện quét bất thường | ✅ đã có |
| C6 | **Rotate/deactivate QR** | Vô hiệu token *khi xác nhận lộ* → in lại đúng bàn đó (hiếm) | ✅ đã có |
| C7 | **Rate-limit join/order** theo IP+phiên | Chặn poll/spam tự động | ⭕ đề xuất (rẻ) |
| C8 | **Cảnh báo phục vụ** khi phiên gọi số lượng đột biến | Lớp phát hiện sớm | ⭕ đề xuất (rẻ) |

**Về rotate (làm rõ hiểu lầm thường gặp):** token gắn **theo bàn, không theo phiên** → **in QR 1 lần lúc set up bàn**, dùng chung cho *mọi lượt khách* (100 lượt/ngày vẫn 1 mã). Reprint **chỉ xảy ra khi ta chủ động rotate** để xử lý QR bị lộ — không phải mỗi lượt khách.

---

## 7. Kết luận (accepted risk)

> Cơ chế phiên QR chia sẻ theo bàn **không thể chống chuyển tiếp truy cập bằng kỹ thuật thuần phần mềm** (bản chất bearer token). Hệ thống lựa chọn **chấp nhận rủi ro có kiểm soát**:
> - **Thiệt hại bị giới hạn**: kẻ tấn công chỉ chèn được món vào hóa đơn của một bàn vật lý, không thu được lợi ích vật chất.
> - **Phát hiện được**: audit log quét QR + con người ở bếp.
> - **Phục hồi được**: thu ngân void/adjust món tranh chấp; hủy free khi món còn PENDING.
> - **Động cơ tấn công thấp**: món ra bàn thật, kẻ ở xa không nhận được gì.
> - **Rủi ro dư tối đa** = nguyên liệu của món đã chế biến — nhỏ và trong tầm kiểm soát.
>
> Muốn ràng buộc "đúng thiết bị ở đúng bàn" cần mốc vật lý (NFC/BLE beacon) — xếp vào **hướng phát triển tương lai**, không thuộc phạm vi hiện tại.

---

## 8. Câu hỏi phản biện dự kiến & trả lời gợi ý

**H: Người khác chụp/nhận QR rồi gọi món lung tung thì sao?**
Đ: Họ chỉ thêm được món vào **bàn vật lý** đó — món bưng ra bàn thật, họ không lấy được. Tác động tối đa là phá hóa đơn, và bị bắt ở bước thanh toán (khách đối soát → thu ngân void). Món chưa nấu (PENDING) hủy không mất phí.

**H: Sao không xác thực từng khách (OTP/đăng nhập)?**
Đ: Giết trải nghiệm cốt lõi "quét là gọi món ngay", tăng ma sát cho mô hình ăn nhanh/đông, tốn SMS. Lợi ích an ninh không tương xứng với rủi ro vốn đã nhỏ.

**H: Sao không chặn theo IP/MAC để biết khách có ở trong quán?**
Đ: IP: cả quán chung 1 IP qua NAT → không tách được bàn, còn chặn nhầm khách dùng 4G. MAC: không tới được server (Layer-2), trình duyệt không cho đọc, lại bị randomize. Định danh bàn qua mạng là bất khả thi.

**H: Rotate QR có phải in lại mỗi lượt khách?**
Đ: Không. Token gắn theo bàn, in 1 lần dùng cho mọi lượt. Chỉ in lại khi chủ động rotate để xử lý QR bị lộ — trường hợp hiếm.

**H: Vậy hệ thống có "an toàn tuyệt đối" không?**
Đ: Không, và không hệ QR dine-in nào tuyên bố vậy. Chúng tôi chọn **chứa thiệt hại + phục hồi** thay vì hứa hẹn bất khả xâm phạm — phù hợp thực tế vận hành và rủi ro thực tế.

---

*Tài liệu bám theo hiện trạng mã nguồn tại thời điểm biên soạn. Các mục ⭕ là đề xuất chưa hiện thực.*
