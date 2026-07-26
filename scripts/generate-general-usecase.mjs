import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const outputPath = resolve('docs/use-cases/usecase-tong-quat-he-thong.drawio')

const BLACK = '#000000'
const WHITE = '#ffffff'

const actors = [
  { id: 'actor_guest', label: 'Khách hàng', x: 55, y: 255 },
  { id: 'actor_waiter', label: 'Phục vụ', x: 55, y: 700 },
  { id: 'actor_kitchen', label: 'Bếp', x: 55, y: 1115 },
  { id: 'actor_cashier', label: 'Thu ngân', x: 2955, y: 1455 },
  { id: 'actor_manager', label: 'Quản lý', x: 2955, y: 1900 },
  { id: 'actor_gateway', label: 'Cổng thanh toán', x: 2955, y: 1650 },
]

const useCases = [
  // Khách hàng
  { id: 'uc_g01', label: 'Quét QR và vào phiên', x: 390, y: 190, actor: 'actor_guest' },
  { id: 'uc_g02', label: 'Xem thực đơn', x: 790, y: 190, actor: 'actor_guest' },
  { id: 'uc_g03', label: 'Quản lý giỏ hàng', x: 1190, y: 190, actor: 'actor_guest' },
  { id: 'uc_g04', label: 'Đặt món / gọi thêm món', x: 1590, y: 190, actor: 'actor_guest' },
  { id: 'uc_g05', label: 'Sửa / hủy món đã gọi', x: 1990, y: 190, actor: 'actor_guest' },
  { id: 'uc_g06', label: 'Theo dõi trạng thái món', x: 2390, y: 190, actor: 'actor_guest' },

  // Phục vụ
  { id: 'uc_p09', label: 'Mở phiên cho khách', x: 390, y: 560, actor: 'actor_waiter' },
  { id: 'uc_p10', label: 'Xem lưới bàn', x: 790, y: 560, actor: 'actor_waiter' },
  { id: 'uc_p15', label: 'Xem chi tiết phiên', x: 1190, y: 560, actor: 'actor_waiter' },
  { id: 'uc_p13', label: 'Đánh dấu món đã phục vụ', x: 1590, y: 560, actor: 'actor_waiter' },
  { id: 'uc_p14', label: 'Yêu cầu thanh toán hộ', x: 1990, y: 560, actor: 'actor_waiter' },
  { id: 'uc_p32', label: 'Gộp phiên', x: 790, y: 720, actor: 'actor_waiter' },
  { id: 'uc_p33', label: 'Tách phiên', x: 1190, y: 720, actor: 'actor_waiter' },
  { id: 'uc_p38', label: 'Tạo đơn mang về', x: 1590, y: 720, actor: 'actor_waiter' },

  // Bếp
  { id: 'uc_k16', label: 'Xem hàng đợi món', x: 520, y: 1050, actor: 'actor_kitchen' },
  { id: 'uc_k17', label: 'Cập nhật trạng thái món', x: 1000, y: 1050, actor: 'actor_kitchen' },
  { id: 'uc_k18', label: 'Xử lý yêu cầu hủy món', x: 1480, y: 1050, actor: 'actor_kitchen' },
  { id: 'uc_k19', label: 'Xem lịch sử trạng thái món', x: 1960, y: 1050, actor: 'actor_kitchen' },
  { id: 'uc_k39', label: 'Báo hết món', x: 2440, y: 1050, actor: 'actor_kitchen' },

  // Thu ngân
  { id: 'uc_c20', label: 'Xem phiên chờ thanh toán', x: 390, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c21', label: 'Xem hóa đơn', x: 790, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c22', label: 'Điều chỉnh hóa đơn', x: 1190, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c34', label: 'Tách hóa đơn', x: 1590, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c23', label: 'Thanh toán hóa đơn', x: 1990, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c35', label: 'Thanh toán một phần', x: 2390, y: 1370, actor: 'actor_cashier' },
  { id: 'uc_c36', label: 'Hủy hóa đơn', x: 790, y: 1530, actor: 'actor_cashier' },
  { id: 'uc_c25', label: 'Đóng phiên', x: 1190, y: 1530, actor: 'actor_cashier' },
  { id: 'uc_c37', label: 'Mở lại phiên', x: 1590, y: 1530, actor: 'actor_cashier' },

  // Quản lý
  { id: 'uc_m26', label: 'Quản lý thực đơn', x: 520, y: 1850, actor: 'actor_manager' },
  { id: 'uc_m27', label: 'Quản lý trạng thái món', x: 1080, y: 1850, actor: 'actor_manager' },
  { id: 'uc_m28', label: 'Quản lý mã QR', x: 1640, y: 1850, actor: 'actor_manager' },
  { id: 'uc_m30', label: 'Quản lý người dùng và phân quyền', x: 2200, y: 1850, actor: 'actor_manager' },
]

const bands = [
  { id: 'band_guest', label: 'NHÓM CHỨC NĂNG KHÁCH HÀNG', y: 140 },
  { id: 'band_waiter', label: 'NHÓM CHỨC NĂNG PHỤC VỤ', y: 510 },
  { id: 'band_kitchen', label: 'NHÓM CHỨC NĂNG BẾP', y: 1000 },
  { id: 'band_cashier', label: 'NHÓM CHỨC NĂNG THU NGÂN', y: 1320 },
  { id: 'band_manager', label: 'NHÓM CHỨC NĂNG QUẢN LÝ', y: 1800 },
]

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function actorCell({ id, label, x, y }) {
  return `
        <mxCell id="${id}" value="${escapeXml(label)}" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;whiteSpace=wrap;fillColor=${WHITE};strokeColor=${BLACK};fontColor=${BLACK};fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="110" height="120" as="geometry"/>
        </mxCell>`
}

function useCaseCell({ id, label, x, y }) {
  return `
        <mxCell id="${id}" value="${escapeXml(label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=${WHITE};strokeColor=${BLACK};fontColor=${BLACK};fontSize=14;strokeWidth=1.3;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="300" height="90" as="geometry"/>
        </mxCell>`
}

function associationCell({ id, actor }) {
  return `
        <mxCell id="edge_${actor}_${id}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;startArrow=none;strokeColor=${BLACK};fontColor=${BLACK};" edge="1" parent="1" source="${actor}" target="${id}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`
}

function bandCell({ id, label, y }) {
  return `
        <mxCell id="${id}" value="${escapeXml(label)}" style="text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=12;fontStyle=1;fontColor=${BLACK};fillColor=none;strokeColor=none;" vertex="1" parent="1">
          <mxGeometry x="300" y="${y}" width="520" height="30" as="geometry"/>
        </mxCell>`
}

const separators = [490, 980, 1300, 1780]
  .map(
    (y, index) => `
        <mxCell id="separator_${index + 1}" style="edgeStyle=none;html=1;endArrow=none;startArrow=none;dashed=1;dashPattern=6 6;strokeColor=${BLACK};" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="300" y="${y}" as="sourcePoint"/>
            <mxPoint x="2860" y="${y}" as="targetPoint"/>
          </mxGeometry>
        </mxCell>`,
  )
  .join('')

const gatewayAssociation = `
        <mxCell id="edge_gateway_payment" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;startArrow=none;strokeColor=${BLACK};fontColor=${BLACK};" edge="1" parent="1" source="actor_gateway" target="uc_c23">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="2026-07-26T00:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="usecase-overview" name="Use case tổng quát">
    <mxGraphModel dx="3200" dy="2200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="3200" pageHeight="2200" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="title" value="SƠ ĐỒ USE CASE TỔNG QUÁT HỆ THỐNG QUẢN LÝ NHÀ HÀNG" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=22;fontStyle=1;fontColor=${BLACK};fillColor=none;strokeColor=none;" vertex="1" parent="1">
          <mxGeometry x="650" y="25" width="1900" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="system_boundary" value="HỆ THỐNG QUẢN LÝ NHÀ HÀNG" style="rounded=0;whiteSpace=wrap;html=1;fillColor=${WHITE};strokeColor=${BLACK};fontColor=${BLACK};verticalAlign=top;align=left;spacingTop=12;spacingLeft=12;fontSize=14;fontStyle=1;strokeWidth=1.5;" vertex="1" parent="1">
          <mxGeometry x="260" y="95" width="2640" height="1980" as="geometry"/>
        </mxCell>
${bands.map(bandCell).join('')}
${separators}
${actors.map(actorCell).join('')}
${useCases.map(useCaseCell).join('')}
${useCases.map(associationCell).join('')}
${gatewayAssociation}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, xml, 'utf8')
console.log(`Generated ${outputPath}: ${actors.length} actors, ${useCases.length} use cases`)
