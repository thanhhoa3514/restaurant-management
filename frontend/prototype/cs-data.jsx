// Cashier — data, dictionary, 5-session seed, formatters.

const CS_DICT = {
  vi: {
    cashier: 'Thu ngân',
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    restaurant_address: '142 Nguyễn Đình Chiểu, Quận 3, TP. HCM',
    restaurant_phone: 'ĐT: 028 3930 4567 · MST: 0301234567',
    shift: 'Ca chiều',
    cashier_name: 'Nguyễn Văn A',
    pending_label: 'Phiên đang chờ',
    closed_today: 'Đã hoàn tất hôm nay',
    // column 1
    search_placeholder: 'Tìm bàn...',
    sort_newest: 'Mới nhất',
    sort_bill: 'Đã yêu cầu',
    table: 'Bàn',
    area: 'Khu vực',
    guests: (n) => `${n} khách`,
    items_count: (n) => `${n} món`,
    no_sessions: 'Không có phiên phù hợp',
    elapsed_min: (n) => `${n} phút`,
    bill_requested_ago: (s) => `Đã yêu cầu ${s}`,
    // status pills
    status_dining: 'Đang ăn',
    status_bill_requested: 'Đã yêu cầu thanh toán',
    status_in_payment: 'Đang thanh toán',
    status_paid: 'Đã thanh toán',
    status_closed: 'Đã đóng',
    status_voided: 'Đã huỷ',
    // invoice
    invoice_title: 'Hoá đơn',
    invoice_number: 'Số hoá đơn',
    invoice_opened_at: 'Mở phiên lúc',
    invoice_duration: 'Thời lượng',
    void_session: 'Đóng phiên (huỷ)',
    void_dialog_title: 'Đóng phiên không thanh toán?',
    void_dialog_desc: 'Phiên này sẽ được đánh dấu là đã huỷ và không tạo bản ghi thanh toán. Hành động dùng cho trường hợp khách bỏ đi hoặc bữa ăn được miễn phí. Nhập số bàn để xác nhận.',
    void_input_label: 'Nhập số bàn để xác nhận',
    void_confirm: 'Xác nhận huỷ phiên',
    cancel: 'Huỷ',
    order_details: 'Chi tiết đơn hàng',
    order_placed_at: 'Gọi lúc',
    snapshot_tooltip: 'Tên và giá tại thời điểm gọi món',
    subtotal: 'Tạm tính',
    vat: 'Thuế VAT 10%',
    discount: 'Giảm giá',
    total: 'Tổng cộng',
    apply_discount: '+ Áp dụng giảm giá',
    remove_discount: 'Huỷ',
    discount_dialog_title: 'Áp dụng giảm giá',
    discount_amount: 'Số tiền giảm',
    discount_max_hint: 'Tối đa 50.000đ cho prototype',
    discount_reason: 'Lý do',
    discount_reason_promo: 'Khuyến mãi',
    discount_reason_regular: 'Khách quen',
    discount_reason_complaint: 'Khiếu nại',
    discount_apply: 'Áp dụng',
    discount_history: 'Lịch sử giảm giá',
    discount_action_applied: 'Áp dụng',
    discount_action_removed: 'Huỷ áp dụng',
    by: 'bởi',
    // payment panel
    payment: 'Thanh toán',
    select_method: 'Chọn phương thức',
    method_cash: 'Tiền mặt',
    method_card: 'Thẻ',
    method_ewallet: 'Ví điện tử',
    method_cash_hint: 'Khách thanh toán trực tiếp',
    method_card_hint: 'Quẹt thẻ qua máy POS',
    method_ewallet_hint: 'Momo / ZaloPay / VNPay',
    proceed_payment: 'Tiến hành thanh toán',
    select_session_empty: 'Chọn một phiên để bắt đầu',
    select_session_hint: 'Danh sách phiên đang chờ ở cột bên trái.',
    back: 'Quay lại',
    // cash
    cash_total: 'Số tiền cần thu',
    cash_tendered: 'Khách đưa',
    cash_change: 'Tiền thừa',
    cash_short: 'Thiếu',
    cash_confirm: 'Xác nhận đã thu',
    // card
    card_total: 'Số tiền cần thu',
    card_txn: 'Mã giao dịch',
    card_last4: '4 số cuối thẻ',
    card_bank: 'Ngân hàng',
    card_hint: 'Nhập sau khi máy POS xác nhận giao dịch thành công',
    card_confirm: 'Xác nhận đã thanh toán',
    // ewallet
    ewallet_provider_pick: 'Chọn nhà cung cấp',
    ewallet_qr_title: 'Khách quét mã để thanh toán',
    ewallet_provider: 'Nhà cung cấp',
    ewallet_txn: 'Mã giao dịch',
    ewallet_awaiting: 'Đang chờ thanh toán...',
    ewallet_cancel: 'Huỷ giao dịch',
    ewallet_pending_hint: 'Bạn có thể chuyển sang phiên khác — giao dịch vẫn chạy nền và sẽ thông báo khi hoàn tất.',
    // paid
    paid_title: 'Đã thanh toán thành công',
    paid_method: 'Phương thức',
    paid_txn: 'Mã giao dịch',
    paid_time: 'Thời gian',
    paid_amount: 'Số tiền',
    print_receipt: 'In hoá đơn',
    close_session: 'Đóng phiên',
    send_email_sms: 'Gửi qua email/SMS',
    send_email_sms_soon: 'Sắp ra mắt',
    // failed
    failed_title: 'Thanh toán thất bại',
    failed_reason_default: 'Khách không hoàn tất quét QR',
    retry: 'Thử lại',
    change_method: 'Chuyển phương thức',
    // receipt
    receipt_title: 'HOÁ ĐƠN BÁN HÀNG',
    receipt_no: 'Số',
    receipt_date: 'Ngày',
    receipt_table: 'Bàn',
    receipt_area: 'Khu vực',
    receipt_cashier: 'Thu ngân',
    receipt_method: 'Phương thức',
    receipt_thanks: 'Cảm ơn quý khách! Hẹn gặp lại.',
    receipt_scan_hint: 'Quét mã để nhận hoá đơn điện tử',
    print: 'In',
    close: 'Đóng',
    toast_printed: 'Đã gửi đến máy in',
    // toasts
    toast_discount_applied: 'Đã áp dụng giảm giá',
    toast_discount_removed: 'Đã huỷ giảm giá',
    toast_cash_received: 'Đã ghi nhận thanh toán tiền mặt',
    toast_card_received: 'Đã ghi nhận thanh toán thẻ',
    toast_ewallet_paid: (n) => `✓ Bàn ${n} đã thanh toán`,
    toast_ewallet_failed: 'Giao dịch thất bại',
    toast_session_closed: (n) => `Đã đóng phiên Bàn ${n}`,
    toast_session_voided: (n) => `Đã huỷ phiên Bàn ${n}`,
    toast_bill_requested: (n) => `Bàn ${n} yêu cầu thanh toán`,
    toast_reset: 'Đã khôi phục dữ liệu demo',
    // demo
    demo_title: 'Demo controls',
    demo_subtitle: 'không hiện trong production',
    demo_inject_bill: 'Inject: Yêu cầu thanh toán',
    demo_force_success: 'Force webhook success',
    demo_force_fail: 'Force webhook fail',
    demo_reset: 'Reset all',
    demo_pause: 'Tạm dừng auto',
    today_short: '27/11/2024',
  },
  en: {
    cashier: 'Cashier',
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    restaurant_address: '142 Nguyen Dinh Chieu St, District 3, HCMC',
    restaurant_phone: 'Tel: 028 3930 4567 · TAX: 0301234567',
    shift: 'Evening shift',
    cashier_name: 'Nguyen Van A',
    pending_label: 'Pending',
    closed_today: 'Closed today',
    search_placeholder: 'Search table...',
    sort_newest: 'Newest',
    sort_bill: 'Bill requested',
    table: 'Table',
    area: 'Area',
    guests: (n) => `${n} guest${n === 1 ? '' : 's'}`,
    items_count: (n) => `${n} item${n === 1 ? '' : 's'}`,
    no_sessions: 'No matching sessions',
    elapsed_min: (n) => `${n} min`,
    bill_requested_ago: (s) => `Requested ${s} ago`,
    status_dining: 'Dining',
    status_bill_requested: 'Bill requested',
    status_in_payment: 'In payment',
    status_paid: 'Paid',
    status_closed: 'Closed',
    status_voided: 'Voided',
    invoice_title: 'Invoice',
    invoice_number: 'Invoice no.',
    invoice_opened_at: 'Opened at',
    invoice_duration: 'Duration',
    void_session: 'Close session (void)',
    void_dialog_title: 'Close session without payment?',
    void_dialog_desc: 'This session will be marked voided and no payment record is created. Use this for walk-outs or comped meals. Type the table number to confirm.',
    void_input_label: 'Type the table number to confirm',
    void_confirm: 'Void session',
    cancel: 'Cancel',
    order_details: 'Order details',
    order_placed_at: 'Placed at',
    snapshot_tooltip: 'Name and price at time of order',
    subtotal: 'Subtotal',
    vat: 'VAT 10%',
    discount: 'Discount',
    total: 'Total',
    apply_discount: '+ Apply discount',
    remove_discount: 'Remove',
    discount_dialog_title: 'Apply discount',
    discount_amount: 'Amount',
    discount_max_hint: 'Up to 50,000đ for this prototype',
    discount_reason: 'Reason',
    discount_reason_promo: 'Promotion',
    discount_reason_regular: 'Regular customer',
    discount_reason_complaint: 'Complaint',
    discount_apply: 'Apply',
    discount_history: 'Discount history',
    discount_action_applied: 'Applied',
    discount_action_removed: 'Removed',
    by: 'by',
    payment: 'Payment',
    select_method: 'Select method',
    method_cash: 'Cash',
    method_card: 'Card',
    method_ewallet: 'E-wallet',
    method_cash_hint: 'Customer pays at counter',
    method_card_hint: 'POS terminal swipe',
    method_ewallet_hint: 'Momo / ZaloPay / VNPay',
    proceed_payment: 'Proceed to payment',
    select_session_empty: 'Select a session to begin',
    select_session_hint: 'Pending sessions are listed in the left column.',
    back: 'Back',
    cash_total: 'Amount due',
    cash_tendered: 'Amount tendered',
    cash_change: 'Change',
    cash_short: 'Short',
    cash_confirm: 'Confirm received',
    card_total: 'Amount due',
    card_txn: 'Transaction ID',
    card_last4: 'Last 4 digits',
    card_bank: 'Bank',
    card_hint: 'Enter after POS terminal confirms successful transaction',
    card_confirm: 'Confirm payment',
    ewallet_provider_pick: 'Choose provider',
    ewallet_qr_title: 'Customer scans to pay',
    ewallet_provider: 'Provider',
    ewallet_txn: 'Transaction ID',
    ewallet_awaiting: 'Awaiting payment...',
    ewallet_cancel: 'Cancel transaction',
    ewallet_pending_hint: 'You can switch to another session — this transaction continues in the background and will notify you when complete.',
    paid_title: 'Payment successful',
    paid_method: 'Method',
    paid_txn: 'Transaction ID',
    paid_time: 'Time',
    paid_amount: 'Amount',
    print_receipt: 'Print receipt',
    close_session: 'Close session',
    send_email_sms: 'Send via email/SMS',
    send_email_sms_soon: 'Coming soon',
    failed_title: 'Payment failed',
    failed_reason_default: 'Customer did not complete QR scan',
    retry: 'Retry',
    change_method: 'Change method',
    receipt_title: 'SALES RECEIPT',
    receipt_no: 'No.',
    receipt_date: 'Date',
    receipt_table: 'Table',
    receipt_area: 'Area',
    receipt_cashier: 'Cashier',
    receipt_method: 'Method',
    receipt_thanks: 'Thank you! See you again.',
    receipt_scan_hint: 'Scan for digital receipt',
    print: 'Print',
    close: 'Close',
    toast_printed: 'Sent to printer',
    toast_discount_applied: 'Discount applied',
    toast_discount_removed: 'Discount removed',
    toast_cash_received: 'Cash payment recorded',
    toast_card_received: 'Card payment recorded',
    toast_ewallet_paid: (n) => `✓ Table ${n} paid`,
    toast_ewallet_failed: 'Transaction failed',
    toast_session_closed: (n) => `Closed session for Table ${n}`,
    toast_session_voided: (n) => `Voided session for Table ${n}`,
    toast_bill_requested: (n) => `Table ${n} requested the bill`,
    toast_reset: 'Demo data restored',
    demo_title: 'Demo controls',
    demo_subtitle: 'hidden in production',
    demo_inject_bill: 'Inject: bill request',
    demo_force_success: 'Force webhook success',
    demo_force_fail: 'Force webhook fail',
    demo_reset: 'Reset all',
    demo_pause: 'Pause auto',
    today_short: '2024-11-27',
  },
};

// ---------- Menu pool (snapshot source) ----------
const CS_MENU = [
  { id: 'pho_bo_tai', name_vi: 'Phở bò tái', name_en: 'Rare beef pho', opts_vi: 'Tô lớn', opts_en: 'Large', price: 75000 },
  { id: 'com_tam_suon', name_vi: 'Cơm tấm sườn nướng bì chả', name_en: 'Special broken rice', opts_vi: 'Thêm trứng ốp la', opts_en: 'Extra fried egg', price: 85000 },
  { id: 'bun_bo_hue', name_vi: 'Bún bò Huế', name_en: 'Huế-style beef noodle', opts_vi: 'Cay vừa', opts_en: 'Medium spice', price: 80000 },
  { id: 'banh_xeo', name_vi: 'Bánh xèo miền Tây', name_en: 'Mekong sizzling pancake', opts_vi: 'Tôm + thịt', opts_en: 'Shrimp + pork', price: 90000 },
  { id: 'mi_quang', name_vi: 'Mì Quảng', name_en: 'Quảng-style noodle', opts_vi: 'Gà + tôm', opts_en: 'Chicken + shrimp', price: 70000 },
  { id: 'goi_cuon', name_vi: 'Gỏi cuốn tôm thịt', name_en: 'Shrimp & pork spring rolls', opts_vi: 'Nước chấm đậu phộng', opts_en: 'Peanut sauce', price: 50000 },
  { id: 'banh_mi', name_vi: 'Bánh mì thịt nướng', name_en: 'Grilled pork banh mi', opts_vi: 'Pate đặc biệt', opts_en: 'House pâté', price: 45000 },
  { id: 'cafe_sua_da', name_vi: 'Cà phê sữa đá', name_en: 'Iced milk coffee', opts_vi: 'Ngọt 70%', opts_en: '70% sugar', price: 35000 },
  { id: 'tra_dao', name_vi: 'Trà đào cam sả', name_en: 'Peach lemongrass tea', opts_vi: 'Đá ít', opts_en: 'Less ice', price: 45000 },
  { id: 'nuoc_cam', name_vi: 'Nước cam tươi', name_en: 'Fresh orange juice', opts_vi: 'Không đường', opts_en: 'No sugar', price: 35000 },
  { id: 'sinh_to_bo', name_vi: 'Sinh tố bơ', name_en: 'Avocado smoothie', opts_vi: 'Sữa đặc', opts_en: 'Condensed milk', price: 50000 },
];

function csDish(id) { return CS_MENU.find((m) => m.id === id); }

// ---------- Invoice line item (snapshotted) ----------
let _csItemId = 1;
function csMakeLine(dishId, qty, opts = {}) {
  const dish = csDish(dishId);
  const unit_price_snapshot = dish.price;
  return {
    id: 'L' + _csItemId++,
    name_snapshot_vi: dish.name_vi,
    name_snapshot_en: dish.name_en,
    options_text_vi: opts.options_text_vi ?? dish.opts_vi,
    options_text_en: opts.options_text_en ?? dish.opts_en,
    notes: opts.notes || '',
    qty,
    unit_price_snapshot,
    line_total: unit_price_snapshot * qty,
  };
}

let _csOrderId = 200;
function csMakeOrder(submittedAt, items) {
  return { id: 'O' + _csOrderId++, submitted_at: submittedAt, items };
}

function csCalcInvoice(orders, discount) {
  const items = orders.flatMap((o) => o.items);
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const vat_amount = Math.round(subtotal * 0.1);
  const disc = discount ? discount.amount : 0;
  const total = Math.max(0, subtotal + vat_amount - disc);
  return { subtotal, vat_amount, total };
}

let _csInvoiceCounter = 41;
function csMakeInvoice(orders, createdAt) {
  const num = String(_csInvoiceCounter++).padStart(4, '0');
  const d = createdAt;
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const calc = csCalcInvoice(orders, null);
  return {
    number: `HD-${dateStr}-${num}`,
    created_at: createdAt,
    items: orders.flatMap((o) =>
      o.items.map((it) => ({ ...it, _order_id: o.id, _order_submitted_at: o.submitted_at }))
    ),
    orders,
    subtotal: calc.subtotal,
    vat_amount: calc.vat_amount,
    discount: null,
    total: calc.total,
    discount_history: [],
  };
}

// ---------- Sessions ----------
let _csSessionId = 5000;
function csMakeSession({ tableNumber, areaVi, areaEn, guestCount, startedAt, status, billRequestedAt = null, orders, payment = null }) {
  const invoice = csMakeInvoice(orders, startedAt);
  return {
    id: 'S' + _csSessionId++,
    table_number: tableNumber,
    area_name_vi: areaVi,
    area_name_en: areaEn,
    guest_count: guestCount,
    started_at: startedAt,
    bill_requested_at: billRequestedAt,
    status,
    invoice,
    payment,
  };
}

// ---------- Seed: 5 sessions ----------
function csBuildInitialSessions(now = new Date()) {
  const at = (secAgo) => new Date(now.getTime() - secAgo * 1000);

  return [
    // 1) Bill requested ~3 min ago — Bàn 8
    csMakeSession({
      tableNumber: 8,
      areaVi: 'Tầng 1',
      areaEn: '1st Floor',
      guestCount: 2,
      startedAt: at(25 * 60),
      status: 'bill_requested',
      billRequestedAt: at(3 * 60 + 5),
      orders: [
        csMakeOrder(at(24 * 60), [
          csMakeLine('pho_bo_tai', 1),
          csMakeLine('banh_mi', 1),
          csMakeLine('cafe_sua_da', 2),
        ]),
      ],
    }),

    // 2) Bill requested ~30s ago — Bàn 15
    csMakeSession({
      tableNumber: 15,
      areaVi: 'Sân vườn',
      areaEn: 'Garden',
      guestCount: 4,
      startedAt: at(40 * 60),
      status: 'bill_requested',
      billRequestedAt: at(35),
      orders: [
        csMakeOrder(at(39 * 60), [
          csMakeLine('com_tam_suon', 2, { notes: 'Một phần không cay' }),
          csMakeLine('bun_bo_hue', 1),
          csMakeLine('goi_cuon', 2),
          csMakeLine('tra_dao', 4),
        ]),
      ],
    }),

    // 3) Dining — Bàn 4
    csMakeSession({
      tableNumber: 4,
      areaVi: 'Tầng 2',
      areaEn: '2nd Floor',
      guestCount: 2,
      startedAt: at(20 * 60),
      status: 'dining',
      orders: [
        csMakeOrder(at(19 * 60), [
          csMakeLine('mi_quang', 1),
          csMakeLine('banh_xeo', 1),
          csMakeLine('cafe_sua_da', 2),
        ]),
      ],
    }),

    // 4) Dining — Bàn 12 (larger group, 2 orders)
    csMakeSession({
      tableNumber: 12,
      areaVi: 'Tầng 2 — Cửa sổ',
      areaEn: '2nd Floor — Window',
      guestCount: 4,
      startedAt: at(45 * 60),
      status: 'dining',
      orders: [
        csMakeOrder(at(44 * 60), [
          csMakeLine('pho_bo_tai', 2),
          csMakeLine('banh_xeo', 1),
        ]),
        csMakeOrder(at(18 * 60), [
          csMakeLine('com_tam_suon', 2),
          csMakeLine('tra_dao', 4),
          csMakeLine('sinh_to_bo', 2),
        ]),
      ],
    }),

    // 5) In payment (e-wallet pending) — Bàn 6
    (() => {
      const sess = csMakeSession({
        tableNumber: 6,
        areaVi: 'Tầng 1',
        areaEn: '1st Floor',
        guestCount: 3,
        startedAt: at(50 * 60),
        status: 'in_payment',
        billRequestedAt: at(5 * 60),
        orders: [
          csMakeOrder(at(49 * 60), [
            csMakeLine('bun_bo_hue', 2, { notes: 'Cay nhiều' }),
            csMakeLine('banh_xeo', 1),
            csMakeLine('nuoc_cam', 3),
          ]),
        ],
      });
      sess.payment = {
        method: 'ewallet',
        sub_method: 'momo',
        status: 'pending',
        transaction_id: csMakeTxnId(at(30)),
        initiated_at: at(30),
        completed_at: null,
        amount_tendered: null,
        change: null,
        last4: null,
        bank: null,
      };
      return sess;
    })(),
  ];
}

// ---------- Helpers ----------
function csMakeTxnId(date = new Date()) {
  const d = date;
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${ds}-${rand}`;
}

function csFmtVND(amount) {
  const sign = amount < 0 ? '-' : '';
  const v = Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + v + 'đ';
}

function csFmtClock(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function csFmtClockSec(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function csFmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function csFmtDateTime(d) {
  return csFmtDate(d) + ' ' + csFmtClock(d);
}
function csFmtHMS(seconds) {
  if (seconds == null) return '';
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function csFmtMin(seconds) {
  return Math.max(0, Math.round(seconds / 60));
}

// ---------- E-wallet provider styling ----------
const CS_PROVIDERS = [
  { id: 'momo', name: 'Momo', accent: 'bg-pink-100 text-pink-800 border-pink-200', dot: 'bg-pink-500' },
  { id: 'zalopay', name: 'ZaloPay', accent: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  { id: 'vnpay', name: 'VNPay', accent: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
];

function csProviderName(id) {
  return CS_PROVIDERS.find((p) => p.id === id)?.name || id;
}

Object.assign(window, {
  CS_DICT,
  CS_MENU,
  CS_PROVIDERS,
  csDish,
  csMakeLine,
  csMakeOrder,
  csMakeInvoice,
  csMakeSession,
  csBuildInitialSessions,
  csCalcInvoice,
  csMakeTxnId,
  csProviderName,
  csFmtVND,
  csFmtClock,
  csFmtClockSec,
  csFmtDate,
  csFmtDateTime,
  csFmtHMS,
  csFmtMin,
});
