// Menu data, i18n dictionary, formatters — all exported to window.

const MENU = [
  {
    id: 'com-tam-suon',
    category: 'rice',
    name: { vi: 'Cơm tấm sườn nướng', en: 'Grilled pork chop rice' },
    description: {
      vi: 'Sườn cốt lết nướng than hoa, cơm tấm dẻo, đồ chua, nước mắm pha.',
      en: 'Charcoal-grilled pork chop over broken rice, pickles, sweet fish sauce.',
    },
    price: 75000,
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: true,
  },
  {
    id: 'com-tam-dac-biet',
    category: 'rice',
    name: { vi: 'Cơm tấm đặc biệt', en: 'Special combo broken rice' },
    description: {
      vi: 'Sườn nướng, chả trứng, bì heo, trứng ốp la, đồ chua.',
      en: 'Grilled chop, steamed egg loaf, shredded pork skin, fried egg.',
    },
    price: 95000,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: true,
  },
  {
    id: 'com-ga-xoi-mo',
    category: 'rice',
    name: { vi: 'Cơm gà xối mỡ', en: 'Crispy fried chicken rice' },
    description: {
      vi: 'Đùi gà chiên giòn rưới mỡ hành, cơm trắng, canh rau.',
      en: 'Crispy chicken leg with scallion oil, steamed rice, side soup.',
    },
    price: 85000,
    image: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'pho-bo-tai',
    category: 'pho',
    name: { vi: 'Phở bò tái', en: 'Rare beef pho' },
    description: {
      vi: 'Nước dùng xương hầm 12 giờ, thịt bò tái mềm, bánh phở tươi.',
      en: '12-hour bone broth, tender rare beef slices, fresh rice noodles.',
    },
    price: 70000,
    image: 'https://images.unsplash.com/photo-1583224994076-ae3022d989fa?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'pho-bo-dac-biet',
    category: 'pho',
    name: { vi: 'Phở bò đặc biệt', en: 'House special pho' },
    description: {
      vi: 'Tái, nạm, gầu, gân, bò viên — đầy đủ trong một tô.',
      en: 'Rare beef, brisket, fatty flank, tendon, beef balls — all in one.',
    },
    price: 95000,
    image: 'https://images.unsplash.com/photo-1631709497146-a239ef373cf1?w=600&auto=format&fit=crop',
    is_available: false,
    is_bestseller: false,
  },
  {
    id: 'bun-bo-hue',
    category: 'pho',
    name: { vi: 'Bún bò Huế', en: 'Huế-style spicy beef noodle' },
    description: {
      vi: 'Nước dùng sả ớt cay nồng, chả Huế, giò heo, bún sợi to.',
      en: 'Lemongrass-chili broth, Huế sausage, pork knuckle, thick noodles.',
    },
    price: 80000,
    image: 'https://images.unsplash.com/photo-1635963662180-fdaaaafff140?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'thit-nuong-xien',
    category: 'grill',
    name: { vi: 'Thịt nướng xiên que', en: 'Skewered grilled pork' },
    description: {
      vi: 'Ba chỉ tẩm sả mật ong, nướng than hồng, ăn kèm bún và rau sống.',
      en: 'Honey-lemongrass pork belly, charcoal-grilled, with herbs.',
    },
    price: 65000,
    image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'ga-nuong-mat-ong',
    category: 'grill',
    name: { vi: 'Gà nướng mật ong', en: 'Honey-glazed grilled chicken' },
    description: {
      vi: 'Nửa con gà ta nướng mật ong, da giòn, thịt mọng nước.',
      en: 'Half free-range chicken glazed in honey, crispy skin.',
    },
    price: 145000,
    image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: true,
  },
  {
    id: 'tra-da',
    category: 'drink',
    name: { vi: 'Trà đá', en: 'Iced jasmine tea' },
    description: {
      vi: 'Trà sen nhài pha đậm, đá viên mát lạnh — refill miễn phí.',
      en: 'Strong jasmine-lotus tea over crushed ice — free refill.',
    },
    price: 10000,
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'ca-phe-sua-da',
    category: 'drink',
    name: { vi: 'Cà phê sữa đá', en: 'Vietnamese iced milk coffee' },
    description: {
      vi: 'Cà phê phin đậm đặc, sữa đặc Ông Thọ, đá viên.',
      en: 'Strong phin-brewed coffee with sweet condensed milk over ice.',
    },
    price: 35000,
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'nuoc-mia',
    category: 'drink',
    name: { vi: 'Nước mía tắc', en: 'Sugarcane juice with kumquat' },
    description: {
      vi: 'Mía ép tươi tại bàn, vắt thêm tắc cho vị chua dịu.',
      en: 'Freshly pressed sugarcane with a squeeze of kumquat.',
    },
    price: 25000,
    image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&auto=format&fit=crop',
    is_available: false,
    is_bestseller: false,
  },
  {
    id: 'che-ba-mau',
    category: 'dessert',
    name: { vi: 'Chè ba màu', en: 'Three-color dessert' },
    description: {
      vi: 'Đậu đỏ, đậu xanh, thạch lá dứa, nước cốt dừa béo ngậy.',
      en: 'Red bean, mung bean, pandan jelly, rich coconut cream.',
    },
    price: 35000,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
  {
    id: 'banh-flan',
    category: 'dessert',
    name: { vi: 'Bánh flan cà phê', en: 'Coffee crème caramel' },
    description: {
      vi: 'Flan trứng mềm mịn, caramel đắng nhẹ, rưới cà phê đen.',
      en: 'Silky egg flan, light caramel, topped with black coffee.',
    },
    price: 30000,
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&auto=format&fit=crop',
    is_available: true,
    is_bestseller: false,
  },
];

// Shared option groups — most savory items get size + spice + addons.
const RICE_PHO_OPTIONS = [
  {
    id: 'size',
    name_vi: 'Khẩu phần',
    name_en: 'Portion size',
    type: 'single',
    required: true,
    options: [
      { id: 'small', name_vi: 'Nhỏ', name_en: 'Small', price_modifier: 0 },
      { id: 'medium', name_vi: 'Vừa', name_en: 'Medium', price_modifier: 15000 },
      { id: 'large', name_vi: 'Lớn', name_en: 'Large', price_modifier: 30000 },
    ],
  },
  {
    id: 'spice',
    name_vi: 'Mức cay',
    name_en: 'Spice level',
    type: 'single',
    required: true,
    options: [
      { id: 'none', name_vi: 'Không cay', name_en: 'No spice', price_modifier: 0 },
      { id: 'mild', name_vi: 'Cay nhẹ', name_en: 'Mild', price_modifier: 0 },
      { id: 'medium', name_vi: 'Cay vừa', name_en: 'Medium', price_modifier: 0 },
      { id: 'hot', name_vi: 'Cay nhiều', name_en: 'Hot', price_modifier: 0 },
    ],
  },
  {
    id: 'addons',
    name_vi: 'Thêm',
    name_en: 'Add-ons',
    type: 'multi',
    required: false,
    options: [
      { id: 'egg', name_vi: 'Thêm trứng', name_en: 'Extra egg', price_modifier: 10000 },
      { id: 'cha', name_vi: 'Thêm chả', name_en: 'Extra meatloaf', price_modifier: 15000 },
      { id: 'veg', name_vi: 'Thêm rau', name_en: 'Extra herbs', price_modifier: 5000 },
    ],
  },
];

const DRINK_OPTIONS = [
  {
    id: 'ice',
    name_vi: 'Đá',
    name_en: 'Ice',
    type: 'single',
    required: true,
    options: [
      { id: 'normal', name_vi: 'Đá bình thường', name_en: 'Normal ice', price_modifier: 0 },
      { id: 'less', name_vi: 'Ít đá', name_en: 'Less ice', price_modifier: 0 },
      { id: 'none', name_vi: 'Không đá', name_en: 'No ice', price_modifier: 0 },
    ],
  },
  {
    id: 'sugar',
    name_vi: 'Độ ngọt',
    name_en: 'Sweetness',
    type: 'single',
    required: true,
    options: [
      { id: '100', name_vi: '100%', name_en: '100%', price_modifier: 0 },
      { id: '70', name_vi: '70%', name_en: '70%', price_modifier: 0 },
      { id: '50', name_vi: '50%', name_en: '50%', price_modifier: 0 },
      { id: '0', name_vi: 'Không ngọt', name_en: 'No sugar', price_modifier: 0 },
    ],
  },
];

// Attach option groups based on category.
for (const item of MENU) {
  if (item.category === 'drink') {
    item.option_groups = DRINK_OPTIONS;
  } else if (item.category === 'dessert') {
    item.option_groups = [DRINK_OPTIONS[1]]; // sweetness only
  } else {
    item.option_groups = RICE_PHO_OPTIONS;
  }
}

const CATEGORIES = [
  { id: 'all', name_vi: 'Tất cả', name_en: 'All' },
  { id: 'rice', name_vi: 'Cơm', name_en: 'Rice' },
  { id: 'pho', name_vi: 'Phở & Bún', name_en: 'Noodles' },
  { id: 'grill', name_vi: 'Món nướng', name_en: 'Grilled' },
  { id: 'drink', name_vi: 'Đồ uống', name_en: 'Drinks' },
  { id: 'dessert', name_vi: 'Tráng miệng', name_en: 'Dessert' },
];

const DICT = {
  vi: {
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    tagline: 'Hương vị Sài Gòn — phục vụ tại bàn',
    table: 'Bàn số',
    area: 'Khu vực',
    floor: 'Tầng 2 — Khu sân vườn',
    now: 'Hiện tại',
    start_ordering: 'Bắt đầu gọi món',
    session_hint: 'Phiên gọi món của bạn sẽ mở trong 3 giờ. Bạn có thể gọi thêm món bất cứ lúc nào.',
    welcome: 'Chào mừng đến với',
    search_placeholder: 'Tìm món...',
    bestseller: 'Bán chạy',
    out_of_stock: 'Hết món',
    view_cart: 'Xem giỏ hàng',
    items_count: (n) => `${n} món`,
    add_to_cart: 'Thêm vào giỏ',
    notes_label: 'Ghi chú cho nhà bếp',
    notes_placeholder: 'Ví dụ: ít muối, không hành...',
    required: 'Bắt buộc',
    your_cart: 'Giỏ hàng của bạn',
    empty_cart: 'Giỏ hàng đang trống',
    empty_cart_hint: 'Thêm món ngon từ thực đơn để bắt đầu.',
    subtotal: 'Tạm tính',
    vat: 'Thuế VAT (10%)',
    total: 'Tổng cộng',
    place_order: 'Đặt món',
    placing_order: 'Đang gửi xuống bếp...',
    your_order: 'Đơn hàng của bạn',
    status_pending: 'Chờ xác nhận',
    status_preparing: 'Đang chuẩn bị',
    status_ready: 'Sẵn sàng',
    status_served: 'Đã phục vụ',
    order_more: 'Đặt thêm món',
    request_bill: 'Yêu cầu thanh toán',
    session_summary: 'Tổng kết phiên',
    session_started: 'Bắt đầu lúc',
    duration: 'Thời lượng',
    orders_history: 'Các lượt gọi món',
    submitted_at: 'Gọi lúc',
    call_waiter: 'Gọi nhân viên',
    pay_now: 'Thanh toán',
    toast_added: 'Đã thêm vào giỏ',
    toast_order_placed: 'Đã gửi đơn hàng xuống bếp',
    toast_waiter: 'Đã gửi yêu cầu đến nhân viên',
    toast_bill: 'Đã gửi yêu cầu thanh toán',
    back: 'Quay lại',
    qty: 'Số lượng',
    minutes: 'phút',
    no_results: 'Không tìm thấy món phù hợp',
    confirm_order: 'Xác nhận đơn',
  },
  en: {
    restaurant: 'Quán Cơm Tấm Sài Gòn',
    tagline: 'Saigon flavors — served at your table',
    table: 'Table',
    area: 'Area',
    floor: '2nd Floor — Garden Section',
    now: 'Now',
    start_ordering: 'Start ordering',
    session_hint: 'Your ordering session stays open for 3 hours. You can add items anytime.',
    welcome: 'Welcome to',
    search_placeholder: 'Search dishes...',
    bestseller: 'Bestseller',
    out_of_stock: 'Sold out',
    view_cart: 'View cart',
    items_count: (n) => `${n} item${n === 1 ? '' : 's'}`,
    add_to_cart: 'Add to cart',
    notes_label: 'Note for the kitchen',
    notes_placeholder: 'e.g. less salt, no onion...',
    required: 'Required',
    your_cart: 'Your cart',
    empty_cart: 'Your cart is empty',
    empty_cart_hint: 'Add something tasty from the menu to get started.',
    subtotal: 'Subtotal',
    vat: 'VAT (10%)',
    total: 'Total',
    place_order: 'Place order',
    placing_order: 'Sending to kitchen...',
    your_order: 'Your order',
    status_pending: 'Pending',
    status_preparing: 'Preparing',
    status_ready: 'Ready',
    status_served: 'Served',
    order_more: 'Order more',
    request_bill: 'Request bill',
    session_summary: 'Session summary',
    session_started: 'Started at',
    duration: 'Duration',
    orders_history: 'Orders placed',
    submitted_at: 'Placed at',
    call_waiter: 'Call waiter',
    pay_now: 'Pay now',
    toast_added: 'Added to cart',
    toast_order_placed: 'Order sent to kitchen',
    toast_waiter: 'Waiter has been called',
    toast_bill: 'Bill request sent',
    back: 'Back',
    qty: 'Quantity',
    minutes: 'min',
    no_results: 'No dishes match your search',
    confirm_order: 'Confirm order',
  },
};

function formatVND(amount) {
  // 85000 -> "85.000đ"
  const rounded = Math.round(amount);
  const parts = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts + 'đ';
}

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function priceForItem(item, selectedOptions) {
  // selectedOptions: { groupId: optionId | optionId[] }
  let total = item.price;
  for (const group of item.option_groups) {
    const sel = selectedOptions[group.id];
    if (!sel) continue;
    if (group.type === 'single') {
      const opt = group.options.find((o) => o.id === sel);
      if (opt) total += opt.price_modifier;
    } else {
      for (const optId of sel) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) total += opt.price_modifier;
      }
    }
  }
  return total;
}

function defaultSelections(item) {
  // Pick first option for required single groups, [] for multi groups.
  const sel = {};
  for (const group of item.option_groups) {
    if (group.type === 'single') {
      sel[group.id] = group.options[0].id;
    } else {
      sel[group.id] = [];
    }
  }
  return sel;
}

function summarizeOptions(item, selectedOptions, lang) {
  // Build a comma-joined human-readable summary, omitting "none"/default-only groups when sensible.
  const parts = [];
  for (const group of item.option_groups) {
    const sel = selectedOptions[group.id];
    if (group.type === 'single' && sel) {
      const opt = group.options.find((o) => o.id === sel);
      if (opt) parts.push(lang === 'vi' ? opt.name_vi : opt.name_en);
    } else if (group.type === 'multi' && sel && sel.length) {
      for (const optId of sel) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) parts.push((lang === 'vi' ? '+ ' : '+ ') + (lang === 'vi' ? opt.name_vi : opt.name_en));
      }
    }
  }
  return parts.join(' · ');
}

Object.assign(window, {
  MENU,
  CATEGORIES,
  DICT,
  formatVND,
  formatTime,
  priceForItem,
  defaultSelections,
  summarizeOptions,
});
