// Kiểm tra mọi trang trong file gộp: node nào cũng tới được từ start và tới được final.
import { readFileSync } from 'node:fs'

const xml = readFileSync('docs/activity-diagrams/restaurant-use-cases-activity-diagrams.drawio', 'utf8')
const pages = xml.split('<diagram ').slice(1)
let bad = 0

for (const page of pages) {
  const name = page.match(/name="([^"]*)"/)[1]
  const nodes = new Set()
  const finals = new Set()
  const out = new Map()
  const cellRe = /<mxCell id="([^"]*)"([^>]*)>/g
  let m
  while ((m = cellRe.exec(page))) {
    const [, id, attrs] = m
    if (attrs.includes('edge="1"')) {
      const s = attrs.match(/source="([^"]*)"/)?.[1]
      const t = attrs.match(/target="([^"]*)"/)?.[1]
      if (s && t) out.set(s, [...(out.get(s) ?? []), t])
    } else if (attrs.includes('vertex="1"')) {
      if (id === 'title' || attrs.includes('swimlane;')) continue
      if (attrs.includes('edgeLabel')) continue
      nodes.add(id)
      if (attrs.includes('doubleEllipse')) finals.add(id)
    }
  }
  const start = [...nodes].find((id) => id === 'start')
  const seen = new Set()
  const walk = (id) => { if (seen.has(id)) return; seen.add(id); for (const t of out.get(id) ?? []) walk(t) }
  if (start) walk(start)
  const unreachable = [...nodes].filter((id) => !seen.has(id))
  const deadEnd = [...nodes].filter((id) => !finals.has(id) && !(out.get(id)?.length))
  if (!start || unreachable.length || deadEnd.length) {
    bad++
    console.log(`FAIL ${name}${start ? '' : ' [không có start]'}`,
      unreachable.length ? `unreachable=${unreachable}` : '',
      deadEnd.length ? `dead-end=${deadEnd}` : '')
  }
}
console.log(`${pages.length} trang, ${bad} lỗi`)
