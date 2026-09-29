// 餐厅候位叫号核心逻辑（纯函数，便于测试）

export interface TableType {
  id: string
  name: string
  seats: number
  total: number
}

export type PartyStatus = 'waiting' | 'called' | 'seated' | 'passed' | 'cancelled' | 'done'

export interface Party {
  id: string
  ticket: string
  size: number
  arrivedAt: number
  status: PartyStatus
  allowShare: boolean
  /** 叫号/入座时分配的桌型 */
  tableTypeId?: string
  /** 同一桌实例（拼桌的多个 party 共享同一实例 id） */
  tableInstanceId?: string
}

export type LogType =
  | 'register'
  | 'call'
  | 'seat'
  | 'pass'
  | 'requeue'
  | 'cancel'
  | 'share'
  | 'clear'
  | 'config'

export interface LogEntry {
  id: string
  at: number
  type: LogType
  message: string
}

export interface State {
  /** 业务日期 YYYY-MM-DD，用于“当天数据” */
  date: string
  tableTypes: TableType[]
  parties: Party[]
  logs: LogEntry[]
  /** 每个桌型前缀的取号计数器 */
  counters: Record<string, number>
}

let idSeq = 0
export function nextId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`
}

export function todayString(now: number = Date.now()): string {
  const d = new Date(now)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function defaultTableTypes(): TableType[] {
  return [
    { id: 't-small', name: '小桌', seats: 2, total: 4 },
    { id: 't-mid', name: '中桌', seats: 4, total: 6 },
    { id: 't-large', name: '大桌', seats: 8, total: 2 }
  ]
}

export function createInitialState(now: number = Date.now()): State {
  return {
    date: todayString(now),
    tableTypes: defaultTableTypes(),
    parties: [],
    logs: [],
    counters: {}
  }
}

/** 桌型取号前缀：A、B、C……按座位数升序 */
export function typePrefix(state: State, typeId: string): string {
  const sorted = [...state.tableTypes].sort((a, b) => a.seats - b.seats)
  const idx = sorted.findIndex((t) => t.id === typeId)
  return String.fromCharCode(65 + (idx >= 0 ? idx : 0))
}

/** 能容纳 size 的最小桌型 */
export function smallestFittingType(state: State, size: number): TableType | null {
  const sorted = [...state.tableTypes].sort((a, b) => a.seats - b.seats)
  return sorted.find((t) => t.seats >= size) ?? null
}

function log(state: State, type: LogType, message: string, at: number): void {
  state.logs.unshift({ id: nextId('log'), at, type, message })
}

/** 登记取号。人数超过最大桌型时抛错。 */
export function registerParty(state: State, size: number, allowShare: boolean, now: number): Party {
  if (!Number.isInteger(size) || size < 1) throw new Error('人数必须为正整数')
  const type = smallestFittingType(state, size)
  if (!type) throw new Error(`没有能容纳 ${size} 人的桌型，请拆分就餐或调整桌型配置`)
  const prefix = typePrefix(state, type.id)
  const n = (state.counters[prefix] ?? 0) + 1
  state.counters[prefix] = n
  const party: Party = {
    id: nextId('party'),
    ticket: `${prefix}${String(n).padStart(3, '0')}`,
    size,
    arrivedAt: now,
    status: 'waiting',
    allowShare
  }
  state.parties.push(party)
  log(state, 'register', `取号 ${party.ticket}（${size} 人${allowShare ? '，接受拼桌' : ''}）`, now)
  return party
}

/** 某桌型已占用桌数：入座的不同桌实例 + 已叫号未入座的 party 数 */
export function occupiedCount(state: State, typeId: string): number {
  const instances = new Set<string>()
  let called = 0
  for (const p of state.parties) {
    if (p.tableTypeId !== typeId) continue
    if (p.status === 'seated' && p.tableInstanceId) instances.add(p.tableInstanceId)
    if (p.status === 'called') called += 1
  }
  return instances.size + called
}

export function availableCount(state: State, typeId: string): number {
  const type = state.tableTypes.find((t) => t.id === typeId)
  if (!type) return 0
  return Math.max(0, type.total - occupiedCount(state, typeId))
}

/**
 * 空桌叫号建议：在该桌型有空桌的前提下，
 * 优先选“最小合适桌型正好是该桌型”的最早排队者；
 * 若没有，则退而求其次选能容纳下的最早排队者。
 */
export function suggestForType(state: State, typeId: string): Party | null {
  const type = state.tableTypes.find((t) => t.id === typeId)
  if (!type || availableCount(state, typeId) <= 0) return null
  const waiting = state.parties
    .filter((p) => p.status === 'waiting')
    .sort((a, b) => a.arrivedAt - b.arrivedAt)
  const fits = waiting.filter((p) => p.size <= type.seats)
  const best = fits.filter((p) => smallestFittingType(state, p.size)?.id === typeId)
  return (best.length > 0 ? best : fits)[0] ?? null
}

function findParty(state: State, partyId: string): Party {
  const p = state.parties.find((x) => x.id === partyId)
  if (!p) throw new Error('找不到该排队记录')
  return p
}

function typeName(state: State, typeId: string | undefined): string {
  return state.tableTypes.find((t) => t.id === typeId)?.name ?? '未知桌型'
}

/** 叫号 */
export function callParty(state: State, partyId: string, typeId: string, now: number): void {
  const p = findParty(state, partyId)
  if (p.status !== 'waiting') throw new Error('该客人不在候位中')
  if (availableCount(state, typeId) <= 0) throw new Error('该桌型暂无空桌')
  p.status = 'called'
  p.tableTypeId = typeId
  log(state, 'call', `叫号 ${p.ticket}（${p.size} 人）→ ${typeName(state, typeId)}`, now)
}

/** 单人入座 */
export function seatParty(state: State, partyId: string, now: number): void {
  const p = findParty(state, partyId)
  if (p.status !== 'called') throw new Error('请先叫号再入座')
  p.status = 'seated'
  p.tableInstanceId = nextId('table')
  log(state, 'seat', `${p.ticket} 入座 ${typeName(state, p.tableTypeId)}`, now)
}

/** 拼桌入座：多个已叫号 party 共用一桌，须留记录 */
export function shareSeat(state: State, partyIds: string[], typeId: string, now: number): void {
  if (partyIds.length < 2) throw new Error('拼桌至少需要两位客人')
  const type = state.tableTypes.find((t) => t.id === typeId)
  if (!type) throw new Error('桌型不存在')
  const parties = partyIds.map((id) => findParty(state, id))
  for (const p of parties) {
    if (p.status !== 'called') throw new Error(`${p.ticket} 尚未叫号，不能拼桌入座`)
  }
  const totalSize = parties.reduce((s, p) => s + p.size, 0)
  if (totalSize > type.seats) throw new Error(`合计 ${totalSize} 人超出 ${type.name} 的 ${type.seats} 个座位`)
  if (availableCount(state, typeId) <= 0) throw new Error('该桌型暂无空桌')
  const instance = nextId('table')
  for (const p of parties) {
    p.status = 'seated'
    p.tableTypeId = typeId
    p.tableInstanceId = instance
  }
  const desc = parties.map((p) => `${p.ticket}（${p.size} 人）`).join(' + ')
  log(state, 'share', `拼桌：${desc} 共 ${totalSize} 人同坐 ${type.name}`, now)
}

/** 过号：保留记录，可重新排队 */
export function passParty(state: State, partyId: string, now: number): void {
  const p = findParty(state, partyId)
  if (p.status !== 'called') throw new Error('只有已叫号的客人才能记过号')
  p.status = 'passed'
  p.tableTypeId = undefined
  log(state, 'pass', `过号 ${p.ticket}（${p.size} 人）`, now)
}

/** 过号后重新排队，排到队尾 */
export function requeueParty(state: State, partyId: string, now: number): void {
  const p = findParty(state, partyId)
  if (p.status !== 'passed') throw new Error('只有过号客人才需要重新排队')
  p.status = 'waiting'
  p.arrivedAt = now
  log(state, 'requeue', `${p.ticket} 过号后重新排队`, now)
}

/** 取消排队/叫号，须留记录 */
export function cancelParty(state: State, partyId: string, now: number): void {
  const p = findParty(state, partyId)
  if (p.status === 'seated' || p.status === 'cancelled') throw new Error('该记录不能取消')
  p.status = 'cancelled'
  p.tableTypeId = undefined
  log(state, 'cancel', `取消 ${p.ticket}（${p.size} 人）`, now)
}

/** 释放一桌（客人离店），返回是否成功 */
export function freeTable(state: State, typeId: string, now: number): boolean {
  const seated = state.parties.filter(
    (p) => p.status === 'seated' && p.tableTypeId === typeId && p.tableInstanceId
  )
  const instanceIds = [...new Set(seated.map((p) => p.tableInstanceId!))]
  if (instanceIds.length === 0) return false
  const target = instanceIds[0]
  const tickets: string[] = []
  for (const p of seated) {
    if (p.tableInstanceId === target) {
      p.status = 'done'
      p.tableTypeId = undefined
      p.tableInstanceId = undefined
      tickets.push(p.ticket)
    }
  }
  log(state, 'seat', `${tickets.join('、')} 离店，${typeName(state, typeId)} 空出一桌`, now)
  return true
}

/** 某候位客人前方等待组数（按同一最小合适桌型、到店时间排序） */
export function waitingAhead(state: State, partyId: string): number {
  const p = findParty(state, partyId)
  const myType = smallestFittingType(state, p.size)
  if (!myType) return 0
  return state.parties.filter(
    (q) =>
      q.status === 'waiting' &&
      q.arrivedAt < p.arrivedAt &&
      smallestFittingType(state, q.size)?.id === myType.id
  ).length
}

/** 当前候位列表（按到店时间） */
export function waitingList(state: State): Party[] {
  return state.parties
    .filter((p) => p.status === 'waiting')
    .sort((a, b) => a.arrivedAt - b.arrivedAt)
}

/** 清空当天数据（保留桌型配置），须留记录 */
export function clearDay(state: State, now: number): void {
  state.parties = []
  state.logs = []
  state.counters = {}
  state.date = todayString(now)
  log(state, 'clear', '已清空当天候位数据', now)
}
