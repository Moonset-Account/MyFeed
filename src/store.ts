import { reactive, watch } from 'vue'
import type { InspectionData, Project, RoomDef, RoomInspection } from './types'

const STORAGE_KEY = 'rental-inspection-project-v1'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function emptyRoomInspection(room: RoomDef): RoomInspection {
  const items: RoomInspection['items'] = {}
  for (const item of room.items) {
    items[item.id] = { status: '', note: '', photos: [] }
  }
  return { keys: null, waterReading: null, electricityReading: null, items }
}

function emptyInspection(rooms: RoomDef[]): InspectionData {
  const record: InspectionData = { date: '', rooms: {} }
  for (const room of rooms) {
    record.rooms[room.id] = emptyRoomInspection(room)
  }
  return record
}

function defaultRooms(): RoomDef[] {
  const make = (name: string, items: string[]): RoomDef => ({
    id: uid(),
    name,
    items: items.map((n) => ({ id: uid(), name: n })),
  })
  return [
    make('客厅', ['沙发', '茶几', '电视', '空调', '灯具']),
    make('主卧', ['床', '衣柜', '空调', '灯具']),
    make('厨房', ['燃气灶', '油烟机', '冰箱', '水槽']),
    make('卫生间', ['马桶', '热水器', '淋浴设施', '洗手盆']),
  ]
}

export function createDefaultProject(): Project {
  const rooms = defaultRooms()
  return {
    propertyAddress: '',
    rooms,
    checkIn: emptyInspection(rooms),
    checkOut: emptyInspection(rooms),
    signatures: { landlord: '', tenant: '' },
  }
}

function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Project
  return (
    typeof p.propertyAddress === 'string' &&
    Array.isArray(p.rooms) &&
    typeof p.checkIn === 'object' &&
    typeof p.checkOut === 'object' &&
    typeof p.signatures === 'object' &&
    typeof p.signatures.landlord === 'string' &&
    typeof p.signatures.tenant === 'string'
  )
}

function load(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isProject(parsed)) return parsed
    }
  } catch {
    // 本地数据损坏时回退到默认项目
  }
  return createDefaultProject()
}

export const project = reactive<Project>(load())

watch(
  project,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // 存储空间不足（如照片过多）时静默失败，界面数据仍保留
    }
  },
  { deep: true },
)

export function exportJson(): string {
  return JSON.stringify(project, null, 2)
}

export function importJson(text: string): { ok: boolean; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '文件不是有效的 JSON' }
  }
  if (!isProject(parsed)) {
    return { ok: false, error: 'JSON 结构不符合交接检查表格式' }
  }
  project.propertyAddress = parsed.propertyAddress
  project.rooms = parsed.rooms
  project.checkIn = parsed.checkIn
  project.checkOut = parsed.checkOut
  project.signatures = parsed.signatures
  return { ok: true }
}

export function resetProject(): void {
  const fresh = createDefaultProject()
  project.propertyAddress = fresh.propertyAddress
  project.rooms = fresh.rooms
  project.checkIn = fresh.checkIn
  project.checkOut = fresh.checkOut
  project.signatures = fresh.signatures
}

export function addRoom(name: string): void {
  const room: RoomDef = { id: uid(), name, items: [] }
  project.rooms.push(room)
  project.checkIn.rooms[room.id] = emptyRoomInspection(room)
  project.checkOut.rooms[room.id] = emptyRoomInspection(room)
}

export function removeRoom(roomId: string): void {
  project.rooms = project.rooms.filter((r) => r.id !== roomId)
  delete project.checkIn.rooms[roomId]
  delete project.checkOut.rooms[roomId]
}

export function addItem(roomId: string, name: string): void {
  const room = project.rooms.find((r) => r.id === roomId)
  if (!room) return
  const item = { id: uid(), name }
  room.items.push(item)
  const blank = { status: '' as const, note: '', photos: [] }
  project.checkIn.rooms[roomId].items[item.id] = { ...blank, photos: [] }
  project.checkOut.rooms[roomId].items[item.id] = { ...blank, photos: [] }
}

export function removeItem(roomId: string, itemId: string): void {
  const room = project.rooms.find((r) => r.id === roomId)
  if (!room) return
  room.items = room.items.filter((i) => i.id !== itemId)
  delete project.checkIn.rooms[roomId].items[itemId]
  delete project.checkOut.rooms[roomId].items[itemId]
}
