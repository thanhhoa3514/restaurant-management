import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const outputPath = resolve('docs/diagrams/erd-restaurant-management-rut-gon.drawio')

const colors = {
  strong: { fill: '#EAF2F8', stroke: '#1F4E78' },
  dependent: { fill: '#F2F2F2', stroke: '#666666' },
  associative: { fill: '#FFF2CC', stroke: '#B8860B' },
}

const groups = [
  { id: 'group_identity', title: '1. NHÀ HÀNG, NGƯỜI DÙNG VÀ PHÂN QUYỀN', x: 40, y: 100, w: 1430, h: 490, color: '#D9EAF7' },
  { id: 'group_venue', title: '2. KHU VỰC, BÀN VÀ PHIÊN PHỤC VỤ', x: 1500, y: 100, w: 1460, h: 490, color: '#E2F0D9' },
  { id: 'group_menu', title: '3. THỰC ĐƠN', x: 40, y: 630, w: 1880, h: 650, color: '#FFF2CC' },
  { id: 'group_ordering', title: '4. GỌI MÓN VÀ LỊCH SỬ TRẠNG THÁI', x: 1950, y: 630, w: 1010, h: 650, color: '#FCE4D6' },
  { id: 'group_kitchen', title: '5. BẾP', x: 40, y: 1320, w: 980, h: 570, color: '#E4DFEC' },
  { id: 'group_billing', title: '6. HÓA ĐƠN VÀ THANH TOÁN', x: 1050, y: 1320, w: 1370, h: 570, color: '#DDEBF7' },
  { id: 'group_support', title: '7. NHẬT KÝ VÀ CẤU HÌNH', x: 2450, y: 1320, w: 510, h: 570, color: '#EDEDED' },
]

const tables = [
  {
    id: 'roles',
    type: 'strong',
    x: 80,
    y: 180,
    fields: ['PK id', 'name (UQ)', 'display_name', 'is_system'],
  },
  {
    id: 'permissions',
    type: 'strong',
    x: 360,
    y: 180,
    fields: ['PK id', 'code (UQ)', 'module', 'display_name'],
  },
  {
    id: 'role_permissions',
    type: 'associative',
    x: 220,
    y: 390,
    fields: ['PK, FK role_id', 'PK, FK permission_id', 'created_at'],
  },
  {
    id: 'restaurants',
    type: 'strong',
    x: 650,
    y: 180,
    fields: ['PK id', 'code (UQ)', 'name', 'status', 'timezone'],
  },
  {
    id: 'users',
    type: 'strong',
    x: 930,
    y: 180,
    fields: ['PK id', 'FK restaurant_id', 'FK role_id', 'username', 'status'],
  },
  {
    id: 'user_sessions',
    type: 'dependent',
    x: 1210,
    y: 390,
    fields: ['PK id', 'FK restaurant_id', 'FK user_id', 'expires_at', 'revoked_at'],
  },
  {
    id: 'areas',
    type: 'strong',
    x: 1540,
    y: 180,
    fields: ['PK id', 'FK restaurant_id', 'name', 'display_order', 'is_active'],
  },
  {
    id: 'tables',
    type: 'strong',
    x: 1820,
    y: 180,
    fields: ['PK id', 'FK restaurant_id', 'FK area_id', 'code', 'status'],
  },
  {
    id: 'qr_codes',
    type: 'dependent',
    x: 2100,
    y: 390,
    fields: ['PK id', 'FK restaurant_id', 'FK table_id', 'token (UQ)', 'is_active'],
  },
  {
    id: 'table_merge_groups',
    type: 'strong',
    x: 2380,
    y: 180,
    fields: ['PK id', 'FK restaurant_id', 'FK merged_by', 'is_active'],
  },
  {
    id: 'dining_sessions',
    type: 'strong',
    x: 2660,
    y: 390,
    fields: ['PK id', 'FK restaurant_id', 'FK table_id', 'FK merge_group_id', 'session_code', 'status'],
  },
  {
    id: 'categories',
    type: 'strong',
    x: 80,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK parent_id', 'name', 'slug', 'is_active'],
  },
  {
    id: 'menu_items',
    type: 'strong',
    x: 380,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK category_id', 'code', 'name', 'base_price_vnd', 'status'],
  },
  {
    id: 'menu_item_variants',
    type: 'dependent',
    x: 680,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK menu_item_id', 'name', 'price_vnd', 'is_default'],
  },
  {
    id: 'option_groups',
    type: 'strong',
    x: 980,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'name', 'selection_type', 'min/max_selections'],
  },
  {
    id: 'options',
    type: 'dependent',
    x: 1280,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK option_group_id', 'name', 'price_delta_vnd'],
  },
  {
    id: 'menu_item_option_groups',
    type: 'associative',
    x: 1580,
    y: 720,
    fields: ['PK, FK restaurant_id', 'PK, FK menu_item_id', 'PK, FK option_group_id', 'display_order'],
  },
  {
    id: 'orders',
    type: 'strong',
    x: 1990,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK dining_session_id', 'order_number', 'order_type', 'status'],
  },
  {
    id: 'order_items',
    type: 'dependent',
    x: 2310,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK order_id', 'FK menu_item_id', 'quantity', 'status', 'total_amount_vnd'],
  },
  {
    id: 'order_item_options',
    type: 'dependent',
    x: 2630,
    y: 720,
    fields: ['PK id', 'FK restaurant_id', 'FK order_item_id', 'FK option_id', 'price_delta_snapshot_vnd'],
  },
  {
    id: 'order_item_status_history',
    type: 'dependent',
    x: 2070,
    y: 1030,
    fields: ['PK id', 'FK restaurant_id', 'FK order_item_id', 'from_status → to_status', 'changed_at'],
  },
  {
    id: 'cancel_requests',
    type: 'dependent',
    x: 2490,
    y: 1030,
    fields: ['PK id', 'FK restaurant_id', 'FK order_item_id', 'status', 'reviewed_by'],
  },
  {
    id: 'kitchen_tickets',
    type: 'strong',
    x: 90,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK order_id', 'FK dining_session_id', 'station', 'status'],
  },
  {
    id: 'kitchen_ticket_items',
    type: 'dependent',
    x: 430,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK kitchen_ticket_id', 'FK order_item_id', 'status'],
  },
  {
    id: 'invoices',
    type: 'strong',
    x: 1090,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK dining_session_id', 'FK order_id', 'invoice_number', 'status', 'total/paid/change_vnd'],
  },
  {
    id: 'invoice_items',
    type: 'dependent',
    x: 1380,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK invoice_id', 'FK order_item_id', 'quantity', 'total_amount_vnd'],
  },
  {
    id: 'payment_methods',
    type: 'strong',
    x: 1670,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'code', 'type', 'is_active'],
  },
  {
    id: 'payments',
    type: 'strong',
    x: 1960,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK invoice_id', 'FK payment_method_id', 'amount_vnd', 'change_amount_vnd', 'status'],
  },
  {
    id: 'payment_webhook_events',
    type: 'dependent',
    x: 1670,
    y: 1690,
    fields: ['PK id', 'FK restaurant_id', 'FK payment_id', 'provider + event_id (UQ)', 'processed_at'],
  },
  {
    id: 'discounts',
    type: 'strong',
    x: 2050,
    y: 1690,
    fields: ['PK id', 'FK restaurant_id', 'code', 'type', 'value/percent', 'is_active'],
  },
  {
    id: 'audit_logs',
    type: 'dependent',
    x: 2490,
    y: 1410,
    fields: ['PK id', 'FK restaurant_id', 'FK user_id', 'action', 'entity_type/id', 'created_at'],
  },
  {
    id: 'system_settings',
    type: 'dependent',
    x: 2720,
    y: 1690,
    fields: ['PK id', 'FK restaurant_id', 'key (UQ)', 'value', 'value_type'],
  },
]

const edges = [
  ['roles', 'role_permissions'],
  ['permissions', 'role_permissions'],
  ['restaurants', 'users'],
  ['roles', 'users'],
  ['users', 'user_sessions'],
  ['restaurants', 'areas'],
  ['areas', 'tables'],
  ['tables', 'qr_codes'],
  ['table_merge_groups', 'dining_sessions'],
  ['tables', 'dining_sessions'],
  ['categories', 'categories', 'parent'],
  ['categories', 'menu_items'],
  ['menu_items', 'menu_item_variants'],
  ['option_groups', 'options'],
  ['menu_items', 'menu_item_option_groups'],
  ['option_groups', 'menu_item_option_groups'],
  ['dining_sessions', 'orders'],
  ['orders', 'order_items'],
  ['menu_items', 'order_items'],
  ['menu_item_variants', 'order_items'],
  ['order_items', 'order_item_options'],
  ['options', 'order_item_options'],
  ['order_items', 'order_item_status_history'],
  ['order_items', 'cancel_requests'],
  ['orders', 'kitchen_tickets'],
  ['dining_sessions', 'kitchen_tickets'],
  ['tables', 'kitchen_tickets'],
  ['kitchen_tickets', 'kitchen_ticket_items'],
  ['order_items', 'kitchen_ticket_items'],
  ['dining_sessions', 'invoices'],
  ['orders', 'invoices'],
  ['invoices', 'invoice_items'],
  ['order_items', 'invoice_items'],
  ['payment_methods', 'payments'],
  ['invoices', 'payments'],
  ['payments', 'payment_webhook_events'],
  ['users', 'audit_logs'],
  ['restaurants', 'system_settings'],
]

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function tableValue(table) {
  const typeLabel = {
    strong: 'THỰC THỂ CHÍNH',
    dependent: 'THỰC THỂ PHỤ THUỘC',
    associative: 'BẢNG LIÊN KẾT',
  }[table.type]
  const fields = table.fields.map((field) => `<div>${escapeXml(field)}</div>`).join('')
  return `<div style="text-align:center"><b>${escapeXml(table.id)}</b></div><div style="text-align:center;font-size:9px">${typeLabel}</div><hr>${fields}`
}

function groupCell(group) {
  return `
        <mxCell id="${group.id}" value="${escapeXml(group.title)}" style="rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingTop=10;spacingLeft=12;fontSize=15;fontStyle=1;fillColor=${group.color};strokeColor=#999999;opacity=35;dashed=1;" vertex="1" parent="1">
          <mxGeometry x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" as="geometry"/>
        </mxCell>`
}

function tableCell(table) {
  const color = colors[table.type]
  const height = 75 + table.fields.length * 17
  return `
        <mxCell id="${table.id}" value="${escapeXml(tableValue(table))}" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=8;fontSize=11;fillColor=${color.fill};strokeColor=${color.stroke};strokeWidth=1.5;" vertex="1" parent="1">
          <mxGeometry x="${table.x}" y="${table.y}" width="250" height="${height}" as="geometry"/>
        </mxCell>`
}

function edgeCell([source, target, label], index) {
  const isSelf = source === target
  const style = [
    'edgeStyle=orthogonalEdgeStyle',
    'rounded=1',
    'orthogonalLoop=1',
    'jettySize=auto',
    'html=1',
    'startArrow=ERone',
    'endArrow=ERmany',
    'startFill=0',
    'endFill=0',
    'strokeColor=#555555',
    'fontSize=9',
  ].join(';')
  const geometry = isSelf
    ? '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="60" y="820"/><mxPoint x="60" y="690"/></Array></mxGeometry>'
    : '<mxGeometry relative="1" as="geometry"/>'
  return `
        <mxCell id="rel_${index + 1}" value="${label ? escapeXml(label) : ''}" style="${style};" edge="1" parent="1" source="${source}" target="${target}">
          ${geometry}
        </mxCell>`
}

const legend = `
        <mxCell id="legend" value="${escapeXml(
          '<b>CHÚ GIẢI</b><br><font color="#1F4E78">■</font> Thực thể chính<br><font color="#666666">■</font> Thực thể phụ thuộc<br><font color="#B8860B">■</font> Bảng liên kết<br>PK: khóa chính · FK: khóa ngoại · UQ: duy nhất',
        )}" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacing=10;fontSize=11;fillColor=#FFFFFF;strokeColor=#333333;" vertex="1" parent="1">
          <mxGeometry x="80" y="1940" width="520" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="note_tenant" value="${escapeXml(
          '<b>Lược giản để dễ đọc:</b> restaurant_id có trong hầu hết bảng nghiệp vụ. Sơ đồ chỉ vẽ một số đường nối với restaurants; các FK người thao tác như created_by, reviewed_by, served_by cũng được giữ trong dữ liệu nhưng không nối hết bằng đường.',
        )}" style="shape=note;whiteSpace=wrap;html=1;size=15;align=left;verticalAlign=middle;spacing=10;fontSize=11;fillColor=#FFFBEA;strokeColor=#A67C00;" vertex="1" parent="1">
          <mxGeometry x="650" y="1940" width="900" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="note_weak" value="${escapeXml(
          '<b>Lưu ý về “thực thể yếu”:</b> role_permissions và menu_item_option_groups là bảng liên kết có khóa ghép từ bảng cha. Các bảng màu xám có UUID riêng nên không phải thực thể yếu theo định nghĩa chặt, nhưng phụ thuộc vòng đời vào bảng cha.',
        )}" style="shape=note;whiteSpace=wrap;html=1;size=15;align=left;verticalAlign=middle;spacing=10;fontSize=11;fillColor=#F5F5F5;strokeColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="1600" y="1940" width="1280" height="120" as="geometry"/>
        </mxCell>`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="65bd71144e" modified="2026-07-25T00:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="erd-restaurant-management" name="ERD rút gọn - 32 bảng">
    <mxGraphModel dx="3100" dy="2150" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="3100" pageHeight="2150" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="title" value="ERD RÚT GỌN — RESTAURANT MANAGEMENT SYSTEM (32 BẢNG)" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=22;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="900" y="25" width="1300" height="45" as="geometry"/>
        </mxCell>
${groups.map(groupCell).join('')}
${tables.map(tableCell).join('')}
${edges.map(edgeCell).join('')}
${legend}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, xml, 'utf8')
console.log(`Generated ${outputPath}: ${tables.length} tables, ${edges.length} relationships`)
