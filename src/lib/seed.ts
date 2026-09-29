import type { AppState, Booking, MaintenanceWindow, Room } from './types'
import { addDays, combineDateTime, startOfWeek, toDateStr, toLocalISO } from './datetime'

const weekdays = (ranges: { start: string; end: string }[], days: number[]) =>
  Object.fromEntries(days.map((d) => [d, ranges.map((r) => ({ ...r }))]))

/** 首次打开（或重置）时生成相对当前日期的演示数据，保证周视图立即可看 */
export function seedState(): AppState {
  const monday = startOfWeek(new Date())
  const at = (dayOffset: number, hm: string) => combineDateTime(toDateStr(addDays(monday, dayOffset)), hm)
  const now = toLocalISO(new Date())

  const rooms: Room[] = [
    {
      id: 'room-a201',
      name: '明德楼 A201 研讨室',
      capacity: 12,
      equipment: ['投影仪', '白板', '视频会议'],
      openHours: {
        ...weekdays([{ start: '08:00', end: '21:00' }], [1, 2, 3, 4, 5]),
        ...weekdays([{ start: '09:00', end: '17:00' }], [6, 0]),
      },
    },
    {
      id: 'room-b101',
      name: '学生活动中心 B101 排练厅',
      capacity: 40,
      equipment: ['音响', '钢琴', '落地镜'],
      openHours: {
        ...weekdays(
          [
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '21:00' },
          ],
          [1, 2, 3, 4, 5],
        ),
        ...weekdays([{ start: '10:00', end: '20:00' }], [6, 0]),
      },
    },
    {
      id: 'room-c302',
      name: '图书馆 C302 报告厅',
      capacity: 80,
      equipment: ['投影仪', '话筒', '录播设备'],
      openHours: {
        ...weekdays([{ start: '08:30', end: '17:30' }], [1, 2, 3, 4, 5]),
      },
    },
  ]

  const maintenance: MaintenanceWindow[] = [
    {
      id: 'mnt-1',
      roomId: 'room-b101',
      start: at(2, '09:00'),
      end: at(2, '12:00'),
      reason: '音响设备检修',
    },
  ]

  const bookings: Booking[] = [
    {
      id: 'bk-1',
      roomId: 'room-a201',
      clubName: '算法协会',
      title: '程序设计周赛讲评',
      attendees: 10,
      start: at(1, '14:00'),
      end: at(1, '16:00'),
      status: 'confirmed',
      createdAt: now,
      notifiedAt: null,
    },
    {
      id: 'bk-2',
      roomId: 'room-b101',
      clubName: '合唱团',
      title: '校庆节目排练',
      attendees: 30,
      start: at(3, '18:00'),
      end: at(3, '20:00'),
      status: 'confirmed',
      createdAt: now,
      notifiedAt: null,
    },
    {
      id: 'bk-3',
      roomId: 'room-c302',
      clubName: '演讲与辩论社',
      title: '新生辩论赛初赛',
      attendees: 60,
      start: at(4, '14:00'),
      end: at(4, '16:00'),
      status: 'confirmed',
      createdAt: now,
      notifiedAt: null,
    },
  ]

  return { rooms, maintenance, bookings }
}
