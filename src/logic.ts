import type {
  InspectionData,
  ItemStatus,
  Project,
  RoomDef,
  RoomInspection,
} from './types'

export const STATUS_LABELS: Record<Exclude<ItemStatus, ''>, string> = {
  good: '完好',
  worn: '磨损',
  damaged: '损坏',
  missing: '缺失',
}

export function statusLabel(status: ItemStatus): string {
  return status === '' ? '未填写' : STATUS_LABELS[status]
}

/** 检查单个房间的一次检查记录，返回缺项描述列表（空数组表示完整） */
export function roomMissing(room: RoomDef, record: RoomInspection | undefined): string[] {
  if (!record) return [`${room.name}：整间未填写`]
  const missing: string[] = []
  if (record.keys === null) missing.push(`${room.name}：钥匙数量`)
  if (record.waterReading === null) missing.push(`${room.name}：水表读数`)
  if (record.electricityReading === null) missing.push(`${room.name}：电表读数`)
  for (const item of room.items) {
    const rec = record.items[item.id]
    if (!rec || rec.status === '') {
      missing.push(`${room.name}：设施「${item.name}」状态`)
    }
  }
  return missing
}

/** 检查一整次检查（入住或退租）的缺项 */
export function inspectionMissing(rooms: RoomDef[], inspection: InspectionData): string[] {
  return rooms.flatMap((room) => roomMissing(room, inspection.rooms[room.id]))
}

export interface FinalCheck {
  ok: boolean
  missing: string[]
}

/** 是否允许生成完成版交接单：两次检查均无缺项，且双方签字姓名已录入 */
export function canGenerateFinal(project: Project): FinalCheck {
  const missing: string[] = [
    ...inspectionMissing(project.rooms, project.checkIn).map((m) => `入住检查 - ${m}`),
    ...inspectionMissing(project.rooms, project.checkOut).map((m) => `退租检查 - ${m}`),
  ]
  if (!project.signatures.landlord.trim()) missing.push('房东签字姓名未录入')
  if (!project.signatures.tenant.trim()) missing.push('租客签字姓名未录入')
  return { ok: missing.length === 0, missing }
}

export interface ItemComparison {
  itemId: string
  itemName: string
  checkInStatus: ItemStatus
  checkOutStatus: ItemStatus
  changed: boolean
}

export interface RoomComparison {
  roomId: string
  roomName: string
  keysIn: number | null
  keysOut: number | null
  keysDiff: number | null
  waterIn: number | null
  waterOut: number | null
  waterUsage: number | null
  electricityIn: number | null
  electricityOut: number | null
  electricityUsage: number | null
  items: ItemComparison[]
}

function diff(out: number | null, inn: number | null): number | null {
  if (out === null || inn === null) return null
  return Math.round((out - inn) * 100) / 100
}

/** 逐项对比入住与退租两次检查 */
export function compareInspections(project: Project): RoomComparison[] {
  return project.rooms.map((room) => {
    const inn = project.checkIn.rooms[room.id]
    const out = project.checkOut.rooms[room.id]
    const items: ItemComparison[] = room.items.map((item) => {
      const inStatus = inn?.items[item.id]?.status ?? ''
      const outStatus = out?.items[item.id]?.status ?? ''
      return {
        itemId: item.id,
        itemName: item.name,
        checkInStatus: inStatus,
        checkOutStatus: outStatus,
        changed: inStatus !== '' && outStatus !== '' && inStatus !== outStatus,
      }
    })
    return {
      roomId: room.id,
      roomName: room.name,
      keysIn: inn?.keys ?? null,
      keysOut: out?.keys ?? null,
      keysDiff: diff(out?.keys ?? null, inn?.keys ?? null),
      waterIn: inn?.waterReading ?? null,
      waterOut: out?.waterReading ?? null,
      waterUsage: diff(out?.waterReading ?? null, inn?.waterReading ?? null),
      electricityIn: inn?.electricityReading ?? null,
      electricityOut: out?.electricityReading ?? null,
      electricityUsage: diff(out?.electricityReading ?? null, inn?.electricityReading ?? null),
      items,
    }
  })
}
