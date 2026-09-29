/** 一天内的时间段，格式 "HH:mm" */
export interface TimeRange {
  start: string
  end: string
}

/** 管理员维护的活动室 */
export interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  /** 按星期几（0=周日 … 6=周六）配置开放时段，可有多段 */
  openHours: Record<number, TimeRange[]>
}

/** 维护时段，期间房间不可预约 */
export interface MaintenanceWindow {
  id: string
  roomId: string
  /** 本地时间 ISO 字符串 "YYYY-MM-DDTHH:mm:00" */
  start: string
  end: string
  reason: string
}

export type BookingStatus = 'confirmed' | 'waitlisted' | 'cancelled'

export interface Booking {
  id: string
  roomId: string
  clubName: string
  title: string
  attendees: number
  start: string
  end: string
  status: BookingStatus
  createdAt: string
  /** 候补被提醒可转正的时间；未提醒为 null */
  notifiedAt: string | null
}

export interface AppState {
  rooms: Room[]
  maintenance: MaintenanceWindow[]
  bookings: Booking[]
}
