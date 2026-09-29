import { reactive, watch } from 'vue'
import type { Booking, BookingRequest, Room, WaitlistEntry } from './types'
import {
  isPromotable,
  mondayOfWeek,
  toISODate,
  validateBooking,
  type RejectReason,
} from './lib/schedule'

const STORAGE_KEY = 'campus-room-booking:v1'

interface State {
  rooms: Room[]
  bookings: Booking[]
  waitlist: WaitlistEntry[]
}

let uidCounter = 0
function uid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`
}

function seedRooms(): Room[] {
  return [
    {
      id: 'room-a101',
      name: 'A101 多功能厅',
      capacity: 60,
      equipment: ['投影仪', '音响', '话筒'],
      openHours: [
        { start: 480, end: 1260 },
        { start: 480, end: 1260 },
        { start: 480, end: 1260 },
        { start: 480, end: 1260 },
        { start: 480, end: 1260 },
        { start: 540, end: 1080 },
        { start: 540, end: 1080 },
      ],
      maintenance: [{ weekday: 2, start: 720, end: 810, note: '设备检修' }],
    },
    {
      id: 'room-b203',
      name: 'B203 讨论室',
      capacity: 12,
      equipment: ['白板', '电视'],
      openHours: Array.from({ length: 7 }, () => ({ start: 480, end: 1320 })),
      maintenance: [],
    },
    {
      id: 'room-c305',
      name: 'C305 舞蹈房',
      capacity: 30,
      equipment: ['落地镜', '音响'],
      openHours: Array.from({ length: 7 }, () => ({ start: 540, end: 1260 })),
      maintenance: [{ weekday: 6, start: 1080, end: 1260, note: '地板保养' }],
    },
  ]
}

function seedBookings(): Booking[] {
  const monday = mondayOfWeek(new Date())
  const at = (offset: number) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + offset)
    return toISODate(d)
  }
  return [
    {
      id: uid('bk'),
      roomId: 'room-a101',
      club: '摄影协会',
      title: '人像外拍分享会',
      attendees: 40,
      date: at(1),
      start: 1140,
      end: 1260,
      status: 'confirmed',
      createdAt: Date.now(),
    },
    {
      id: uid('bk'),
      roomId: 'room-b203',
      club: '算法社',
      title: '周赛讲评',
      attendees: 10,
      date: at(3),
      start: 1080,
      end: 1200,
      status: 'confirmed',
      createdAt: Date.now(),
    },
  ]
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (Array.isArray(parsed.rooms) && Array.isArray(parsed.bookings) && Array.isArray(parsed.waitlist)) {
        return parsed
      }
    }
  } catch {
    // 本地数据损坏时回退到初始数据
  }
  return { rooms: seedRooms(), bookings: seedBookings(), waitlist: [] }
}

export const state = reactive<State>(loadState())

watch(
  state,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true },
)

export function roomById(id: string): Room | undefined {
  return state.rooms.find((r) => r.id === id)
}

export interface SubmitResult {
  ok: boolean
  reasons: RejectReason[]
  booking?: Booking
}

/** 社团提交预约：自动检查撞期、超员、维护时段与开放时间 */
export function submitBooking(
  req: BookingRequest & { club: string; title: string },
): SubmitResult {
  const room = roomById(req.roomId)
  if (!room) return { ok: false, reasons: ['conflict'] }
  const reasons = validateBooking(room, req, state.bookings)
  if (reasons.length > 0) return { ok: false, reasons }
  const booking: Booking = {
    id: uid('bk'),
    roomId: req.roomId,
    club: req.club,
    title: req.title,
    attendees: req.attendees,
    date: req.date,
    start: req.start,
    end: req.end,
    status: 'confirmed',
    createdAt: Date.now(),
  }
  state.bookings.push(booking)
  return { ok: true, reasons: [], booking }
}

/** 加入候补队列 */
export function joinWaitlist(
  req: BookingRequest & { club: string; title: string },
): WaitlistEntry {
  const entry: WaitlistEntry = {
    id: uid('wl'),
    roomId: req.roomId,
    club: req.club,
    title: req.title,
    attendees: req.attendees,
    date: req.date,
    start: req.start,
    end: req.end,
    status: 'waiting',
    createdAt: Date.now(),
  }
  state.waitlist.push(entry)
  return entry
}

/** 取消预约后，按提交顺序检查候补，可满足的单据置为「已提醒」 */
export function cancelBooking(id: string): void {
  const booking = state.bookings.find((b) => b.id === id)
  if (!booking) return
  booking.status = 'cancelled'
  promoteWaitlist()
}

function promoteWaitlist(): void {
  const waiting = state.waitlist
    .filter((w) => w.status === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt)
  for (const entry of waiting) {
    const room = roomById(entry.roomId)
    if (room && isPromotable(entry, room, state.bookings)) {
      entry.status = 'notified'
      entry.notifiedAt = Date.now()
    }
  }
}

/** 被提醒的候补单确认转正为正式预约 */
export function confirmWaitlistEntry(id: string): boolean {
  const entry = state.waitlist.find((w) => w.id === id)
  if (!entry || entry.status !== 'notified') return false
  const room = roomById(entry.roomId)
  if (!room || !isPromotable(entry, room, state.bookings)) return false
  state.bookings.push({
    id: uid('bk'),
    roomId: entry.roomId,
    club: entry.club,
    title: entry.title,
    attendees: entry.attendees,
    date: entry.date,
    start: entry.start,
    end: entry.end,
    status: 'confirmed',
    createdAt: Date.now(),
  })
  entry.status = 'fulfilled'
  return true
}

export function cancelWaitlistEntry(id: string): void {
  const entry = state.waitlist.find((w) => w.id === id)
  if (entry) entry.status = 'cancelled'
}

export function saveRoom(room: Room): void {
  const idx = state.rooms.findIndex((r) => r.id === room.id)
  if (idx >= 0) {
    state.rooms[idx] = room
  } else {
    state.rooms.push(room)
  }
}

export function newRoom(): Room {
  return {
    id: uid('room'),
    name: '新房间',
    capacity: 20,
    equipment: [],
    openHours: Array.from({ length: 7 }, () => ({ start: 480, end: 1260 })),
    maintenance: [],
  }
}

/** 清空本地数据并恢复演示数据 */
export function resetAll(): void {
  const fresh = { rooms: seedRooms(), bookings: seedBookings(), waitlist: [] }
  state.rooms = fresh.rooms
  state.bookings = fresh.bookings
  state.waitlist = fresh.waitlist
}
