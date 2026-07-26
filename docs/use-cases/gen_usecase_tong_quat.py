#!/usr/bin/env python3
"""Sinh sơ đồ use-case TỔNG QUÁT (.drawio) cho toàn hệ thống.

Bố cục DỌC, đen trắng: use case xếp 1 cột trong ranh giới hệ thống,
nhóm theo vai trò; tác nhân chính bên trái, tác nhân phụ bên phải.

    python3 docs/use-cases/gen_usecase_tong_quat.py
"""
import os
import xml.sax.saxutils as su

OUT = os.path.join(os.path.dirname(__file__), "usecase-tong-quat-he-thong.drawio")

# ── Dữ liệu: (tác nhân, nhãn băng, [(mã UC, tên UC)]) ───────────────────────
BANDS = [
    ("Khách hàng", "NHÓM CHỨC NĂNG KHÁCH HÀNG", "#e8f0fe", [
        ("UC-01", "Quét QR vào phiên"),
        ("UC-02", "Xem thực đơn"),
        ("UC-03", "Đặt món"),
        ("UC-04", "Gọi thêm món"),
        ("UC-05a", "Sửa món đã gọi"),
        ("UC-05b", "Hủy món đã gọi"),
        ("UC-06", "Theo dõi trạng thái món"),
        ("UC-07", "Gọi nhân viên"),
        ("UC-08", "Yêu cầu thanh toán"),
    ]),
    ("Phục vụ", "NHÓM CHỨC NĂNG PHỤC VỤ", "#e6f4ea", [
        ("UC-09", "Mở phiên khách vãng lai"),
        ("UC-10", "Xem lưới bàn"),
        ("UC-11", "Theo dõi tín hiệu bàn"),
        ("UC-12", "Xác nhận gọi nhân viên"),
        ("UC-13", "Đánh dấu đã phục vụ"),
        ("UC-14", "Yêu cầu thanh toán hộ"),
        ("UC-15", "Xem chi tiết phiên theo bàn"),
        ("UC-32", "Gộp phiên"),
        ("UC-33", "Tách phiên"),
        ("UC-38", "Tạo đơn mang về"),
    ]),
    ("Bếp", "NHÓM CHỨC NĂNG BẾP", "#fff4e5", [
        ("UC-16", "Xem hàng đợi món"),
        ("UC-17", "Cập nhật trạng thái món"),
        ("UC-18", "Xử lý yêu cầu hủy món"),
        ("UC-19", "Xem lịch sử trạng thái món"),
        ("UC-39", "Báo hết món"),
    ]),
    ("Thu ngân", "NHÓM CHỨC NĂNG THU NGÂN", "#fce8e6", [
        ("UC-20", "Xem phiên chờ thanh toán"),
        ("UC-21", "Xem hóa đơn"),
        ("UC-22", "Điều chỉnh hóa đơn / giảm giá"),
        ("UC-23", "Xử lý thanh toán"),
        ("UC-24", "In hóa đơn"),
        ("UC-25", "Đóng phiên"),
        ("UC-34", "Tách hóa đơn"),
        ("UC-35", "Thanh toán một phần"),
        ("UC-36", "Hủy hóa đơn"),
        ("UC-37", "Mở lại phiên"),
    ]),
    ("Quản lý", "NHÓM CHỨC NĂNG QUẢN LÝ", "#f3e8fd", [
        ("UC-26", "Quản lý thực đơn"),
        ("UC-27", "Bật/tắt trạng thái còn-hết"),
        ("UC-28", "Quản lý mã QR theo bàn"),
        ("UC-29", "Quản lý bàn"),
        ("UC-29a", "Quản lý khu vực"),
        ("UC-30", "Quản lý người dùng & phân quyền"),
        ("UC-31", "Xem báo cáo và thống kê"),
    ]),
]

# Tác nhân phụ: cổng thanh toán tham gia các UC này
GATEWAY_UCS = ["UC-23", "UC-35"]

# ── Kích thước (bố cục DỌC: 1 cột, đen trắng) ──────────────────────────────
COLS = 1
UC_W, UC_H = 230, 46
GAP_X, GAP_Y = 0, 12
ROW_H = UC_H + GAP_Y
PAD = 26                      # lề trong ranh giới
LABEL_H = 24
BAND_GAP = 16

ACTOR_X, ACTOR_W, ACTOR_H = 30, 40, 66
BOUND_X = 150
INNER_X = BOUND_X + PAD
BOUND_W = COLS * (UC_W + GAP_X) - GAP_X + 2 * PAD
GW_X = BOUND_X + BOUND_W + 44

cells = []


def add(cell):
    cells.append("        " + cell)


def esc(s):
    return su.escape(s, {'"': "&quot;"})


def node(cid, value, style, x, y, w, h):
    add(f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def edge(cid, src, dst, style):
    add(f'<mxCell id="{cid}" style="{style}" edge="1" parent="1" source="{src}" target="{dst}">'
        f'<mxGeometry relative="1" as="geometry"/></mxCell>')


# ── Dựng sơ đồ ──────────────────────────────────────────────────────────────
y = 104
band_geoms = []
for actor, label, fill, ucs in BANDS:
    rows = -(-len(ucs) // COLS)
    band_geoms.append((actor, label, fill, ucs, y, rows))
    y += LABEL_H + rows * ROW_H + BAND_GAP

BOUND_Y = 74
BOUND_H = y - BAND_GAP + PAD - BOUND_Y
PAGE_W, PAGE_H = GW_X + 110, BOUND_Y + BOUND_H + 50

node("title", "SƠ ĐỒ USE CASE TỔNG QUÁT — HỆ THỐNG QUẢN LÝ NHÀ HÀNG QR",
     "text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=13;fontStyle=1;fillColor=none;strokeColor=none;",
     BOUND_X, 34, BOUND_W, 30)
node("boundary", "HỆ THỐNG QUẢN LÝ NHÀ HÀNG",
     "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;verticalAlign=top;align=left;"
     "spacingTop=6;spacingLeft=8;fontSize=11;fontStyle=1;strokeWidth=1.5;",
     BOUND_X, BOUND_Y, BOUND_W, BOUND_H)

uc_ids = {}
for bi, (actor, label, fill, ucs, by, rows) in enumerate(band_geoms):
    aid = f"actor{bi}"
    band_mid = by + LABEL_H + rows * ROW_H / 2
    node(aid, actor,
         "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontSize=10;",
         ACTOR_X, int(band_mid - ACTOR_H / 2), ACTOR_W, ACTOR_H)
    node(f"lbl{bi}", label,
         "text;html=1;align=left;verticalAlign=middle;fontSize=10;fontStyle=1;fillColor=none;strokeColor=none;",
         INNER_X, by, 260, LABEL_H)
    for i, (code, name) in enumerate(ucs):
        r, c = divmod(i, COLS)
        x = INNER_X + c * (UC_W + GAP_X)
        uy = by + LABEL_H + r * ROW_H
        cid = f"uc{code.replace('-', '')}"
        uc_ids[code] = cid
        node(cid, f"{code}\n{name}",
             "ellipse;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=9;verticalAlign=middle;",
             x, uy, UC_W, UC_H)
        edge(f"e{cid}", aid, cid,
             "endArrow=none;html=1;strokeColor=#000000;exitX=1;exitY=0.5;exitDx=0;exitDy=0;"
             "entryX=0;entryY=0.5;entryDx=0;entryDy=0;")

# Tác nhân phụ
gw_mid = band_geoms[3][4] + LABEL_H + band_geoms[3][5] * ROW_H / 2
node("actorGW", "Cổng thanh toán",
     "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontSize=10;",
     GW_X, int(gw_mid - ACTOR_H / 2), ACTOR_W, ACTOR_H)
for code in GATEWAY_UCS:
    edge(f"egw{code}", "actorGW", uc_ids[code],
         "endArrow=none;html=1;dashed=1;strokeColor=#000000;exitX=0;exitY=0.5;exitDx=0;exitDy=0;")

XML = f"""<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="claude" version="24.7.17">
  <diagram id="usecase-overview" name="Use case tổng quát">
    <mxGraphModel dx="{PAGE_W}" dy="{PAGE_H}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{PAGE_W}" pageHeight="{PAGE_H}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
{chr(10).join(cells)}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(XML)
print(f"{OUT}: {len(uc_ids)} use case, {len(BANDS)} tác nhân chính + 1 tác nhân phụ")
