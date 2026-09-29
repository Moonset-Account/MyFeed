import { describe, expect, it } from 'vitest'
import type { Booking, Room } from '../types'
import {
  formatMinutes,
  isPromotable,
  overlaps,
  parseMinutes,
  validateBooking,
  weekdayOf,
} from './schedule'

const room: Room = {
  id: 'r1',
  name: '测试教室',
  capacity: 30,
  equipment: ['投影'],
  openHours: [
    { start: 480, end: 1200 }, // 周一 8:00-20:00
    null, // 周二闭馆
    { start: 480, end: 1200 },
    { start: 480, end: 1200 },
    { start: 480, end: 1200 },
    { start: 480, end: 1200 },
    { start: 480, end: 1200 },
  ],
  maintenance: [{ weekday: 0, start: 720, end: 780, note: '清洁' }], // 周一 12:00-13:00
}

// 2026-09-28 是周一
const MONDAY = '2026-09-28'
const TUESDAY = '2026-09-29'

function booking(partial: Partial<Booking>): Booking {
  return {
    id: 'b1',
    roomId: 'r1',
    club: '社团',
    title: '活动',
    attendees: 10,
    date: MONDAY,
    start: 600,
    end: 660,
    status: 'confirmed',
    createdAt: 1,
    ...partial,
  }
}

describe('overlaps', () => {
  it('识别重叠与相接', () => {
    expect(overlaps({ start: 60, end: 120 }, { start: 90, end: 150 })).toBe(true)
    expect(overlaps({ start: 60, end: 120 }, { start: 120, end: 180 })).toBe(false)
    expect(overlaps({ start: 60, end: 120 }, { start: 0, end: 60 })).toBe(false)
  })
})

describe('weekdayOf', () => {
  it('周一为 0，周日为 6', () => {
    expect(weekdayOf('2026-09-28')).toBe(0)
    expect(weekdayOf('2026-10-04')).toBe(6)
  })
})

describe('validateBooking', () => {
  const base = { roomId: 'r1', date: MONDAY, start: 600, end: 660, attendees: 10 }

  it('合法请求通过', () => {
    expect(validateBooking(room, base, [])).toEqual([])
  })

  it('结束时间早于开始时间', () => {
    expect(validateBooking(room, { ...base, start: 660, end: 600 }, [])).toContain('invalid-range')
  })

  it('超出开放时段与闭馆日', () => {
    expect(validateBooking(room, { ...base, start: 420, end: 600 }, [])).toContain('outside-open-hours')
    expect(validateBooking(room, { ...base, date: TUESDAY }, [])).toContain('outside-open-hours')
  })

  it('与维护时段冲突', () => {
    expect(validateBooking(room, { ...base, start: 660, end: 750 }, [])).toContain('maintenance')
    expect(validateBooking(room, { ...base, start: 780, end: 840 }, [])).not.toContain('maintenance')
  })

  it('人数超员', () => {
    expect(validateBooking(room, { ...base, attendees: 31 }, [])).toContain('over-capacity')
    expect(validateBooking(room, { ...base, attendees: 30 }, [])).toEqual([])
  })

  it('与已确认预约撞期，忽略已取消的预约', () => {
    const existing = booking({})
    expect(validateBooking(room, { ...base, start: 630, end: 700 }, [existing])).toContain('conflict')
    const cancelled = booking({ id: 'b2', status: 'cancelled' })
    expect(validateBooking(room, { ...base, start: 630, end: 700 }, [cancelled])).toEqual([])
  })

  it('不同房间或不同日期不算撞期', () => {
    const other = booking({ roomId: 'r2' })
    expect(validateBooking(room, base, [other])).toEqual([])
    const otherDay = booking({ date: '2026-09-30' })
    expect(validateBooking(room, base, [otherDay])).toEqual([])
  })
})

describe('isPromotable（取消后候补可转正）', () => {
  it('占用取消后候补满足全部校验', () => {
    const existing = booking({})
    const entry = {
      id: 'w1',
      roomId: 'r1',
      club: '候补社',
      title: '排练',
      attendees: 20,
      date: MONDAY,
      start: 600,
      end: 660,
      status: 'waiting' as const,
      createdAt: 2,
    }
    expect(isPromotable(entry, room, [existing])).toBe(false)
    expect(isPromotable(entry, room, [{ ...existing, status: 'cancelled' }])).toBe(true)
  })
})

describe('时间格式转换', () => {
  it('formatMinutes / parseMinutes 互逆', () => {
    expect(formatMinutes(0)).toBe('00:00')
    expect(formatMinutes(1260)).toBe('21:00')
    expect(parseMinutes('21:00')).toBe(1260)
    expect(parseMinutes('7:05')).toBe(425)
    expect(Number.isNaN(parseMinutes('25:00'))).toBe(true)
    expect(Number.isNaN(parseMinutes('abc'))).toBe(true)
  })
})
