import type { NewRecordInput, RepairRecord, RepairStatus } from './types'

export const STATUS_LABELS: Record<RepairStatus, string> = {
  pending: '待评估',
  repairing: '修补中',
  shelving: '待上架',
  available: '可借',
}

export const STATUS_ORDER: RepairStatus[] = ['pending', 'repairing', 'shelving', 'available']

/** 允许的状态流转边。shelving -> repairing 为检查不合格的返修。 */
const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  pending: ['repairing'],
  repairing: ['shelving'],
  shelving: ['available', 'repairing'],
  available: [],
}

export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createRecord(input: NewRecordInput, now: number = Date.now(), id: string = genId()): RepairRecord {
  const bookNo = input.bookNo.trim()
  if (!bookNo) throw new Error('书号不能为空')
  if (!input.damageLocation.trim()) throw new Error('破损位置不能为空')
  if (!input.handler.trim()) throw new Error('处理人不能为空')
  const steps = input.repairSteps.map((s) => s.trim()).filter((s) => s.length > 0)
  if (steps.length === 0) throw new Error('至少需要一条修补步骤')
  return {
    id,
    bookNo,
    title: input.title.trim(),
    damageLocation: input.damageLocation.trim(),
    photoNote: input.photoNote.trim(),
    repairSteps: steps,
    handler: input.handler.trim(),
    status: 'pending',
    inspected: false,
    inspectionNote: '',
    inspectedBy: '',
    inspectedAt: null,
    createdAt: now,
    updatedAt: now,
    history: [{ from: null, to: 'pending', at: now, operator: input.handler.trim(), note: '登记破损' }],
  }
}

export function canTransition(record: RepairRecord, to: RepairStatus): boolean {
  if (!ALLOWED_TRANSITIONS[record.status].includes(to)) return false
  // 未完成检查的书不能标为可借
  if (to === 'available' && !record.inspected) return false
  return true
}

export function nextStatuses(record: RepairRecord): RepairStatus[] {
  return ALLOWED_TRANSITIONS[record.status].filter((to) => canTransition(record, to))
}

export function transition(
  record: RepairRecord,
  to: RepairStatus,
  operator: string,
  note?: string,
  now: number = Date.now(),
): RepairRecord {
  if (!ALLOWED_TRANSITIONS[record.status].includes(to)) {
    throw new Error(`不允许从「${STATUS_LABELS[record.status]}」流转到「${STATUS_LABELS[to]}」`)
  }
  if (to === 'available' && !record.inspected) {
    throw new Error('未完成检查的书不能标为可借')
  }
  const op = operator.trim() || record.handler
  return {
    ...record,
    status: to,
    updatedAt: now,
    history: [...record.history, { from: record.status, to, at: now, operator: op, note: note?.trim() || undefined }],
  }
}

/** 登记检查结果。检查不合格会清除已检查标记，书需要重新检查后才能标为可借。 */
export function recordInspection(
  record: RepairRecord,
  passed: boolean,
  note: string,
  inspector: string,
  now: number = Date.now(),
): RepairRecord {
  if (record.status === 'available') {
    throw new Error('已可借的书无需再登记检查')
  }
  return {
    ...record,
    inspected: passed,
    inspectionNote: note.trim(),
    inspectedBy: inspector.trim() || record.handler,
    inspectedAt: now,
    updatedAt: now,
  }
}

export function findByBookNo(records: RepairRecord[], bookNo: string): RepairRecord[] {
  const key = bookNo.trim().toLowerCase()
  if (!key) return []
  return records
    .filter((r) => r.bookNo.toLowerCase() === key)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
}

export interface HandlerStat {
  handler: string
  total: number
  pending: number
  repairing: number
  shelving: number
}

export interface TodoStats {
  totalAll: number
  totalOpen: number
  byStatus: { status: RepairStatus; label: string; count: number }[]
  byHandler: HandlerStat[]
}

export function computeStats(records: RepairRecord[]): TodoStats {
  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: records.filter((r) => r.status === status).length,
  }))
  const handlers = new Map<string, HandlerStat>()
  for (const r of records) {
    if (r.status === 'available') continue
    let stat = handlers.get(r.handler)
    if (!stat) {
      stat = { handler: r.handler, total: 0, pending: 0, repairing: 0, shelving: 0 }
      handlers.set(r.handler, stat)
    }
    stat.total += 1
    if (r.status === 'pending') stat.pending += 1
    else if (r.status === 'repairing') stat.repairing += 1
    else if (r.status === 'shelving') stat.shelving += 1
  }
  return {
    totalAll: records.length,
    totalOpen: records.filter((r) => r.status !== 'available').length,
    byStatus,
    byHandler: [...handlers.values()].sort((a, b) => b.total - a.total || a.handler.localeCompare(b.handler)),
  }
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function formatTime(ts: number | null): string {
  if (ts === null) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 导出 CSV（带 BOM，Excel 可直接打开）。 */
export function toCsv(records: RepairRecord[]): string {
  const header = ['书号', '书名', '破损位置', '照片说明', '修补步骤', '处理人', '状态', '已检查', '检查人', '检查说明', '登记时间', '更新时间']
  const lines = records.map((r) =>
    [
      r.bookNo,
      r.title,
      r.damageLocation,
      r.photoNote,
      r.repairSteps.join('；'),
      r.handler,
      STATUS_LABELS[r.status],
      r.inspected ? '是' : '否',
      r.inspectedBy,
      r.inspectionNote,
      formatTime(r.createdAt),
      formatTime(r.updatedAt),
    ]
      .map(csvCell)
      .join(','),
  )
  return '\uFEFF' + [header.join(','), ...lines].join('\r\n')
}
