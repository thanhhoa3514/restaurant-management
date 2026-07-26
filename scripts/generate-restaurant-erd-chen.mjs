import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const outputPath = resolve('docs/diagrams/erd-restaurant-management-chen.drawio')
const columns = [300, 850, 1400, 1950, 2500, 3050]
const rows = [350, 1100, 1850]

// ERD mức ý niệm: đúng 18 thực thể cốt lõi.
// Tên thực thể dùng tiếng Anh, viết hoa và không dấu theo yêu cầu tài liệu.
const entities = [
  ['roles', 'ROLE', 0, 0, false, ['id*', 'name', 'display_name']],
  ['users', 'USER', 1, 0, false, ['id*', 'username', 'full_name', 'status']],
  ['restaurants', 'RESTAURANT', 2, 0, false, ['id*', 'code', 'name', 'status']],
  ['areas', 'AREA', 3, 0, false, ['id*', 'name', 'is_active']],
  ['tables', 'TABLE', 4, 0, false, ['id*', 'code', 'capacity', 'status', 'qr_token']],
  ['table_merge_groups', 'TABLE_MERGE_GROUP', 5, 0, false, ['id*', 'is_active', 'created_at']],

  ['categories', 'CATEGORY', 0, 1, false, ['id*', 'name', 'slug', 'is_active']],
  ['menu_items', 'MENU_ITEM', 1, 1, false, ['id*', 'code', 'name', 'base_price_vnd', 'variants{}']],
  ['option_groups', 'OPTION_GROUP', 2, 1, false, ['id*', 'name', 'selection_type', 'options{}']],
  ['dining_sessions', 'DINING_SESSION', 3, 1, false, ['id*', 'session_code', 'status', 'opened_at']],
  ['orders', 'ORDER', 4, 1, false, ['id*', 'order_number', 'order_type', 'status']],
  ['kitchen_tickets', 'KITCHEN_TICKET', 5, 1, false, ['id*', 'ticket_number', 'station', 'status']],

  ['discounts', 'DISCOUNT', 0, 2, false, ['id*', 'code', 'type', 'value']],
  ['cancel_requests', 'CANCEL_REQUEST', 1, 2, true, ['id*', 'reason', 'status']],
  ['order_items', 'ORDER_ITEM', 2, 2, true, ['id*', 'quantity', 'status', 'total_amount_vnd', 'selected_options{}']],
  ['invoices', 'INVOICE', 3, 2, false, ['id*', 'invoice_number', 'status', 'total_amount_vnd', 'paid_amount_vnd']],
  ['payments', 'PAYMENT', 4, 2, true, ['id*', 'payment_number', 'amount_vnd', 'change_amount_vnd', 'status']],
  ['payment_methods', 'PAYMENT_METHOD', 5, 2, false, ['id*', 'code', 'type', 'is_active']],
]

const relations = [
  ['role_user', 'CO VAI TRO', 'roles', 'users', '1', 'N', 575, 350],
  ['restaurant_user', 'QUAN LY', 'restaurants', 'users', '1', 'N', 1125, 350],
  ['restaurant_area', 'CO KHU VUC', 'restaurants', 'areas', '1', 'N', 1675, 350],
  ['area_table', 'CHUA', 'areas', 'tables', '1', 'N', 2225, 350],
  ['table_session', 'MO PHIEN', 'tables', 'dining_sessions', '1', 'N', 2225, 725],
  ['merge_session', 'GOM PHIEN', 'table_merge_groups', 'dining_sessions', '0..1', 'N', 2775, 725],

  ['category_parent', 'DANH MUC CHA', 'categories', 'categories', '1', 'N', 80, 900],
  ['category_menu', 'PHAN LOAI', 'categories', 'menu_items', '1', 'N', 575, 1100],
  ['menu_group', 'AP DUNG', 'menu_items', 'option_groups', 'N', 'N', 1125, 1100],
  ['session_order', 'PHAT SINH', 'dining_sessions', 'orders', '1', 'N', 2225, 1100],
  ['order_ticket', 'TAO PHIEU', 'orders', 'kitchen_tickets', '1', 'N', 2775, 1100],

  ['menu_order_item', 'DUOC GOI', 'menu_items', 'order_items', '1', 'N', 1125, 1475],
  ['group_order_item', 'CHON TUY CHON', 'option_groups', 'order_items', 'N', 'N', 1400, 1475],
  ['order_order_item', 'GOM', 'orders', 'order_items', '1', 'N', 1675, 1475, true],
  ['session_invoice', 'LAP HOA DON', 'dining_sessions', 'invoices', '1', 'N', 1950, 1475],
  ['ticket_order_item', 'CHUA MON', 'kitchen_tickets', 'order_items', 'N', 'N', 2500, 1475],

  ['cancel_order_item', 'YEU CAU HUY', 'order_items', 'cancel_requests', '1', 'N', 1125, 1850, true],
  ['invoice_order_item', 'TINH TIEN', 'invoices', 'order_items', 'N', 'N', 1675, 1850],
  ['invoice_payment', 'DUOC TRA', 'invoices', 'payments', '1', 'N', 2225, 1850, true],
  ['method_payment', 'DUNG', 'payment_methods', 'payments', '1', 'N', 2775, 1850],
  ['discount_invoice', 'AP DUNG GIAM', 'discounts', 'invoices', 'N', 'N', 850, 2225],
]

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function entityCell([id, label, column, row, weak]) {
  const x = columns[column] - 100
  const y = rows[row] - 34
  const style = `rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;fontStyle=1;${weak ? 'double=1;' : ''}`
  return `
        <mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="200" height="68" as="geometry"/>
        </mxCell>`
}

function attributeCells(entity) {
  const [entityId, , column, row, , attributes] = entity
  const centerX = columns[column]
  const centerY = rows[row]
  const topSlots =
    attributes.length <= 4
      ? [
          [centerX - 100, centerY - 115],
          [centerX + 100, centerY - 115],
        ]
      : [
          [centerX - 155, centerY - 115],
          [centerX, centerY - 135],
          [centerX + 155, centerY - 115],
        ]
  const bottomSlots = [
    [centerX - 100, centerY + 115],
    [centerX + 100, centerY + 115],
  ]
  const slots = [...topSlots, ...bottomSlots]

  return attributes
    .map((rawName, index) => {
      const isKey = rawName.endsWith('*')
      const isMulti = rawName.endsWith('{}')
      const name = rawName.replace(/\*|\{\}/g, '')
      const [cx, cy] = slots[index]
      const value = isKey ? `&lt;u&gt;${escapeXml(name)}&lt;/u&gt;` : escapeXml(name)
      return `
        <mxCell id="attr_${entityId}_${index + 1}" value="${value}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontSize=10;${isMulti ? 'double=1;' : ''}" vertex="1" parent="1">
          <mxGeometry x="${cx - 75}" y="${cy - 25}" width="150" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="attr_edge_${entityId}_${index + 1}" style="edgeStyle=none;html=1;endArrow=none;startArrow=none;strokeColor=#666666;" edge="1" parent="1" source="${entityId}" target="attr_${entityId}_${index + 1}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`
    })
    .join('')
}

function relationCells([id, label, firstEntity, secondEntity, firstCardinality, secondCardinality, centerX, centerY, identifying = false]) {
  return `
        <mxCell id="rel_${id}" value="${label}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontSize=9;${identifying ? 'double=1;' : ''}" vertex="1" parent="1">
          <mxGeometry x="${centerX - 72}" y="${centerY - 44}" width="144" height="88" as="geometry"/>
        </mxCell>
        <mxCell id="rel_edge_${id}_first" value="${escapeXml(firstCardinality)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;startArrow=none;fontSize=10;labelBackgroundColor=#FFFFFF;" edge="1" parent="1" source="${firstEntity}" target="rel_${id}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="rel_edge_${id}_second" value="${escapeXml(secondCardinality)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;startArrow=none;fontSize=10;labelBackgroundColor=#FFFFFF;" edge="1" parent="1" source="rel_${id}" target="${secondEntity}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`
}

const notes = `
        <mxCell id="legend" value="${escapeXml(
          '<b>CHU GIAI — ERD MUC Y NIEM</b><br>Hinh chu nhat: thuc the · Hinh oval: thuoc tinh · Thuoc tinh gach chan: khoa chinh<br>Oval doi: thuoc tinh da tri · Khung doi: thuc the phu thuoc · Hinh thoi: quan he',
        )}" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacing=10;fontSize=11;fillColor=#FFFFFF;strokeColor=#000000;" vertex="1" parent="1">
          <mxGeometry x="80" y="2290" width="1120" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="scope_note" value="${escapeXml(
          '<b>PHAM VI:</b> 18 thuc the nghiep vu cot loi. Da loai bang ha tang, log va chi tiet phan quyen. variants va qr_codes duoc gop thanh thuoc tinh; cac junction table duoc bieu dien bang quan he.',
        )}" style="shape=note;whiteSpace=wrap;html=1;size=15;align=left;verticalAlign=middle;spacing=10;fontSize=11;fillColor=#FFFBEA;strokeColor=#A67C00;" vertex="1" parent="1">
          <mxGeometry x="1300" y="2290" width="1900" height="120" as="geometry"/>
        </mxCell>`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="65bd71144e" modified="2026-07-25T00:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="erd-chen-conceptual" name="ERD Chen - Muc y niem - 18 entities">
    <mxGraphModel dx="3400" dy="2500" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="3300" pageHeight="2450" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="title" value="ERD RESTAURANT MANAGEMENT SYSTEM — MUC Y NIEM" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=22;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="900" y="25" width="1500" height="45" as="geometry"/>
        </mxCell>
${entities.map(entityCell).join('')}
${entities.map(attributeCells).join('')}
${relations.map(relationCells).join('')}
${notes}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, xml, 'utf8')
console.log(`Generated ${outputPath}: ${entities.length} conceptual entities, ${relations.length} relationships`)
