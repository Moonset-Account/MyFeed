import type { AppState, Item, Member, PersonFilter, Trip } from './types'

let idCounter = 0

/** 生成本地唯一 id（时间戳 + 随机数 + 自增，避免同一毫秒内冲突） */
export function genId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${idCounter}`
}

export function createEmptyState(): AppState {
  return { version: 1, trips: [], activeTripId: null }
}

export function createTrip(destination: string, days: number, name?: string): Trip {
  const trimmed = destination.trim()
  return {
    id: genId('trip'),
    name: name?.trim() || `${trimmed} ${days} 日游`,
    destination: trimmed,
    days,
    createdAt: Date.now(),
    members: [],
    items: [],
  }
}

export function createMember(name: string, suitcaseLimitKg: number): Member {
  return { id: genId('member'), name: name.trim(), suitcaseLimitKg }
}

export function createItem(partial: Partial<Item> & { name: string }): Item {
  return {
    id: genId('item'),
    category: partial.category ?? '其他',
    quantity: partial.quantity ?? 1,
    weightGrams: partial.weightGrams ?? 0,
    shared: partial.shared ?? false,
    assigneeId: partial.assigneeId ?? null,
    packed: partial.packed ?? false,
    name: partial.name.trim(),
  }
}

/* ---------------- 重量与行李箱限重 ---------------- */

/** 某成员名下物品的总重量（克），数量计入 */
export function memberWeightGrams(items: Item[], memberId: string): number {
  return items
    .filter((it) => it.assigneeId === memberId)
    .reduce((sum, it) => sum + it.weightGrams * Math.max(1, it.quantity), 0)
}

export interface SuitcaseStatus {
  member: Member
  totalGrams: number
  limitGrams: number
  overweight: boolean
  /** 超重克数，未超重为 0 */
  overGrams: number
}

/** 每位成员的行李箱负重状态，超出预设限重时 overweight 为 true */
export function suitcaseStatuses(trip: Trip): SuitcaseStatus[] {
  return trip.members.map((member) => {
    const totalGrams = memberWeightGrams(trip.items, member.id)
    const limitGrams = Math.round(member.suitcaseLimitKg * 1000)
    const overGrams = Math.max(0, totalGrams - limitGrams)
    return { member, totalGrams, limitGrams, overweight: overGrams > 0, overGrams }
  })
}

export function overweightMembers(trip: Trip): SuitcaseStatus[] {
  return suitcaseStatuses(trip).filter((s) => s.overweight)
}

/* ---------------- 共享物品负责人约束 ---------------- */

/**
 * 校验共享物品负责人：共享物品必须指定且只能指定一名负责人。
 * 返回错误信息列表，空数组表示全部合法。
 */
export function validateSharedItems(trip: Trip): string[] {
  const errors: string[] = []
  for (const item of trip.items) {
    if (!item.shared) continue
    if (!item.assigneeId) {
      errors.push(`共享物品「${item.name}」尚未指定负责人`)
    } else if (!trip.members.some((m) => m.id === item.assigneeId)) {
      errors.push(`共享物品「${item.name}」的负责人已不在成员列表中`)
    }
  }
  return errors
}

/**
 * 为共享物品指定负责人。共享物品只能有一名负责人，
 * 传入 0 名或多名时返回错误信息，成功时返回 null。
 */
export function assignSharedOwner(item: Item, ownerIds: string[]): string | null {
  if (!item.shared) return null
  if (ownerIds.length !== 1) {
    return `共享物品「${item.name}」只能指定一名负责人（当前 ${ownerIds.length} 名）`
  }
  item.assigneeId = ownerIds[0]
  return null
}

/* ---------------- 按人筛选 ---------------- */

export function filterItemsByPerson(items: Item[], filter: PersonFilter): Item[] {
  if (filter === 'all') return items
  if (filter === 'unassigned') return items.filter((it) => !it.assigneeId)
  return items.filter((it) => it.assigneeId === filter)
}

/* ---------------- 复用历史清单 ---------------- */

/**
 * 以历史行程为模板生成新行程：保留成员与物品（含重量、共享标记、负责人），
 * 所有物品重置为未打包，生成全新 id。
 */
export function cloneTripAsNew(source: Trip, destination?: string, days?: number): Trip {
  const memberIdMap = new Map<string, string>()
  const members = source.members.map((m) => {
    const id = genId('member')
    memberIdMap.set(m.id, id)
    return { ...m, id }
  })
  const items = source.items.map((it) => ({
    ...it,
    id: genId('item'),
    packed: false,
    assigneeId: it.assigneeId ? (memberIdMap.get(it.assigneeId) ?? null) : null,
  }))
  const dest = (destination ?? source.destination).trim()
  const tripDays = days ?? source.days
  return {
    id: genId('trip'),
    name: `${dest} ${tripDays} 日游`,
    destination: dest,
    days: tripDays,
    createdAt: Date.now(),
    members,
    items,
  }
}

/* ---------------- 按目的地与天数生成建议物品 ---------------- */

interface Suggestion {
  name: string
  category: string
  weightGrams: number
  shared?: boolean
  /** 每件物品覆盖的天数；缺省表示与天数无关，只带 1 件 */
  daysPerUnit?: number
}

const BASE_SUGGESTIONS: Suggestion[] = [
  { name: '换洗内衣', category: '衣物', weightGrams: 80, daysPerUnit: 1 },
  { name: '袜子', category: '衣物', weightGrams: 60, daysPerUnit: 1 },
  { name: 'T 恤 / 上衣', category: '衣物', weightGrams: 200, daysPerUnit: 2 },
  { name: '长裤', category: '衣物', weightGrams: 450, daysPerUnit: 3 },
  { name: '睡衣', category: '衣物', weightGrams: 250 },
  { name: '牙刷 / 牙膏', category: '洗漱', weightGrams: 150 },
  { name: '毛巾', category: '洗漱', weightGrams: 200 },
  { name: '旅行装洗护用品', category: '洗漱', weightGrams: 300 },
  { name: '手机充电器', category: '电子', weightGrams: 120 },
  { name: '充电宝', category: '电子', weightGrams: 300 },
  { name: '身份证 / 护照', category: '证件', weightGrams: 30 },
  { name: '常用药', category: '药品', weightGrams: 150 },
  { name: '插线板', category: '电子', weightGrams: 250, shared: true },
  { name: '急救包', category: '药品', weightGrams: 400, shared: true },
  { name: '雨伞', category: '其他', weightGrams: 350, shared: true },
]

const BEACH_SUGGESTIONS: Suggestion[] = [
  { name: '泳衣', category: '衣物', weightGrams: 200 },
  { name: '防晒霜', category: '洗漱', weightGrams: 150 },
  { name: '太阳镜', category: '其他', weightGrams: 50 },
  { name: '人字拖', category: '衣物', weightGrams: 300 },
]

const SNOW_SUGGESTIONS: Suggestion[] = [
  { name: '羽绒服', category: '衣物', weightGrams: 800 },
  { name: '保暖内衣', category: '衣物', weightGrams: 300, daysPerUnit: 3 },
  { name: '手套 / 帽子', category: '衣物', weightGrams: 200 },
  { name: '暖宝宝', category: '其他', weightGrams: 200 },
]

const BEACH_KEYWORDS = ['海', '沙滩', '岛', '三亚', '普吉', '巴厘', '马尔代夫', 'beach']
const SNOW_KEYWORDS = ['雪', '滑雪', '哈尔滨', '长白山', '北海道', 'ski']

/**
 * 按目的地与行程天数生成建议物品清单。
 * 天数影响消耗品数量（如内衣每天一件），目的地关键词追加场景物品。
 */
export function suggestItems(destination: string, days: number): Item[] {
  const safeDays = Math.max(1, Math.round(days))
  const dest = destination.toLowerCase()
  const pool = [...BASE_SUGGESTIONS]
  if (BEACH_KEYWORDS.some((k) => dest.includes(k))) pool.push(...BEACH_SUGGESTIONS)
  if (SNOW_KEYWORDS.some((k) => dest.includes(k))) pool.push(...SNOW_SUGGESTIONS)
  return pool.map((s) =>
    createItem({
      name: s.name,
      category: s.category,
      weightGrams: s.weightGrams,
      shared: s.shared ?? false,
      quantity: s.daysPerUnit ? Math.max(1, Math.ceil(safeDays / s.daysPerUnit)) : 1,
    }),
  )
}

/* ---------------- 本地持久化 ---------------- */

export const STORAGE_KEY = 'trip-packing-state-v1'

export function serializeState(state: AppState): string {
  return JSON.stringify(state)
}

/** 反序列化；数据缺失或损坏时返回 null，由调用方回退到空状态 */
export function deserializeState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.trips)) return null
    return parsed
  } catch {
    return null
  }
}

export function formatGrams(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`
  return `${Math.round(grams)} g`
}
