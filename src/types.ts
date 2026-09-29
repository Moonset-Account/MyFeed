/** 一天内的时间区间，单位为 0 点起的分钟数 */
export interface TimeRange {
  start: number
  end: number
}

/** 每周重复的维护时段，weekday 0=周一 … 6=周日 */
export interface MaintenanceWindow extends TimeRange {
  weekday: number
  note?: string
}

export interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  /** 每个工作日一个开放区间，null 表示当天不开放；索引 0=周一 */
  openHours: (TimeRange | null)[]
  maintenance: MaintenanceWindow[]
}

export interface Booking {
  id: string
  roomId: string
  club: string
  title: string
  attendees: number
  /** YYYY-MM-DD */
  date: string
  start: number
  end: number
  status: 'confirmed' | 'cancelled'
  createdAt: number
}

export interface WaitlistEntry {
  id: string
  roomId: string
  club: string
  title: string
  attendees: number
  date: string
  start: number
  end: number
  status: 'waiting' | 'notified' | 'fulfilled' | 'cancelled'
  createdAt: number
  notifiedAt?: number
}

export interface BookingRequest {
  roomId: string
  date: string
  start: number
  end: number
  attendees: number
}
