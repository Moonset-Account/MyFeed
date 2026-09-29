/** 统一使用本地时间的朴素 ISO 字符串 "YYYY-MM-DDTHH:mm:00"，避免时区换算误差 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 日期 "YYYY-MM-DD" 与时间 "HH:mm" 合成本地 ISO 字符串 */
export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

export function datePart(iso: string): string {
  return iso.slice(0, 10)
}

export function timePart(iso: string): string {
  return iso.slice(11, 16)
}

/** ISO 字符串对应的星期几，0=周日 */
export function weekdayOf(iso: string): number {
  return new Date(iso).getDay()
}

/** ISO 字符串对应的当天分钟数 */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/** "HH:mm" 转分钟数 */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/** 以周一为一周的开始 */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
