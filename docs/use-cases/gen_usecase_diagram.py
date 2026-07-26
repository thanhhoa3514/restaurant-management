#!/usr/bin/env python3
"""Sinh usecase_diagram.drawio — sơ đồ use-case tổng quát, 2 cột, ĐEN TRẮNG viền đậm.

Cột trái: Khách hàng · Phục vụ · Bếp (tác nhân đứng bên trái)
Cột phải: Thu ngân · Quản lý       (tác nhân đứng bên phải)
Tác nhân phụ: Cổng thanh toán.

    python3 docs/use-cases/gen_usecase_diagram.py
"""
import os
import xml.sax.saxutils as su

OUT = os.path.join(os.path.dirname(__file__), "usecase_diagram.drawio")

# ── Dữ liệu: (tác nhân, [tên use case]) — mục có "+" là phần bổ sung ────────
LEFT = [
    ("Khách hàng", [
        "Quét QR vào phiên",
        "Xem thực đơn & đặt món",
        "Gọi thêm món",
        "Hủy / sửa món đã gọi",
        "Theo dõi trạng thái đơn",
        "Gọi nhân viên hỗ trợ",
        "Yêu cầu thanh toán",
    ]),
    ("Phục vụ", [
        "Mở phiên cho khách",
        "Xem sơ đồ bàn",
        "Theo dõi tín hiệu bàn",
        "Tiếp nhận yêu cầu khách",
        "Đánh dấu đã phục vụ",
        "Xem chi tiết phiên theo bàn",
        "Yêu cầu thanh toán hộ",
        "Gộp phiên",
        "Tách phiên",
        "Tạo đơn mang về",
    ]),
    ("Bếp", [
        "Tiếp nhận đơn",
        "Cập nhật trạng thái món",
        "Xử lý yêu cầu hủy món",
        "Xem lịch sử trạng thái món",
        "Báo hết món",
    ]),
]

RIGHT = [
    ("Thu ngân", [
        "Xem phiên chờ thanh toán",
        "Xem hóa đơn",
        "Điều chỉnh & giảm giá",
        "Tách hóa đơn",
        "Xử lý thanh toán",
        "Thanh toán một phần",
        "Hủy hóa đơn",
        "In hóa đơn",
        "Đóng phiên",
        "Mở lại phiên",
    ]),
    ("Quản lý", [
        "Quản lý thực đơn",
        "Bật / tắt trạng thái còn-hết",
        "Quản lý mã QR",
        "Quản lý bàn & khu vực",
        "Quản lý người dùng",
        "Xem báo cáo & thống kê",
    ]),
]

GATEWAY_UCS = ["Xử lý thanh toán", "Thanh toán một phần"]

# ── Kích thước & style (đen trắng, viền đậm) ───────────────────────────────
UC_W, UC_H, STEP = 240, 44, 60
GROUP_GAP = 22
TOP = 92
COL_L, COL_R = 232, 528
BOUND_X, BOUND_Y = 178, 42
BOUND_W = COL_R + UC_W + 40 - BOUND_X
ACTOR_W, ACTOR_H = 36, 60
ACTOR_LX, ACTOR_RX = 62, COL_R + UC_W + 78
GW_X = ACTOR_RX + 96

S_BOUND = ("rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=3;"
           "verticalAlign=top;fontColor=#000000;fontSize=14;fontStyle=1;spacingTop=10;")
S_UC = ("rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=2.5;"
        "fontColor=#000000;fontSize=12;")
S_ACTOR = ("shape=umlActor;whiteSpace=wrap;html=1;outlineConnect=0;fillColor=none;strokeColor=#000000;"
           "strokeWidth=2.5;fontColor=#000000;fontSize=12;fontStyle=1;verticalLabelPosition=bottom;verticalAlign=top;")
S_EDGE = ("endArrow=none;html=1;strokeColor=#000000;strokeWidth=1.5;"
          "exitX={ex};exitY=0.5;exitDx=0;exitDy=0;entryX={en};entryY=0.5;entryDx=0;entryDy=0;")
S_EDGE_GW = ("endArrow=none;html=1;dashed=1;strokeColor=#000000;strokeWidth=1.5;"
             "exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;")

cells = []
uc_ids = {}
uc_y = {}
_n = [0]


def nid(p):
    _n[0] += 1
    return f"{p}{_n[0]}"


def node(cid, value, style, x, y, w, h):
    cells.append(f'                <mxCell id="{cid}" value="{su.escape(value, {chr(34): "&quot;"})}" '
                 f'style="{style}" parent="1" vertex="1">'
                 f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def edge(src, dst, style):
    cells.append(f'                <mxCell id="{nid("e")}" style="{style}" parent="1" '
                 f'source="{src}" target="{dst}" edge="1">'
                 f'<mxGeometry relative="1" as="geometry"/></mxCell>')


def build_column(groups, col_x, actor_x, side):
    """side='L': tác nhân trái, nối vào cạnh trái UC. 'R': ngược lại."""
    y = TOP
    bottom = y
    for actor, ucs in groups:
        first_y = y
        aid = nid("actor")
        for name in ucs:
            cid = nid("uc")
            uc_ids[name] = cid
            uc_y[name] = y
            node(cid, name, S_UC, col_x, y, UC_W, UC_H)
            edge(aid, cid, S_EDGE.format(ex=1 if side == "L" else 0,
                                         en=0 if side == "L" else 1))
            y += STEP
        mid = (first_y + y - STEP + UC_H) / 2
        node(aid, actor, S_ACTOR, actor_x, int(mid - ACTOR_H / 2), ACTOR_W, ACTOR_H)
        bottom = y - STEP + UC_H
        y += GROUP_GAP
    return bottom


b1 = build_column(LEFT, COL_L, ACTOR_LX, "L")
b2 = build_column(RIGHT, COL_R, ACTOR_RX, "R")

BOUND_H = max(b1, b2) + 34 - BOUND_Y
PAGE_W, PAGE_H = GW_X + 140, BOUND_Y + BOUND_H + 60

# tác nhân phụ
gw = nid("actor")
gw_y = int(sum(uc_y[n] for n in GATEWAY_UCS) / len(GATEWAY_UCS) + UC_H / 2 - ACTOR_H / 2)
node(gw, "Cổng thanh toán", S_ACTOR, GW_X, gw_y, ACTOR_W, ACTOR_H)
for name in GATEWAY_UCS:
    edge(gw, uc_ids[name], S_EDGE_GW)

header = [f'                <mxCell id="boundary" value="Hệ thống quản lý nhà hàng - gọi món QR" '
          f'style="{S_BOUND}" parent="1" vertex="1">'
          f'<mxGeometry x="{BOUND_X}" y="{BOUND_Y}" width="{BOUND_W}" height="{BOUND_H}" as="geometry"/></mxCell>']

XML = f"""<mxfile host="app.diagrams.net" agent="claude">
    <diagram name="Use Case Diagram" id="usecase1">
        <mxGraphModel dx="{PAGE_W}" dy="{PAGE_H}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{PAGE_W}" pageHeight="{PAGE_H}" math="0" shadow="0">
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
{chr(10).join(header + cells)}
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(XML)
print(f"{OUT}: {len(uc_ids)} use case, {len(LEFT) + len(RIGHT)} tác nhân chính + 1 phụ, "
      f"page {PAGE_W}x{PAGE_H}")
