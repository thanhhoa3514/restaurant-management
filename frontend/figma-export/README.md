# Figma HTML Export

Static, self-contained export of the product screens. Two formats:

- `index.html` — every frame on one board (17 frames).
- `screens/*.html` — one file per screen, for importing screens individually.

| File | Frame | Size |
| --- | --- | --- |
| `screens/01-home-portal.html` | Home - Portal | 390 × 844 |
| `screens/02-login-staff.html` | Login - Staff | 390 × 844 |
| `screens/03-client-qr-landing.html` | Client - QR Landing | 390 × 844 |
| `screens/04-client-menu.html` | Client - Menu | 390 × 844 |
| `screens/05-client-order-status.html` | Client - Order Status | 390 × 844 |
| `screens/06-client-session-summary.html` | Client - Session Summary | 390 × 844 |
| `screens/07-client-invoice.html` | Client - Invoice | 390 × 844 |
| `screens/08-admin-dashboard.html` | Admin - Dashboard | 1440 × 1024 |
| `screens/09-admin-table-qr.html` | Admin - Table QR | 1440 × 1024 |
| `screens/10-admin-catalog.html` | Admin - Catalog | 1440 × 1024 |
| `screens/11-admin-floor-plan.html` | Admin - Floor Plan Builder | 1440 × 1024 |
| `screens/12-admin-staff.html` | Admin - Staff | 1440 × 1024 |
| `screens/13-admin-reports.html` | Admin - Reports | 1440 × 1024 |
| `screens/14-admin-settings.html` | Admin - Settings | 1440 × 1024 |
| `screens/15-staff-cashier.html` | Staff - Cashier | 1440 × 1024 |
| `screens/16-staff-waiter.html` | Staff - Waiter | 1440 × 1024 |
| `screens/17-staff-kitchen-kds.html` | Staff - Kitchen KDS | 1440 × 1024 |

## Preview

From `frontend/figma-export`:

```bash
python3 -m http.server 4174
```

Open `http://localhost:4174` for the full board, or `http://localhost:4174/screens/<file>.html` for a single screen.

## Import into Figma

1. Serve the folder with the command above.
2. In Figma, open an HTML import plugin such as `html.to.design`.
3. Import `http://localhost:4174` for everything at once, or one `screens/...` URL at a time for per-screen import.
4. Keep the imported frame names from each `data-figma-frame` value.

Each file uses inline CSS and SVG only. No API, authentication, JavaScript, font download, or external image URL is required.

## Regenerating `screens/` after editing `index.html`

`index.html` is the source of truth. Each screen file is the same `<head>`, icon `<defs>`, and one `export-item` block. If you edit or add frames in `index.html`, re-split it (the split keys off `data-figma-frame` attributes).
