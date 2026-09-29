/** 设施状态 */
export type ItemStatus = '' | 'good' | 'worn' | 'damaged' | 'missing'

/** 照片说明（可附带本地图片，仅保存在浏览器本地） */
export interface PhotoNote {
  id: string
  caption: string
  dataUrl?: string
}

/** 单个设施在一次检查中的记录 */
export interface ItemRecord {
  status: ItemStatus
  note: string
  photos: PhotoNote[]
}

/** 单个房间在一次检查中的记录 */
export interface RoomInspection {
  keys: number | null
  waterReading: number | null
  electricityReading: number | null
  items: Record<string, ItemRecord>
}

/** 一次检查（入住或退租） */
export interface InspectionData {
  date: string
  rooms: Record<string, RoomInspection>
}

/** 设施定义 */
export interface ItemDef {
  id: string
  name: string
}

/** 房间定义（两次检查共用） */
export interface RoomDef {
  id: string
  name: string
  items: ItemDef[]
}

/** 整个交接项目 */
export interface Project {
  propertyAddress: string
  rooms: RoomDef[]
  checkIn: InspectionData
  checkOut: InspectionData
  signatures: {
    landlord: string
    tenant: string
  }
}
