/** 数据模型与核心业务逻辑（纯函数，便于测试）。 */

export type FacilityStatus = 'good' | 'damaged' | 'missing'

export const STATUS_LABELS: Record<FacilityStatus, string> = {
  good: '完好',
  damaged: '损坏',
  missing: '缺失',
}

export interface FacilityDef {
  id: string
  name: string
}

export interface RoomDef {
  id: string
  name: string
  facilities: FacilityDef[]
}

/** 单个设施在一次检查中的记录 */
export interface FacilityRecord {
  status: FacilityStatus | ''
  note: string
}

/** 单个房间在一次检查中的记录 */
export interface RoomRecord {
  facilityRecords: Record<string, FacilityRecord>
  /** 照片说明（记录拍摄了哪些照片、照片内容） */
  photoNote: string
  keyCount: number | null
  waterMeter: number | null
  electricMeter: number | null
}

export interface Inspection {
  date: string
  landlordName: string
  tenantName: string
  rooms: Record<string, RoomRecord>
}

export interface Project {
  address: string
  rooms: RoomDef[]
  checkin: Inspection
  checkout: Inspection
}

let seq = 0
export function genId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export function emptyRoomRecord(): RoomRecord {
  return {
    facilityRecords: {},
    photoNote: '',
    keyCount: null,
    waterMeter: null,
    electricMeter: null,
  }
}

export function emptyInspection(): Inspection {
  return { date: '', landlordName: '', tenantName: '', rooms: {} }
}

/** 取某次检查中某房间的记录，不存在则按结构补空记录（就地初始化）。 */
export function ensureRoomRecord(inspection: Inspection, roomId: string): RoomRecord {
  if (!inspection.rooms[roomId]) {
    inspection.rooms[roomId] = emptyRoomRecord()
  }
  return inspection.rooms[roomId]
}

export function ensureFacilityRecord(inspection: Inspection, roomId: string, facilityId: string): FacilityRecord {
  const room = ensureRoomRecord(inspection, roomId)
  if (!room.facilityRecords[facilityId]) {
    room.facilityRecords[facilityId] = { status: '', note: '' }
  }
  return room.facilityRecords[facilityId]
}

/** 缺项描述 */
export interface MissingItem {
  roomName: string
  field: string
}

/** 校验一次检查是否填写完整，返回所有缺项（空数组表示完整）。 */
export function findMissingItems(inspection: Inspection, rooms: RoomDef[]): MissingItem[] {
  const missing: MissingItem[] = []
  const push = (roomName: string, field: string) => missing.push({ roomName, field })

  if (!inspection.date) push('基本信息', '检查日期')
  if (!inspection.landlordName.trim()) push('基本信息', '出租方签字姓名')
  if (!inspection.tenantName.trim()) push('基本信息', '承租方签字姓名')

  for (const room of rooms) {
    const record = inspection.rooms[room.id]
    if (!record) {
      push(room.name, '整个房间未填写')
      continue
    }
    if (record.keyCount === null || record.keyCount === undefined) push(room.name, '钥匙数量')
    if (record.waterMeter === null || record.waterMeter === undefined) push(room.name, '水表读数')
    if (record.electricMeter === null || record.electricMeter === undefined) push(room.name, '电表读数')
    for (const facility of room.facilities) {
      const fr = record.facilityRecords[facility.id]
      if (!fr || fr.status === '') push(room.name, `设施「${facility.name}」状态`)
    }
  }
  return missing
}

export function isInspectionComplete(inspection: Inspection, rooms: RoomDef[]): boolean {
  return findMissingItems(inspection, rooms).length === 0
}

/** 入住/退租逐项对比结果 */
export interface ComparisonRow {
  roomName: string
  item: string
  checkinValue: string
  checkoutValue: string
  changed: boolean
}

function fmtStatus(s: FacilityStatus | ''): string {
  return s === '' ? '未填写' : STATUS_LABELS[s]
}

function fmtNum(n: number | null | undefined, unit: string): string {
  return n === null || n === undefined ? '未填写' : `${n} ${unit}`
}

/** 逐项对比两次检查：设施状态、钥匙数量、水电表读数。 */
export function compareInspections(project: Project): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  for (const room of project.rooms) {
    const a = project.checkin.rooms[room.id]
    const b = project.checkout.rooms[room.id]
    for (const facility of room.facilities) {
      const sa = a?.facilityRecords[facility.id]?.status ?? ''
      const sb = b?.facilityRecords[facility.id]?.status ?? ''
      rows.push({
        roomName: room.name,
        item: `设施「${facility.name}」`,
        checkinValue: fmtStatus(sa),
        checkoutValue: fmtStatus(sb),
        changed: sa !== sb,
      })
    }
    const numRow = (
      item: string,
      va: number | null | undefined,
      vb: number | null | undefined,
      unit: string,
    ) => {
      rows.push({
        roomName: room.name,
        item,
        checkinValue: fmtNum(va, unit),
        checkoutValue: fmtNum(vb, unit),
        changed: (va ?? null) !== (vb ?? null),
      })
    }
    numRow('钥匙数量', a?.keyCount, b?.keyCount, '把')
    numRow('水表读数', a?.waterMeter, b?.waterMeter, '吨')
    numRow('电表读数', a?.electricMeter, b?.electricMeter, '度')
  }
  return rows
}

/** 生成完成版交接单前的检查：两次检查均完整才允许。 */
export function finalBlockers(project: Project): { checkin: MissingItem[]; checkout: MissingItem[] } {
  return {
    checkin: findMissingItems(project.checkin, project.rooms),
    checkout: findMissingItems(project.checkout, project.rooms),
  }
}

export function canGenerateFinal(project: Project): boolean {
  const b = finalBlockers(project)
  return b.checkin.length === 0 && b.checkout.length === 0
}

/** 导出为本地 JSON 备份文本。 */
export function exportProject(project: Project): string {
  return JSON.stringify({ app: 'rental-inspection', version: 1, project }, null, 2)
}

/** 从 JSON 备份文本恢复数据；格式非法时抛出错误。 */
export function importProject(text: string): Project {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  const d = data as { app?: unknown; project?: Partial<Project> }
  if (!d || typeof d !== 'object' || !d.project || typeof d.project !== 'object') {
    throw new Error('备份文件缺少 project 数据')
  }
  const p = d.project
  if (!Array.isArray(p.rooms) || !p.checkin || !p.checkout) {
    throw new Error('备份文件结构不完整（需要 rooms / checkin / checkout）')
  }
  return {
    address: typeof p.address === 'string' ? p.address : '',
    rooms: p.rooms as RoomDef[],
    checkin: { ...emptyInspection(), ...p.checkin },
    checkout: { ...emptyInspection(), ...p.checkout },
  }
}

/** 演示用的默认房屋结构。 */
export function defaultProject(): Project {
  const mk = (name: string, facilities: string[]): RoomDef => ({
    id: genId('room'),
    name,
    facilities: facilities.map((f) => ({ id: genId('fac'), name: f })),
  })
  return {
    address: '',
    rooms: [
      mk('客厅', ['门窗', '墙面地面', '灯具', '空调', '沙发', '电视柜']),
      mk('主卧', ['门窗', '墙面地面', '灯具', '空调', '床', '衣柜']),
      mk('厨房', ['燃气灶', '抽油烟机', '水槽龙头', '冰箱', '橱柜']),
      mk('卫生间', ['马桶', '淋浴花洒', '洗手盆', '热水器', '排风扇']),
    ],
    checkin: emptyInspection(),
    checkout: emptyInspection(),
  }
}
