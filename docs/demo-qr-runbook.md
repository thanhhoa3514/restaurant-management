# Demo runbook — QR per table + guest ordering (thesis demo)

Goal: show the instructor the table QR screen, scan a QR with a phone on the
same Wi-Fi, land on the guest ordering page, and place a real order.

## 1. Start the stack

```bash
# Backend (Postgres on 127.0.0.1:5440, API on :8080)
cd backend
docker compose up -d --build

# Seed demo data (idempotent — safe to re-run right before the demo to reset)
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5440/restaurant?sslmode=disable' go run ./cmd/seed

# Frontend (listens on all interfaces — vite.config.ts has host: true)
cd ../frontend
npm run dev
```

## 2. Demo data

Restaurant **Zenith Lẩu Nướng** (code `DEMO`). Logins (password `demo1234`):
`manager`, `cashier`, `server`, `kitchen`.

3 areas / 12 tables, each with an active QR code:

| Area | Tables | Notes |
|---|---|---|
| Tầng trệt | T01–T06 | T01, T03 have an ACTIVE dining session |
| Tầng 2 - Sân vườn | T07–T10 | |
| Phòng VIP | V01–V02 | V01 has an ACTIVE dining session |

QR tokens are deterministic (`DEMO-T01` …), so printed/downloaded QR codes
stay valid across re-seeds. Menu: 7 categories, 24 hotpot/grill items, size
variants on the hotpot sets, spice-level options.

## 3. Show the QR screen

Login as `manager` → **/admin/table-qrs**. Tables are grouped per floor with
per-area QR counts. Click a table → right sheet shows the QR (encodes
`<origin>/order?t=<token>`), copy link, download PNG, or rotate the token.

## 4. Phone scan over Wi-Fi (WSL2)

The QR encodes the origin the admin page was opened on. For a phone to reach
it, the dev server must be reachable on the Windows LAN IP.

1. Find the Windows LAN IP (PowerShell): `ipconfig` → e.g. `192.168.1.50`.
2. Forward Windows → WSL (PowerShell **as Administrator**, WSL IP from
   `hostname -I` inside WSL):

   ```powershell
   netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5173 connectaddress=<WSL_IP> connectport=5173
   netsh advfirewall firewall add rule name="vite-demo" dir=in action=allow protocol=TCP localport=5173
   ```

   (Skip this entirely if WSL2 mirrored networking is enabled in
   `.wslconfig` — then the Windows IP just works.)
3. Open the admin QR page at `http://192.168.1.50:5173/admin/table-qrs` so the
   generated QR encodes the LAN-reachable origin — **not** `localhost`.
   Alternatively set `VITE_PUBLIC_ORIGIN=http://192.168.1.50:5173` when
   starting vite; then the QR origin is forced regardless of how the admin
   page was opened.

## 5. Demo flow

1. Show `/admin/table-qrs`, open **Bàn 01 (T01)** — it has an active session.
2. Scan the QR with the phone → `/order?t=DEMO-T01` auto-joins the session
   and lands in the guest menu.
3. Order from the phone (e.g. Lẩu Thái + Ba chỉ bò) → order appears for staff;
   `kitchen` login sees the KDS tickets, `server`/`cashier` continue the flow.
4. Scanning a table **without** an open session (e.g. T05) shows the
   "table not opened" screen — staff must seat the guests first: login as
   `server`/`manager`, open the session for that table, scan again.
5. Re-run the seed any time to reset to a clean demo state (clears orders,
   sessions, invoices; recreates the 3 ACTIVE sessions).
