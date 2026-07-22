import type { ItemStatus, Urgency, KDSItem } from '../types'
import { STATUS_FLOW } from '../types'

export function nextStatus(s: ItemStatus): ItemStatus {
  const idx = STATUS_FLOW.indexOf(s)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return s
  return STATUS_FLOW[idx + 1]
}

const STATUS_INDEX = new Map(STATUS_FLOW.map((s, i) => [s, i]))

export function minStatus(items: KDSItem[]): ItemStatus {
  let minIdx = STATUS_FLOW.length
  for (const it of items) {
    const i = STATUS_INDEX.get(it.status) ?? STATUS_FLOW.length
    if (i < minIdx) minIdx = i
  }
  return STATUS_FLOW[minIdx]
}

export { fmtTimeSec as fmtClock, fmtTimeSec as fmtTimestamp, fmtDuration as fmtHMS } from '@/shared/date'

export function urgencyFor(waitSec: number): Urgency {
  if (waitSec < 5 * 60) return 'green'
  if (waitSec < 10 * 60) return 'amber'
  return 'red'
}


