export type PartyStatus = 'waiting' | 'called' | 'seated' | 'missed' | 'cancelled' | 'left'
export type TableStatus = 'free' | 'occupied'
export type LogType =
  | 'registered'
  | 'called'
  | 'seated'
  | 'missed'
  | 'cancelled'
  | 'left'
  | 'shared'
  | 'cleared'

export interface TableType {
  id: string
  name: string
  seats: number
  count: number
}

export interface RestaurantTable {
  id: string
  typeId: string
  label: string
  seats: number
  status: TableStatus
  partyIds: string[]
}

export interface Party {
  id: string
  number: number
  name: string
  size: number
  arrivalTime: string
  createdAt: string
  acceptShare: boolean
  status: PartyStatus
  calledAt?: string
  seatedAt?: string
  completedAt?: string
  tableIds: string[]
  seatedPartyCount?: number
}

export interface ActivityLog {
  id: string
  time: string
  type: LogType
  partyId?: string
  partyNumber?: number
  tableIds?: string[]
  detail: string
}

export interface DayData {
  dateKey: string
  parties: Party[]
  logs: ActivityLog[]
  nextNumber: number
}

export interface AppState {
  tableTypes: TableType[]
  tables: RestaurantTable[]
  day: DayData
}

export interface RegisterInput {
  name: string
  size: number
  arrivalTime: string
  acceptShare: boolean
}

export interface CallSuggestion {
  party: Party
  table: RestaurantTable
  kind: 'direct' | 'shared'
  spareSeats: number
  seatedPartyCount: number
  reason: string
}
