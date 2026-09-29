import type { AppState, Booking } from './types'
import { datePart, hmToMinutes, minutesOfDay, weekdayOf } from './datetime'

export type IssueCode =
  | 'invalid-range'
  | 'invalid-attendees'
  | 'unknown-room'
  | 'outside-open-hours'
  | 'over-capacity'
  | 'maintenance-conflict'
  | 'time-conflict'

export const ISSUE_TEXT: Record<IssueCode, string> = {
  'invalid-range': '时间范围无效（需在同一天内且开始早于结束）',
  'invalid-attendees': '参与人数需为不小于 1 的整数',
  'unknown-room': '房间不存在',
  'outside-open-hours': '不在该房间的开放时段内',
  'over-capacity': '参与人数超出房间容量',
  'maintenance-conflict': '与房间维护时段冲突',
  'time-conflict': '与已有预约撞期',
}

export interface BookingRequest {
  roomId: string
  start: string
  end: string
  attendees: number
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** 校验预约请求，返回全部问题代码；空数组表示通过 */
export function validateBooking(state: AppState, req: BookingRequest, excludeBookingId?: string): IssueCode[] {
  const room = state.rooms.find((r) => r.id === req.roomId)
  if (!room) return ['unknown-room']

  const issues: IssueCode[] = []
  const startMs = Date.parse(req.start)
  const endMs = Date.parse(req.end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs || datePart(req.start) !== datePart(req.end)) {
    return ['invalid-range']
  }

  if (!Number.isInteger(req.attendees) || req.attendees < 1) issues.push('invalid-attendees')
  if (req.attendees > room.capacity) issues.push('over-capacity')

  const ranges = room.openHours[weekdayOf(req.start)] ?? []
  const s = minutesOfDay(req.start)
  const e = minutesOfDay(req.end)
  if (!ranges.some((r) => hmToMinutes(r.start) <= s && e <= hmToMinutes(r.end))) {
    issues.push('outside-open-hours')
  }

  if (state.maintenance.some((m) => m.roomId === room.id && rangesOverlap(startMs, endMs, Date.parse(m.start), Date.parse(m.end)))) {
    issues.push('maintenance-conflict')
  }

  if (
    state.bookings.some(
      (b) =>
        b.roomId === room.id &&
        b.status === 'confirmed' &&
        b.id !== excludeBookingId &&
        rangesOverlap(startMs, endMs, Date.parse(b.start), Date.parse(b.end)),
    )
  ) {
    issues.push('time-conflict')
  }

  return issues
}

/** 仅因撞期而失败时允许加入候补 */
export function canWaitlist(issues: IssueCode[]): boolean {
  return issues.length > 0 && issues.every((i) => i === 'time-conflict')
}

export interface SubmitInput extends BookingRequest {
  clubName: string
  title: string
  allowWaitlist: boolean
}

export interface SubmitResult {
  booking: Booking | null
  issues: IssueCode[]
}

/** 提交预约：通过则确认；仅撞期且允许候补则进入候补队列 */
export function submitBooking(state: AppState, input: SubmitInput, now: string): SubmitResult {
  const issues = validateBooking(state, input)
  if (issues.length > 0 && !(input.allowWaitlist && canWaitlist(issues))) {
    return { booking: null, issues }
  }
  const booking: Booking = {
    id: crypto.randomUUID(),
    roomId: input.roomId,
    clubName: input.clubName,
    title: input.title,
    attendees: input.attendees,
    start: input.start,
    end: input.end,
    status: issues.length === 0 ? 'confirmed' : 'waitlisted',
    createdAt: now,
    notifiedAt: null,
  }
  state.bookings.push(booking)
  return { booking, issues: [] }
}

/**
 * 取消预约。若取消的是已确认预约，释放时段后按提交顺序
 * 提醒第一个满足全部校验的候补申请。
 * 返回被提醒的候补预约（没有则为 null）。
 */
export function cancelBooking(state: AppState, bookingId: string, now: string): Booking | null {
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking || booking.status === 'cancelled') return null
  const wasConfirmed = booking.status === 'confirmed'
  booking.status = 'cancelled'
  if (!wasConfirmed) return null
  return notifyNextWaitlist(state, booking.roomId, now)
}

/** 为某房间提醒下一个可转正的候补申请，返回被提醒者 */
export function notifyNextWaitlist(state: AppState, roomId: string, now: string): Booking | null {
  const queue = state.bookings
    .filter((b) => b.roomId === roomId && b.status === 'waitlisted' && b.notifiedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const candidate of queue) {
    const issues = validateBooking(
      state,
      { roomId, start: candidate.start, end: candidate.end, attendees: candidate.attendees },
      candidate.id,
    )
    if (issues.length === 0) {
      candidate.notifiedAt = now
      return candidate
    }
  }
  return null
}

/** 候补申请确认转正；返回剩余问题，空数组表示成功 */
export function confirmWaitlisted(state: AppState, bookingId: string): IssueCode[] {
  const booking = state.bookings.find((b) => b.id === bookingId)
  if (!booking || booking.status !== 'waitlisted') return ['unknown-room']
  const issues = validateBooking(
    state,
    { roomId: booking.roomId, start: booking.start, end: booking.end, attendees: booking.attendees },
    booking.id,
  )
  if (issues.length === 0) {
    booking.status = 'confirmed'
  }
  return issues
}
