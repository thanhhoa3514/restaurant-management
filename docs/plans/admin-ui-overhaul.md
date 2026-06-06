# Admin UI Overhaul — Diagnosis & Plan

> Status: diagnosis complete, awaiting Figma. No code changed yet.
> Date: 2026-06-05.

Project is **Quán Lẩu Nướng** (hotpot & grill), NOT "Quán Cơm Tấm Sài Gòn".
Every admin sidebar tab currently renders a poor layout. This doc maps each
problem to its source and the agreed fix direction.

## Decisions (confirmed with user)

1. **shadcn**: install `@radix-ui` + generate REAL shadcn primitives via the
   shadcn CLI, replacing the hand-rolled `src/components/ui/` lookalikes.
2. **Brand name**: use placeholder `Quán Lẩu Nướng` + logo initials `LN`,
   collected into ONE const so the final name (from Figma) is a one-line edit.
3. **Seed data**: leave `seed.ts` cơm-tấm dishes untouched (mock/fallback only).
   Fix branding *labels* only.

---

## Problems → sources → fix

### 1. Branding wrong (cơm tấm, should be lẩu nướng)
Hardcoded `Quán Cơm Tấm Sài Gòn` / `CS` logo / `Sài Gòn` in:
- `src/components/staff-shell.tsx:116` — default `brandName`
- `src/components/staff-shell.tsx:416` — logo initials `"CS"`
- `src/features/{ordering,waiter,kitchen,cashier}/data/i18n.ts` — `restaurant:` key
- `src/routes/login.tsx:148`, `src/routes/index.tsx:18`
- `src/features/ordering/components/guest-invoice-screen.tsx:320`

**Fix**: new `src/lib/brand.ts` exporting `BRAND = { name, shortName, tagline }`
(placeholder `Quán Lẩu Nướng` / `LN`). Replace all hardcoded strings with it.
Seed dish data left as-is per decision 3.

### 2. Language switcher missing in admin
`LanguageSwitcher` is wired into waiter/kitchen/ordering/cashier layouts but
`staff-shell.tsx` header has none (only ThemeToggle + config + search).

**Fix**: add `LanguageSwitcher` to `staff-shell.tsx` header actions so admin has
language parity with the other roles. Needs admin-side lang state (see #3).

### 3. Hardcoded text in admin / no i18n
`admin.tsx` + `staff-shell.tsx` import zero i18n. Every string inline VN: nav
labels, role labels, metric titles, table headers, button copy, sheet text,
search placeholder, command-palette copy.

**Fix**: new `src/features/admin/data/i18n.ts` (same `DICT.{vi,en}` shape as the
other features) + shared shell strings. No new descriptive text invented —
extract existing strings into the dict.

### 4. Bad admin layout + fake data
- `admin.tsx` Dashboard is 100% hardcoded mock (revenue `12.450.000₫`, staff
  rows `Nguyễn Quản Trị/ADMIN001`, "4 đang hoạt động"). No API wiring.
- `table-qrs.tsx` IS live (react-query) but cards/sheets are bespoke markup.

**Fix**: rebuild dashboard layout per Figma using shadcn primitives (Card,
Table, Badge, Button). Replace fake metrics with API data where available, or
clearly-flagged placeholders. Rebuild table-qrs cards on shared components.

### 5. Hand-rolled loaders
- `src/components/SuspenseLoader/SuspenseLoader.tsx` — inline-style spinner,
  raw `@keyframes spin`, hardcoded hex `#aa3bff` / `#e5e4e7`.
- `src/components/ui/language-loader.tsx` — hand-drawn `<svg>` spinner.

**Fix**: single shared `Spinner` component (lucide `Loader2` + `animate-spin`,
theme tokens). Both loaders consume it.

### 6. Self-made SVG icons (~20 inline `<svg>` in 12 files)
`ordering/*` screens, `ui/pagination.tsx`, `ui/sheet.tsx`, `ui/language-loader.tsx`,
`routes/login.tsx`, `cashier/receipt-dialog.tsx`.

**Fix**: replace each inline `<svg>` with the matching lucide icon. Audit list:
`grep -rn "<svg" src --include='*.tsx'`.

### 7. shadcn configured but unused (CORRECTED)
`components.json` exists (style `base-nova`, lucide). `radix-ui@1.4.3`,
`@base-ui/react`, and the `shadcn@4.8.3` CLI were ALREADY in deps; shadcn css
vars already in `index.css`. So shadcn is initialized — just never used to
generate components. Existing `ui/`: `button` (radix-slot) + `tooltip`
(radix-ui) are real; the other 13 are hand-rolled lookalikes.

**DONE (2026-06-05):** added real shadcn components via CLI — `table`, `dialog`,
`dropdown-menu`, `sonner`, `label`, `command`, `input-group`. New deps: `cmdk`,
`sonner`, `next-themes`. Added `icon-sm` size to existing `button.tsx` (dialog
needs it). Fixed root `tsconfig.json` (added `paths` `@/*`→`src/*`) — without it
the CLI wrote to a literal `@/` dir because it can't follow project references.
Existing custom `button`/`input`/`textarea` kept (glass-styled, not overwritten).
Typecheck + `npm run build` pass.

**REMAINING:** migrate the 13 hand-rolled lookalikes (`tabs`, `sheet`, `switch`,
`separator`, `badge`, `card`, `skeleton`, `pagination`, ...) to shadcn versions
+ update consumers. Per-component (not blind `--overwrite`) to avoid breaking
the API consumers rely on. Wire `command` into the ⌘K palette, `dropdown-menu`
into the profile menu, `sonner` for toasts.

---

## Suggested build order (post-Figma)
1. ✅ DONE — `lib/brand.ts` + all branding strings wired (decision 2).
2. ✅ DONE — shadcn CLI generated core primitives (#7). Lookalike migration remains.
3. ✅ DONE — shadcn `Spinner` added; `SuspenseLoader` + `language-loader` refactored (#5).
4. ✅ DONE — 24 inline SVGs across 11 files → lucide icons + `Spinner` (#6).
5. `features/admin/data/i18n.ts`; de-hardcode `staff-shell` + `admin` (#3).
6. Add `LanguageSwitcher` to admin shell (#2).
7. Rebuild admin dashboard + table-qrs layouts per Figma on shadcn (#4).
