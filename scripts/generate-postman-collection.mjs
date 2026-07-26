import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'docs/postman')
const collectionPath = resolve(outputDir, 'restaurant-management.postman_collection.json')
const environmentPath = resolve(outputDir, 'restaurant-management.local.postman_environment.json')

const jsonHeaders = [
  { key: 'Accept', value: 'application/json', type: 'text' },
  { key: 'Content-Type', value: 'application/json', type: 'text' },
]

const auth = {
  public: { type: 'noauth' },
  staff: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{access_token}}', type: 'string' }],
  },
  guest: {
    type: 'apikey',
    apikey: [
      { key: 'key', value: 'X-Session-Token', type: 'string' },
      { key: 'value', value: '{{session_token}}', type: 'string' },
      { key: 'in', value: 'header', type: 'string' },
    ],
  },
}

const raw = (value) => (typeof value === 'string' ? value.trim() : JSON.stringify(value, null, 2))

function request(name, method, path, options = {}) {
  const req = {
    name,
    request: {
      method,
      header: options.json === false ? options.headers ?? [] : [...jsonHeaders, ...(options.headers ?? [])],
      auth: auth[options.auth ?? 'public'],
      url: path.startsWith('{{ws_url}}') ? path : `{{base_url}}${path}`,
      description: options.description ?? '',
    },
    response: [],
  }
  if (options.body !== undefined) {
    req.request.body = {
      mode: 'raw',
      raw: raw(options.body),
      options: { raw: { language: options.bodyLanguage ?? 'json' } },
    }
  }
  if (options.tests?.length) {
    req.event = [{
      listen: 'test',
      script: { type: 'text/javascript', exec: options.tests },
    }]
  }
  return req
}

const folder = (name, description, items) => ({
  name,
  description,
  item: items,
})

const parseData = [
  'let body = {};',
  'try { body = pm.response.json(); } catch (_) {}',
  'const data = body && body.data ? body.data : {};',
]

const saveLogin = [
  ...parseData,
  'if (data.token) pm.collectionVariables.set("access_token", data.token);',
  'if (data.refresh_token) pm.collectionVariables.set("refresh_token", data.refresh_token);',
  'if (data.user_id) pm.collectionVariables.set("user_id", data.user_id);',
]

const saveRefresh = [
  ...parseData,
  'if (data.token) pm.collectionVariables.set("access_token", data.token);',
  'if (data.refresh_token) pm.collectionVariables.set("refresh_token", data.refresh_token);',
]

const saveQR = [
  ...parseData,
  'const first = Array.isArray(data) ? data[0] : null;',
  'if (first && first.table_id) pm.collectionVariables.set("table_id", first.table_id);',
  'if (first && (first.qr_token || first.token)) pm.collectionVariables.set("qr_token", first.qr_token || first.token);',
]

const saveJoin = [
  ...parseData,
  'if (data.session_token) pm.collectionVariables.set("session_token", data.session_token);',
  'if (data.session_id) pm.collectionVariables.set("session_id", data.session_id);',
  'if (data.table_id) pm.collectionVariables.set("table_id", data.table_id);',
]

const saveCategory = [
  ...parseData,
  'const first = Array.isArray(data) ? data[0] : null;',
  'if (first && first.id) pm.collectionVariables.set("category_id", first.id);',
]

const saveMenuItem = [
  ...parseData,
  'const first = Array.isArray(data) ? data[0] : null;',
  'if (first && first.id) pm.collectionVariables.set("menu_item_id", first.id);',
  'if (first && first.version) pm.collectionVariables.set("menu_item_version", first.version);',
]

const saveMenuDetail = [
  ...parseData,
  'if (data.id) pm.collectionVariables.set("menu_item_id", data.id);',
  'if (data.version) pm.collectionVariables.set("menu_item_version", data.version);',
  'if (Array.isArray(data.variants) && data.variants[0]) pm.collectionVariables.set("variant_id", data.variants[0].id);',
  'if (Array.isArray(data.option_groups) && data.option_groups[0] && data.option_groups[0].options && data.option_groups[0].options[0]) pm.collectionVariables.set("option_id", data.option_groups[0].options[0].id);',
]

const saveOrder = [
  ...parseData,
  'if (data.order_id) pm.collectionVariables.set("order_id", data.order_id);',
  'if (data.version) pm.collectionVariables.set("order_version", data.version);',
  'if (Array.isArray(data.items) && data.items[0]) pm.collectionVariables.set("order_item_id", data.items[0].order_item_id || data.items[0].id);',
  'if (Array.isArray(data.items) && data.items[1]) pm.collectionVariables.set("second_order_item_id", data.items[1].order_item_id || data.items[1].id);',
]

const saveGuestOrders = [
  ...parseData,
  'const first = Array.isArray(data.orders) ? data.orders[0] : null;',
  'if (first && first.id) pm.collectionVariables.set("order_id", first.id);',
  'if (first && first.version) pm.collectionVariables.set("order_version", first.version);',
  'if (first && first.items && first.items[0]) pm.collectionVariables.set("order_item_id", first.items[0].order_item_id || first.items[0].id);',
  'if (first && first.items && first.items[1]) pm.collectionVariables.set("second_order_item_id", first.items[1].order_item_id || first.items[1].id);',
]

const saveStaffTables = [
  ...parseData,
  'const tables = Array.isArray(data.tables) ? data.tables : [];',
  'const withSession = tables.find((table) => table.session);',
  'if (tables[0] && tables[0].id) pm.collectionVariables.set("table_id", tables[0].id);',
  'if (withSession && withSession.session) {',
  '  pm.collectionVariables.set("session_id", withSession.session.id);',
  '  const orders = withSession.session.orders || [];',
  '  if (orders[0]) pm.collectionVariables.set("order_id", orders[0].id);',
  '  if (orders[0] && orders[0].items && orders[0].items[0]) pm.collectionVariables.set("order_item_id", orders[0].items[0].id);',
  '}',
]

const saveInvoice = [
  ...parseData,
  'const invoice = data.invoice || (Array.isArray(data.invoices) ? data.invoices[0] : null);',
  'if (invoice) {',
  '  if (invoice.id) pm.collectionVariables.set("invoice_id", invoice.id);',
  '  if (invoice.version) pm.collectionVariables.set("invoice_version", invoice.version);',
  '  if (invoice.payment && invoice.payment.payment_number) pm.collectionVariables.set("payment_number", invoice.payment.payment_number);',
  '  if (invoice.items && invoice.items[0] && invoice.items[0].order_item_id) pm.collectionVariables.set("order_item_id", invoice.items[0].order_item_id);',
  '  if (invoice.items && invoice.items[1] && invoice.items[1].order_item_id) pm.collectionVariables.set("second_order_item_id", invoice.items[1].order_item_id);',
  '}',
]

const menuBody = `{
  "category_id": "{{category_id}}",
  "name": "Món thử từ Postman",
  "description": "Món được tạo để kiểm thử API",
  "short_description": "Món kiểm thử",
  "base_price_vnd": 99000,
  "image_url": "/images/menu/lau-thai-tomyum.webp",
  "is_available": true,
  "availability_status": "AVAILABLE",
  "status": "DRAFT",
  "is_featured": false,
  "is_spicy": false,
  "station": "KITCHEN",
  "display_order": 99,
  "variants": [],
  "option_groups": []
}`

const orderBody = `{
  "note": "Đơn kiểm thử từ Postman",
  "items": [
    {
      "menu_item_id": "{{menu_item_id}}",
      "variant_id": null,
      "quantity": 1,
      "note": "Ít cay",
      "options": []
    }
  ]
}`

const collection = {
  info: {
    _postman_id: '7ba27186-c66c-4b28-a4a4-d73a5d645b2c',
    name: 'Restaurant Management API',
    description: [
      'Collection được sinh trực tiếp từ các Gin route hiện tại của dự án.',
      '',
      'Luồng khuyến nghị:',
      '1. Chạy Public > Staff login để tự lưu access_token/refresh_token.',
      '2. Chạy Staff > Dining > List table QR để tự lưu table_id/qr_token.',
      '3. Chạy Public > Join dining session để tự lưu session_token/session_id.',
      '4. Chạy Guest > Menu và Guest > Ordering theo thứ tự để tự lưu các UUID.',
      '',
      'Tài khoản seed mặc định: manager/demo1234. Thay staff_username để kiểm tra phân quyền cashier, server hoặc kitchen.',
      'Các request tạo/sửa/xóa làm thay đổi dữ liệu thật; không dùng Run collection toàn bộ trên production.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [{
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        'const contentType = pm.response.headers.get("Content-Type") || "";',
        'if (contentType.includes("application/json")) {',
        '  let payload;',
        '  try { payload = pm.response.json(); } catch (_) {}',
        '  if (payload && Object.prototype.hasOwnProperty.call(payload, "code")) {',
        '    pm.test("Envelope code khớp HTTP status", () => pm.expect(payload.code).to.eql(pm.response.code));',
        '  }',
        '}',
      ],
    },
  }],
  variable: [
    { key: 'base_url', value: 'http://localhost:8080' },
    { key: 'ws_url', value: 'ws://localhost:8080' },
    { key: 'staff_username', value: 'manager' },
    { key: 'staff_password', value: 'demo1234' },
    { key: 'access_token', value: '' },
    { key: 'refresh_token', value: '' },
    { key: 'qr_token', value: '' },
    { key: 'session_token', value: '' },
    { key: 'provider', value: 'mock' },
    { key: 'payment_method_code', value: 'cash' },
    { key: 'table_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'second_table_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'area_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'session_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'second_session_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'merge_group_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'category_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'menu_item_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'menu_item_version', value: '1' },
    { key: 'variant_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'option_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'order_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'order_version', value: '1' },
    { key: 'order_item_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'second_order_item_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'cancel_request_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'invoice_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'invoice_version', value: '1' },
    { key: 'payment_number', value: '' },
    { key: 'user_id', value: '00000000-0000-0000-0000-000000000000' },
    { key: 'managed_user_id', value: '00000000-0000-0000-0000-000000000000' },
  ],
  item: [
    folder('00. Operations', 'Health, tài liệu API và WebSocket.', [
      request('Liveness', 'GET', '/health', { json: false }),
      request('Readiness', 'GET', '/health/ready', { json: false }),
      request('OpenAPI YAML', 'GET', '/openapi.yaml', { json: false }),
      request('Swagger UI redirect', 'GET', '/swagger', { json: false }),
      request('WebSocket handshake [mở bằng New > WebSocket]', 'GET', '{{ws_url}}/ws', {
        json: false,
        description: [
          'Postman HTTP collection không lưu native WebSocket request theo schema v2.1.',
          'Tạo WebSocket request tới {{ws_url}}/ws, sau khi Connected gửi một trong hai message:',
          'Staff: {"type":"_auth","access_token":"{{access_token}}"}',
          'Guest: {"type":"_auth","session_token":"{{session_token}}"}',
          'Server phản hồi event _auth_ok nếu xác thực thành công.',
        ].join('\n'),
      }),
    ]),
    folder('01. Public', 'Không yêu cầu JWT hoặc QR session token.', [
      request('Staff login', 'POST', '/api/v1/restaurant/auth/login', {
        body: `{
  "username": "{{staff_username}}",
  "password": "{{staff_password}}"
}`,
        tests: saveLogin,
        description: 'Tự lưu access_token, refresh_token và user_id vào collection variables.',
      }),
      request('Refresh staff token', 'POST', '/api/v1/restaurant/auth/refresh', {
        body: `{
  "refresh_token": "{{refresh_token}}"
}`,
        tests: saveRefresh,
        description: 'Refresh token được rotate; script tự ghi đè cả hai token.',
      }),
      request('List guest tables and QR tokens', 'GET', '/api/v1/customer/tables', {
        tests: saveQR,
        description: 'Public demo endpoint. Tự lưu table_id và qr_token của phần tử đầu tiên.',
      }),
      request('Join dining session by QR', 'POST', '/api/v1/customer/sessions/join', {
        body: `{
  "qr_token": "{{qr_token}}",
  "guest_name": "Khách Postman"
}`,
        tests: saveJoin,
        description: 'Tự lưu session_token, session_id và table_id. Phiên QR mới có thể cần nhân viên verify trước khi gọi món.',
      }),
      request('Payment webhook [provider manual]', 'POST', '/api/v1/billing/payments/webhook/{{provider}}', {
        body: `{
  "event_id": "postman-event-{{$timestamp}}",
  "payment_number": "{{payment_number}}",
  "status": "COMPLETED"
}`,
        description: 'Request dành cho tích hợp thủ công. Mỗi provider có payload và chữ ký riêng; cần bổ sung header đúng cấu hình gateway.',
      }),
      request('Mock payment completion [non-production]', 'POST', '/api/v1/billing/payments/mock/complete', {
        body: `{
  "payment_number": "{{payment_number}}",
  "result": "success"
}`,
        tests: saveInvoice,
        description: 'Chỉ được đăng ký khi APP_ENV khác production.',
      }),
    ]),
    folder('02. Guest - Menu & Ordering', 'Menu là public; các API ordering dùng X-Session-Token: {{session_token}}.', [
      request('List menu categories', 'GET', '/api/v1/customer/menu/categories', {
        tests: saveCategory,
      }),
      request('List menu items', 'GET', '/api/v1/customer/menu/items?category_id={{category_id}}', {
        tests: saveMenuItem,
      }),
      request('Get menu item detail', 'GET', '/api/v1/customer/menu/items/{{menu_item_id}}', {
        tests: saveMenuDetail,
      }),
      request('Place order', 'POST', '/api/v1/customer/orders', {
        auth: 'guest',
        body: orderBody,
        tests: saveOrder,
      }),
      request('View current session orders', 'GET', '/api/v1/customer/orders', {
        auth: 'guest',
        tests: saveGuestOrders,
        description: 'Tự lưu order_id, order_version và order_item_id để dùng cho sửa/hủy.',
      }),
      request('Edit placed order items', 'PUT', '/api/v1/customer/orders/{{order_id}}/items', {
        auth: 'guest',
        body: `{
  "version": {{order_version}},
  "items": [
    {
      "order_item_id": "{{order_item_id}}",
      "quantity": 2,
      "note": "Cập nhật từ Postman",
      "options": []
    }
  ]
}`,
        tests: saveOrder,
        description: 'Chỉ món PLACED, chưa được phục vụ xác nhận, mới được sửa. Món bị bỏ khỏi mảng items sẽ được hủy.',
      }),
      request('Cancel whole placed order', 'DELETE', '/api/v1/customer/orders/{{order_id}}', {
        auth: 'guest',
        description: 'Chỉ dùng khi toàn bộ món còn ở PLACED. Request này thay đổi dữ liệu thật.',
      }),
      request('Request cancellation after confirmation', 'POST', '/api/v1/customer/orders/{{order_id}}/cancel-requests', {
        auth: 'guest',
        body: `{
  "order_item_id": "{{order_item_id}}",
  "reason": "Khách đổi ý"
}`,
        tests: [
          ...parseData,
          'if (data.cancel_request_id) pm.collectionVariables.set("cancel_request_id", data.cancel_request_id);',
        ],
      }),
      request('Request bill', 'POST', '/api/v1/customer/request-bill', { auth: 'guest' }),
      request('Call waiter', 'POST', '/api/v1/customer/call-waiter', { auth: 'guest' }),
    ]),
    folder('03. Staff - Identity', 'JWT staff; các API quản trị cần permission identity.manage.', [
      request('Current staff session', 'GET', '/api/v1/restaurant/auth/me', { auth: 'staff' }),
      request('Admin dashboard', 'GET', '/api/v1/restaurant/dashboard', { auth: 'staff' }),
      request('List staff users', 'GET', '/api/v1/restaurant/users', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const first = Array.isArray(data) ? data[0] : null;',
          'if (first && first.id) pm.collectionVariables.set("managed_user_id", first.id);',
        ],
      }),
      request('List roles', 'GET', '/api/v1/restaurant/users/roles', { auth: 'staff' }),
      request('Create staff user', 'POST', '/api/v1/restaurant/users', {
        auth: 'staff',
        body: `{
  "action": "create",
  "username": "postman_{{$timestamp}}",
  "full_name": "Nhân viên Postman",
  "email": "postman@example.com",
  "phone": "0900000000",
  "role": "server",
  "password": "Postman123!"
}`,
        tests: [
          ...parseData,
          'if (data.id) pm.collectionVariables.set("managed_user_id", data.id);',
        ],
      }),
      request('Update staff user', 'POST', '/api/v1/restaurant/users', {
        auth: 'staff',
        body: `{
  "action": "update",
  "user_id": "{{managed_user_id}}",
  "full_name": "Nhân viên Postman đã sửa",
  "phone": "0911111111"
}`,
      }),
      request('Set staff user status', 'POST', '/api/v1/restaurant/users', {
        auth: 'staff',
        body: `{
  "action": "set_status",
  "user_id": "{{managed_user_id}}",
  "status": "ACTIVE"
}`,
      }),
      request('Reset staff password', 'POST', '/api/v1/restaurant/users', {
        auth: 'staff',
        body: `{
  "action": "reset_password",
  "user_id": "{{managed_user_id}}",
  "password": "Postman456!"
}`,
      }),
      request('Logout current staff session', 'POST', '/api/v1/restaurant/auth/logout', {
        auth: 'staff',
        tests: [
          'if (pm.response.code >= 200 && pm.response.code < 300) {',
          '  pm.collectionVariables.unset("access_token");',
          '  pm.collectionVariables.unset("refresh_token");',
          '}',
        ],
        description: 'Đặt cuối luồng kiểm thử vì request này revoke JWT session hiện tại.',
      }),
    ]),
    folder('04. Staff - Catalog', 'JWT staff; yêu cầu permission catalog.manage.', [
      request('List categories', 'GET', '/api/v1/restaurant/menu/categories', {
        auth: 'staff',
        tests: saveCategory,
      }),
      request('List menu items', 'GET', '/api/v1/restaurant/menu/items?category_id={{category_id}}', {
        auth: 'staff',
        tests: saveMenuItem,
      }),
      request('Get menu item detail', 'GET', '/api/v1/restaurant/menu/items/{{menu_item_id}}', {
        auth: 'staff',
        tests: saveMenuDetail,
      }),
      request('Create menu item', 'POST', '/api/v1/restaurant/menu/items', {
        auth: 'staff',
        body: menuBody,
        tests: [
          ...parseData,
          'if (data.id) pm.collectionVariables.set("menu_item_id", data.id);',
          'if (data.version) pm.collectionVariables.set("menu_item_version", data.version);',
        ],
      }),
      request('Update menu item', 'PUT', '/api/v1/restaurant/menu/items/{{menu_item_id}}', {
        auth: 'staff',
        body: menuBody.replace(/\n}$/, ',\n  "version": {{menu_item_version}}\n}'),
        tests: [
          ...parseData,
          'if (data.version) pm.collectionVariables.set("menu_item_version", data.version);',
        ],
      }),
      request('Toggle menu item availability', 'PATCH', '/api/v1/restaurant/menu/items/{{menu_item_id}}/availability', {
        auth: 'staff',
        body: `{
  "is_available": false,
  "availability_status": "TEMPORARILY_UNAVAILABLE",
  "version": {{menu_item_version}}
}`,
        tests: [
          ...parseData,
          'if (data.version) pm.collectionVariables.set("menu_item_version", data.version);',
        ],
      }),
      request('Presign menu image upload', 'POST', '/api/v1/restaurant/menu/upload/presign', {
        auth: 'staff',
        body: `{
  "extension": ".webp",
  "content_type": "image/webp"
}`,
        description: 'Trả về URL upload nếu S3-compatible storage đã được cấu hình.',
      }),
      request('Delete menu item', 'DELETE', '/api/v1/restaurant/menu/items/{{menu_item_id}}', {
        auth: 'staff',
        body: `{
  "version": {{menu_item_version}}
}`,
        description: 'Đặt cuối luồng Catalog; đây là soft delete.',
      }),
    ]),
    folder('05. Staff - Dining', 'Quản lý bàn, khu vực và phiên ăn. Permission thay đổi theo endpoint.', [
      request('List table QR codes', 'GET', '/api/v1/restaurant/tables/qrs', {
        auth: 'staff',
        tests: saveQR,
      }),
      request('Ensure or rotate table QR', 'POST', '/api/v1/restaurant/tables/qrs', {
        auth: 'staff',
        body: `{
  "table_id": "{{table_id}}",
  "rotate": false
}`,
        tests: [
          ...parseData,
          'if (data.table_id) pm.collectionVariables.set("table_id", data.table_id);',
          'if (data.token) pm.collectionVariables.set("qr_token", data.token);',
        ],
      }),
      request('Open dining session', 'POST', '/api/v1/restaurant/sessions', {
        auth: 'staff',
        body: `{
  "table_id": "{{table_id}}"
}`,
        tests: saveJoin,
      }),
      request('List pending verification sessions', 'GET', '/api/v1/restaurant/sessions/pending-verification', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const first = Array.isArray(data) ? data[0] : null;',
          'if (first && first.id) pm.collectionVariables.set("session_id", first.id);',
          'if (first && first.session_id) pm.collectionVariables.set("session_id", first.session_id);',
        ],
      }),
      request('Verify pending session', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/verify', {
        auth: 'staff',
      }),
      request('Merge sessions', 'POST', '/api/v1/restaurant/sessions/merge', {
        auth: 'staff',
        body: `{
  "session_ids": [
    "{{session_id}}",
    "{{second_session_id}}"
  ],
  "note": "Ghép bàn từ Postman"
}`,
        tests: [
          ...parseData,
          'if (data.merge_group_id) pm.collectionVariables.set("merge_group_id", data.merge_group_id);',
        ],
      }),
      request('Split merged sessions', 'POST', '/api/v1/restaurant/sessions/split', {
        auth: 'staff',
        body: `{
  "merge_group_id": "{{merge_group_id}}"
}`,
      }),
      request('Close dining session', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/close', {
        auth: 'staff',
        description: 'Cashier permission; phiên chỉ đóng được theo điều kiện nghiệp vụ thanh toán.',
      }),
      request('List areas', 'GET', '/api/v1/restaurant/areas', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const areas = Array.isArray(data.areas) ? data.areas : [];',
          'if (areas[0] && areas[0].id) pm.collectionVariables.set("area_id", areas[0].id);',
        ],
      }),
      request('Create area', 'POST', '/api/v1/restaurant/areas', {
        auth: 'staff',
        body: `{
  "name": "Khu Postman {{$timestamp}}",
  "description": "Khu vực kiểm thử",
  "display_order": 99
}`,
        tests: [
          ...parseData,
          'if (data.id) pm.collectionVariables.set("area_id", data.id);',
        ],
      }),
      request('Update area', 'PATCH', '/api/v1/restaurant/areas/{{area_id}}', {
        auth: 'staff',
        body: `{
  "name": "Khu Postman đã sửa",
  "description": "Cập nhật từ Postman",
  "display_order": 98,
  "is_active": true
}`,
      }),
      request('Create table', 'POST', '/api/v1/restaurant/tables', {
        auth: 'staff',
        body: `{
  "area_id": "{{area_id}}",
  "code": "P{{$timestamp}}",
  "name": "Bàn Postman",
  "capacity": 4,
  "status": "AVAILABLE"
}`,
        tests: [
          ...parseData,
          'if (data.id) pm.collectionVariables.set("table_id", data.id);',
        ],
      }),
      request('Update table', 'PATCH', '/api/v1/restaurant/tables/{{table_id}}', {
        auth: 'staff',
        body: `{
  "area_id": "{{area_id}}",
  "code": "POSTMAN",
  "name": "Bàn Postman đã sửa",
  "capacity": 6,
  "status": "AVAILABLE"
}`,
      }),
      request('Delete table', 'DELETE', '/api/v1/restaurant/tables/{{table_id}}', {
        auth: 'staff',
        description: 'Có thể bị từ chối nếu bàn đang có phiên hoạt động.',
      }),
      request('Delete area', 'DELETE', '/api/v1/restaurant/areas/{{area_id}}', {
        auth: 'staff',
        description: 'Đặt sau Delete table; vẫn có thể bị từ chối nếu khu vực đang còn bàn khác.',
      }),
      request('List daily sessions', 'GET', '/api/v1/restaurant/sessions/daily?date=&status=ALL&search=', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const first = Array.isArray(data.sessions) ? data.sessions[0] : null;',
          'if (first && first.id) pm.collectionVariables.set("session_id", first.id);',
        ],
        description: 'date có định dạng YYYY-MM-DD; có thể để trống để dùng ngày hiện tại.',
      }),
      request('Get daily session detail', 'GET', '/api/v1/restaurant/sessions/daily/{{session_id}}', {
        auth: 'staff',
      }),
    ]),
    folder('06. Staff - Ordering', 'Nhân viên phục vụ xác nhận, cập nhật món và xử lý tín hiệu bàn.', [
      request('List staff tables and orders', 'GET', '/api/v1/restaurant/tables', {
        auth: 'staff',
        tests: saveStaffTables,
      }),
      request('Request bill for session', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/request-bill', {
        auth: 'staff',
      }),
      request('Reopen session', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/reopen', {
        auth: 'staff',
      }),
      request('Acknowledge waiter call', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/ack-waiter-call', {
        auth: 'staff',
      }),
      request('Update order item status', 'PATCH', '/api/v1/restaurant/order-items/{{order_item_id}}/status', {
        auth: 'staff',
        body: `{
  "status": "SERVED"
}`,
        description: 'Status phải tuân theo state transition hiện tại.',
      }),
      request('Confirm placed item', 'POST', '/api/v1/restaurant/order-items/{{order_item_id}}/confirm', {
        auth: 'staff',
        description: 'Chuyển món PLACED sang PENDING để đưa vào luồng bếp.',
      }),
      request('Reject placed item', 'POST', '/api/v1/restaurant/order-items/{{order_item_id}}/reject', {
        auth: 'staff',
        body: `{
  "reason": "Không thể phục vụ món"
}`,
      }),
      request('Mark order item unavailable', 'POST', '/api/v1/restaurant/order-items/{{order_item_id}}/unavailable', {
        auth: 'staff',
        body: `{
  "reason": "Hết nguyên liệu"
}`,
      }),
      request('Create takeaway order', 'POST', '/api/v1/restaurant/orders/takeaway', {
        auth: 'staff',
        body: `{
  "customer_name": "Khách mang về",
  "customer_phone": "0900000000",
  "pickup_time": null,
  "note": "Đơn mang về từ Postman",
  "items": [
    {
      "menu_item_id": "{{menu_item_id}}",
      "variant_id": null,
      "quantity": 1,
      "note": "",
      "options": []
    }
  ]
}`,
        tests: saveOrder,
      }),
      request('Add takeaway items to dining session', 'POST', '/api/v1/restaurant/sessions/{{session_id}}/takeaway-items', {
        auth: 'staff',
        body: orderBody,
        tests: saveOrder,
      }),
    ]),
    folder('07. Staff - Kitchen', 'JWT staff; yêu cầu permission kitchen.operate.', [
      request('Kitchen queue', 'GET', '/api/v1/restaurant/kitchen/queue', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const ticket = Array.isArray(data.tickets) ? data.tickets[0] : null;',
          'if (ticket && ticket.items && ticket.items[0]) pm.collectionVariables.set("order_item_id", ticket.items[0].order_item_id);',
        ],
      }),
      request('Update kitchen item status', 'PATCH', '/api/v1/restaurant/kitchen/items/{{order_item_id}}/status', {
        auth: 'staff',
        body: `{
  "status": "PREPARING"
}`,
      }),
      request('Mark kitchen item unavailable', 'POST', '/api/v1/restaurant/kitchen/items/{{order_item_id}}/unavailable', {
        auth: 'staff',
        body: `{
  "reason": "Bếp hết nguyên liệu"
}`,
      }),
      request('List pending cancel requests', 'GET', '/api/v1/restaurant/kitchen/cancel-requests', {
        auth: 'staff',
        tests: [
          ...parseData,
          'const first = Array.isArray(data.cancel_requests) ? data.cancel_requests[0] : null;',
          'if (first && first.id) pm.collectionVariables.set("cancel_request_id", first.id);',
        ],
      }),
      request('Review cancel request', 'POST', '/api/v1/restaurant/kitchen/cancel-requests/{{cancel_request_id}}/review', {
        auth: 'staff',
        body: `{
  "action": "approve",
  "note": "Bếp đồng ý hủy"
}`,
      }),
    ]),
    folder('08. Staff - Billing', 'JWT staff; yêu cầu permission billing.process.', [
      request('Build invoice', 'POST', '/api/v1/restaurant/invoices', {
        auth: 'staff',
        body: `{
  "dining_session_id": "{{session_id}}"
}`,
        tests: saveInvoice,
      }),
      request('List session invoices', 'GET', '/api/v1/restaurant/invoices?dining_session_id={{session_id}}', {
        auth: 'staff',
        tests: saveInvoice,
      }),
      request('Split invoice', 'POST', '/api/v1/restaurant/invoices/split', {
        auth: 'staff',
        body: `{
  "dining_session_id": "{{session_id}}",
  "groups": [
    {
      "label": "Nhóm 1",
      "order_item_ids": ["{{order_item_id}}"]
    },
    {
      "label": "Nhóm 2",
      "order_item_ids": ["{{second_order_item_id}}"]
    }
  ]
}`,
        tests: saveInvoice,
        description: 'Cần ít nhất hai order_item_id khác nhau thuộc cùng phiên.',
      }),
      request('Adjust invoice discount', 'POST', '/api/v1/restaurant/invoices/{{invoice_id}}/adjust', {
        auth: 'staff',
        body: `{
  "discount_amount_vnd": 10000,
  "discount_reason": "Khuyến mãi Postman"
}`,
        tests: saveInvoice,
      }),
      request('Process partial payment', 'POST', '/api/v1/restaurant/invoices/{{invoice_id}}/pay-partial', {
        auth: 'staff',
        body: `{
  "payment_method_code": "cash",
  "received_amount_vnd": 100000,
  "reference_code": "PARTIAL-{{$timestamp}}"
}`,
        tests: saveInvoice,
        description: 'Có thể gọi nhiều lần cho đến khi tổng paid_amount_vnd đạt total_amount_vnd.',
      }),
      request('Process full payment', 'POST', '/api/v1/restaurant/invoices/{{invoice_id}}/pay', {
        auth: 'staff',
        body: `{
  "payment_method_code": "{{payment_method_code}}",
  "received_amount_vnd": 1000000,
  "reference_code": "POSTMAN-{{$timestamp}}"
}`,
        tests: saveInvoice,
        description: 'Thanh toán toàn bộ phần còn lại. Với cash, tiền dư được tính vào change_amount_vnd.',
      }),
      request('Void invoice', 'POST', '/api/v1/restaurant/invoices/{{invoice_id}}/void', {
        auth: 'staff',
        body: `{
  "void_reason": "Hủy hóa đơn kiểm thử"
}`,
        tests: saveInvoice,
        description: 'Đặt cuối luồng hóa đơn; request này thay đổi trạng thái hóa đơn.',
      }),
    ]),
  ],
}

const environment = {
  id: 'f6024808-2df8-405c-9b26-7e0b66a289b8',
  name: 'Restaurant Management - Local',
  values: [
    { key: 'base_url', value: 'http://localhost:8080', enabled: true },
    { key: 'ws_url', value: 'ws://localhost:8080', enabled: true },
    { key: 'staff_username', value: 'manager', enabled: true },
    { key: 'staff_password', value: 'demo1234', enabled: true },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: '2026-07-23T00:00:00.000Z',
  _postman_exported_using: 'Codex Postman generator',
}

mkdirSync(outputDir, { recursive: true })
writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`)
writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`)

console.log(`Wrote ${collectionPath}`)
console.log(`Wrote ${environmentPath}`)
