const DAY_MS = 24 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function diffDays(from: string, to: string): number {
  const fromTime = parseISODate(from).getTime()
  const toTime = parseISODate(to).getTime()
  return Math.round((toTime - fromTime) / DAY_MS)
}

export function datesBetween(start: string, end: string): string[] {
  const total = diffDays(start, end)
  if (total < 0) return []
  return Array.from({ length: total + 1 }, (_, index) => addDays(start, index))
}

export function formatCN(value: string): string {
  const date = parseISODate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function weekdayCN(value: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseISODate(value).getDay()]
}

export function relativeDayLabel(value: string, today: string): string {
  const offset = diffDays(today, value)
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  if (offset === -1) return '昨天'
  return offset > 0 ? `${offset}天后` : `${Math.abs(offset)}天前`
}

export function minISO(...values: string[]): string {
  return values.reduce((current, value) => (value < current ? value : current))
}
