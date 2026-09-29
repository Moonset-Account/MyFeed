import type { Booking, BookingRequest, Room, TimeRange, WaitlistEntry } from '../types'

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 两个时间区间是否重叠（端点相接不算重叠） */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end
}

/** YYYY-MM-DD（本地时区）对应的星期，0=周一 … 6=周日 */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const jsDay = new Date(y, m - 1, d).getDay() // 0=周日
  return (jsDay + 6) % 7
}

export type RejectReason =
  | 'invalid-range'
  | 'outside-open-hours'
  | 'maintenance'
  | 'over-capacity'
  | 'conflict'

export const REJECT_TEXT: Record<RejectReason, string> = {
  'invalid-range': '结束时间必须晚于开始时间',
  'outside-open-hours': '不在房间开放时段内',
  maintenance: '与房间维护时段冲突',
  'over-capacity': '活动人数超过房间容量',
  conflict: '与已确认的预约撞期',
}

/** 校验一个预约请求，返回所有不满足的原因（空数组表示可以预约） */
export function validateBooking(
  room: Room,
  req: BookingRequest,
  bookings: Booking[],
): RejectReason[] {
  const reasons: RejectReason[] = []

  if (!(req.start < req.end)) {
    reasons.push('invalid-range')
  } else {
    const wd = weekdayOf(req.date)
    const open = room.openHours[wd]
    if (!open || req.start < open.start || req.end > open.end) {
      reasons.push('outside-open-hours')
    }
    if (room.maintenance.some((m) => m.weekday === wd && overlaps(m, req))) {
      reasons.push('maintenance')
    }
  }

  if (req.attendees > room.capacity) {
    reasons.push('over-capacity')
  }

  const clash = bookings.some(
    (b) =>
      b.roomId === req.roomId &&
      b.date === req.date &&
      b.status === 'confirmed' &&
      overlaps(b, req),
  )
  if (clash) {
    reasons.push('conflict')
  }

  return reasons
}

/** 候补单当前是否可以转正（所有校验都通过） */
export function isPromotable(
  entry: WaitlistEntry,
  room: Room,
  bookings: Booking[],
): boolean {
  return validateBooking(room, entry, bookings).length === 0
}

/** 分钟数 → "HH:MM" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" → 分钟数，非法输入返回 NaN */
export function parseMinutes(text: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return NaN
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return NaN
  return h * 60 + m
}

/** Date → YYYY-MM-DD（本地时区） */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 给定某周内任意一天，返回该周周一的 Date */
export function mondayOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const wd = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - wd)
  return copy
}
