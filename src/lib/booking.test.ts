import { describe, expect, it } from 'vitest'
import type { AppState, Booking } from './types'
import {
  canWaitlist,
  cancelBooking,
  confirmWaitlisted,
  submitBooking,
  validateBooking,
} from './booking'
import { addDays, combineDateTime, startOfWeek, toDateStr } from './datetime'

const NOW = '2026-09-30T09:00:00'

/** 以本周一为基准构造固定场景，避免依赖具体日期 */
function fixture(): AppState {
  const monday = toDateStr(startOfWeek(new Date()))
  const at = (dayOffset: number, hm: string) => combineDateTime(toDateStr(addDays(new Date(monday + 'T00:00:00'), dayOffset)), hm)
  return {
    rooms: [
      {
        id: 'r1',
        name: '测试研讨室',
        capacity: 10,
        equipment: ['白板'],
        openHours: {
          1: [
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '18:00' },
          ],
          3: [{ start: '09:00', end: '18:00' }],
        },
      },
    ],
    maintenance: [{ id: 'm1', roomId: 'r1', start: at(2, '10:00'), end: at(2, '12:00'), reason: '检修' }],
    bookings: [
      {
        id: 'b1',
        roomId: 'r1',
        clubName: '甲社团',
        title: '例会',
        attendees: 5,
        start: at(0, '10:00'),
        end: at(0, '11:00'),
        status: 'confirmed',
        createdAt: NOW,
        notifiedAt: null,
      },
    ],
  }
}

const mondayAt = (hm: string) =>
  combineDateTime(toDateStr(startOfWeek(new Date())), hm)
const wednesdayAt = (hm: string) =>
  combineDateTime(toDateStr(addDays(startOfWeek(new Date()), 2)), hm)

describe('validateBooking', () => {
  it('合法预约通过全部检查', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('13:00'), end: mondayAt('14:00'), attendees: 8 })).toEqual([])
  })

  it('超员被拒绝', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('13:00'), end: mondayAt('14:00'), attendees: 11 })).toContain('over-capacity')
  })

  it('开放时段空档与午休时段被拒绝', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('12:00'), end: mondayAt('13:00'), attendees: 3 })).toContain('outside-open-hours')
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('08:00'), end: mondayAt('09:00'), attendees: 3 })).toContain('outside-open-hours')
  })

  it('维护时段冲突被拒绝', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: wednesdayAt('11:00'), end: wednesdayAt('13:00'), attendees: 3 })).toContain('maintenance-conflict')
  })

  it('与已确认预约撞期，且仅撞期时允许候补', () => {
    const s = fixture()
    const issues = validateBooking(s, { roomId: 'r1', start: mondayAt('10:30'), end: mondayAt('11:30'), attendees: 3 })
    expect(issues).toEqual(['time-conflict'])
    expect(canWaitlist(issues)).toBe(true)
  })

  it('结束早于开始、跨天等无效范围被拒绝', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('15:00'), end: mondayAt('14:00'), attendees: 3 })).toEqual(['invalid-range'])
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('17:00'), end: wednesdayAt('09:00'), attendees: 3 })).toEqual(['invalid-range'])
  })

  it('人数非法与未知房间被拒绝', () => {
    const s = fixture()
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('13:00'), end: mondayAt('14:00'), attendees: 0 })).toContain('invalid-attendees')
    expect(validateBooking(s, { roomId: 'nope', start: mondayAt('13:00'), end: mondayAt('14:00'), attendees: 3 })).toEqual(['unknown-room'])
  })
})

describe('候补与取消提醒', () => {
  const waitlistInput = () => ({
    roomId: 'r1',
    start: mondayAt('10:00'),
    end: mondayAt('11:00'),
    attendees: 4,
    clubName: '乙社团',
    title: '排练',
    allowWaitlist: true,
  })

  it('撞期提交进入候补队列', () => {
    const s = fixture()
    const res = submitBooking(s, waitlistInput(), NOW)
    expect(res.booking?.status).toBe('waitlisted')
    expect(res.issues).toEqual([])
  })

  it('超员申请不能进入候补队列', () => {
    const s = fixture()
    const res = submitBooking(s, { ...waitlistInput(), attendees: 11 }, NOW)
    expect(res.booking).toBeNull()
    expect(res.issues).toContain('over-capacity')
  })

  it('取消已确认预约后按提交顺序提醒第一个可转正的候补', () => {
    const s = fixture()
    const first = submitBooking(s, waitlistInput(), NOW).booking as Booking
    const second = submitBooking(s, { ...waitlistInput(), clubName: '丙社团' }, NOW).booking as Booking
    expect(first.status).toBe('waitlisted')

    const notified = cancelBooking(s, 'b1', NOW)
    expect(notified?.id).toBe(first.id)
    expect(first.notifiedAt).toBe(NOW)
    expect(second.notifiedAt).toBeNull()
  })

  it('提醒时跳过已不满足条件的候补，顺延给下一位', () => {
    const s = fixture()
    // 第一个候补占 09:30–10:30，第二个占 10:00–11:00，都与 b1 撞期而进入候补
    const first = submitBooking(s, { ...waitlistInput(), start: mondayAt('09:30'), end: mondayAt('10:30') }, NOW)
      .booking as Booking
    const second = submitBooking(s, waitlistInput(), NOW).booking as Booking
    // 管理员随后安排 09:00–10:00 维护，第一个候补因此无法转正
    s.maintenance.push({ id: 'm2', roomId: 'r1', start: mondayAt('09:00'), end: mondayAt('10:00'), reason: '临时检修' })

    const notified = cancelBooking(s, 'b1', NOW)
    expect(notified?.id).toBe(second.id)
    expect(first.notifiedAt).toBeNull()
    expect(second.notifiedAt).toBe(NOW)
  })

  it('取消后原时段可再次预约', () => {
    const s = fixture()
    cancelBooking(s, 'b1', NOW)
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('10:00'), end: mondayAt('11:00'), attendees: 4 })).toEqual([])
  })

  it('被提醒的候补可确认转正，转正后再次占用时段', () => {
    const s = fixture()
    const w = submitBooking(s, waitlistInput(), NOW).booking as Booking
    cancelBooking(s, 'b1', NOW)
    expect(w.notifiedAt).not.toBeNull()
    expect(confirmWaitlisted(s, w.id)).toEqual([])
    expect(w.status).toBe('confirmed')
    // 转正后该时段重新被占用
    expect(validateBooking(s, { roomId: 'r1', start: mondayAt('10:00'), end: mondayAt('11:00'), attendees: 2 })).toContain('time-conflict')
  })

  it('取消候补不会触发提醒', () => {
    const s = fixture()
    const w = submitBooking(s, waitlistInput(), NOW).booking as Booking
    const notified = cancelBooking(s, w.id, NOW)
    expect(notified).toBeNull()
    expect(w.status).toBe('cancelled')
  })
})
