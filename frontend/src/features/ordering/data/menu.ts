import type { MenuItem, OptionGroup } from '../types'

const RICE_PHO_OPTIONS: OptionGroup[] = [
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
]

const DRINK_OPTIONS: OptionGroup[] = [
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
]

const RAW_MENU: Omit<MenuItem, 'option_groups'>[] = [
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
    sub_images: [
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop',
    ],
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
    sub_images: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop',
    ],
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
]

function getOptionsForCategory(category: string): OptionGroup[] {
  if (category === 'drink') return DRINK_OPTIONS
  if (category === 'dessert') return [DRINK_OPTIONS[1]]
  return RICE_PHO_OPTIONS
}

export const MENU: MenuItem[] = RAW_MENU.map((item) => ({
  ...item,
  option_groups: getOptionsForCategory(item.category),
}))

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU.find((m) => m.id === id)
}
