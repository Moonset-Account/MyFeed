export interface Member {
  id: string
  name: string
  /** 行李箱预设限重（千克） */
  suitcaseLimitKg: number
}

export interface Item {
  id: string
  name: string
  category: string
  quantity: number
  /** 单件重量（克） */
  weightGrams: number
  /** 共享物品：全员共用，只能指定一名负责人 */
  shared: boolean
  /** 携带人 / 负责人（共享物品）成员 id，null 表示未分配 */
  assigneeId: string | null
  packed: boolean
}

export interface Trip {
  id: string
  name: string
  destination: string
  days: number
  createdAt: number
  members: Member[]
  items: Item[]
}

export interface AppState {
  version: 1
  trips: Trip[]
  activeTripId: string | null
}

/** 按人筛选的取值：全部 / 未分配 / 某个成员 id */
export type PersonFilter = 'all' | 'unassigned' | string
