const fs = require('fs')

const linesToFix = [
  "src/components/SuspenseLoader/SuspenseLoader.tsx:21",
  "src/components/admin-shell.tsx:45",
  "src/components/ui/language-loader.tsx:60",
  "src/components/ui/language-switcher.tsx:68",
  "src/components/ui/theme-toggle.tsx:53",
  "src/features/admin/data/i18n.ts:8",
  "src/features/billing/api.ts:56",
  "src/features/cashier/components/discount-dialog.tsx:98",
  "src/features/cashier/components/invoice-panel.tsx:179",
  "src/features/cashier/components/invoice-pdf.tsx:233",
  "src/features/cashier/components/payment-panel.tsx:459",
  "src/features/cashier/components/receipt-dialog.tsx:137",
  "src/features/cashier/components/session-list.tsx:166",
  "src/features/cashier/components/void-dialog.tsx:38",
  "src/features/cashier/helpers/index.ts:17",
  "src/features/cashier/helpers/index.ts:35",
  "src/features/cashier/helpers/index.ts:39",
  "src/features/cashier/helpers/index.ts:71",
  "src/features/cashier/helpers/index.ts:79",
  "src/features/kitchen/components/demo-controls.tsx:96",
  "src/features/kitchen/components/manage-items-dialog.tsx:198",
  "src/features/kitchen/components/ticket-card.tsx:185",
  "src/features/kitchen/helpers/index.ts:51",
  "src/features/kitchen/helpers/index.ts:68",
  "src/features/ordering/components/guest-invoice-screen.tsx:161",
  "src/features/ordering/components/guest-pay-confirm-dialog.tsx:91",
  "src/features/waiter/components/demo-controls.tsx:110",
  "src/features/waiter/components/floor-plan.tsx:132",
  "src/features/waiter/components/grid-view.tsx:119",
  "src/features/waiter/components/table-sheet.tsx:489",
  "src/features/waiter/data/seed.ts:130",
  "src/features/waiter/helpers/index.ts:84",
  "src/features/waiter/helpers/index.ts:109"
]

for (const entry of linesToFix) {
  const [file, lineStr] = entry.split(':')
  if (!fs.existsSync(file)) continue
  const lineNum = parseInt(lineStr, 10) - 1
  
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split('\n')
  
  if (lines[lineNum]) {
    // If it's `export default`, we can usually just remove it completely if it's the end of file `export default Name`
    // Or change `export const` to `const`
    if (lines[lineNum].startsWith('export default ')) {
      // if it's `export default function` or similar
      if (lines[lineNum].includes('function') || lines[lineNum].includes('class')) {
        lines[lineNum] = lines[lineNum].replace('export default ', '')
      } else {
        lines[lineNum] = ''
      }
    } else {
      lines[lineNum] = lines[lineNum].replace(/^export /, '')
    }
    fs.writeFileSync(file, lines.join('\n'))
  }
}
console.log("Fixed unused exports")
