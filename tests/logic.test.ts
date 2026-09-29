import { describe, expect, it } from 'vitest'
import {
  assignSharedOwner,
  cloneTripAsNew,
  createItem,
  createMember,
  createTrip,
  deserializeState,
  filterItemsByPerson,
  memberWeightGrams,
  overweightMembers,
  serializeState,
  suggestItems,
  suitcaseStatuses,
  validateSharedItems,
} from '../src/logic'
import type { AppState } from '../src/types'

function makeTrip() {
  const trip = createTrip('三亚', 5)
  const alice = createMember('小明', 10)
  const bob = createMember('小红', 8)
  trip.members.push(alice, bob)
  return { trip, alice, bob }
}

describe('行李箱重量与超重提醒', () => {
  it('按携带人汇总重量，数量计入总重', () => {
    const { trip, alice, bob } = makeTrip()
    trip.items.push(
      createItem({ name: 'T恤', weightGrams: 200, quantity: 3, assigneeId: alice.id }),
      createItem({ name: '充电宝', weightGrams: 300, assigneeId: bob.id }),
    )
    expect(memberWeightGrams(trip.items, alice.id)).toBe(600)
    expect(memberWeightGrams(trip.items, bob.id)).toBe(300)
  })

  it('超出行李箱预设重量时标记超重并计算超出克数', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(createItem({ name: '哑铃', weightGrams: 12000, assigneeId: alice.id }))
    const statuses = suitcaseStatuses(trip)
    const aliceStatus = statuses.find((s) => s.member.id === alice.id)!
    expect(aliceStatus.overweight).toBe(true)
    expect(aliceStatus.overGrams).toBe(2000)
    const over = overweightMembers(trip)
    expect(over).toHaveLength(1)
    expect(over[0].member.name).toBe('小明')
  })

  it('未超重时不提醒', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(createItem({ name: '毛巾', weightGrams: 200, assigneeId: alice.id }))
    expect(overweightMembers(trip)).toHaveLength(0)
  })
})

describe('共享物品负责人约束', () => {
  it('共享物品未指定负责人时校验报错', () => {
    const { trip } = makeTrip()
    trip.items.push(createItem({ name: '急救包', shared: true }))
    const errors = validateSharedItems(trip)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('急救包')
  })

  it('共享物品指定一名负责人后校验通过', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(createItem({ name: '急救包', shared: true, assigneeId: alice.id }))
    expect(validateSharedItems(trip)).toHaveLength(0)
  })

  it('负责人被移出成员列表后校验报错', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(createItem({ name: '急救包', shared: true, assigneeId: alice.id }))
    trip.members.splice(0, 1)
    expect(validateSharedItems(trip)).toHaveLength(1)
  })

  it('assignSharedOwner 拒绝 0 名或多名负责人', () => {
    const item = createItem({ name: '插线板', shared: true })
    expect(assignSharedOwner(item, [])).toContain('只能指定一名')
    expect(assignSharedOwner(item, ['a', 'b'])).toContain('只能指定一名')
    expect(assignSharedOwner(item, ['a'])).toBeNull()
    expect(item.assigneeId).toBe('a')
  })
})

describe('按人筛选', () => {
  it('支持全部 / 未分配 / 指定成员', () => {
    const { trip, alice, bob } = makeTrip()
    trip.items.push(
      createItem({ name: 'A', assigneeId: alice.id }),
      createItem({ name: 'B', assigneeId: bob.id }),
      createItem({ name: 'C' }),
    )
    expect(filterItemsByPerson(trip.items, 'all')).toHaveLength(3)
    expect(filterItemsByPerson(trip.items, 'unassigned').map((i) => i.name)).toEqual(['C'])
    expect(filterItemsByPerson(trip.items, alice.id).map((i) => i.name)).toEqual(['A'])
  })
})

describe('复用历史清单', () => {
  it('复制行程时保留成员与物品、重置打包状态并重新分配 id', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(
      createItem({ name: '急救包', shared: true, assigneeId: alice.id, packed: true }),
      createItem({ name: '牙刷', assigneeId: alice.id, packed: true }),
    )
    const copy = cloneTripAsNew(trip, '成都', 3)
    expect(copy.id).not.toBe(trip.id)
    expect(copy.destination).toBe('成都')
    expect(copy.days).toBe(3)
    expect(copy.members).toHaveLength(2)
    expect(copy.items).toHaveLength(2)
    expect(copy.items.every((i) => !i.packed)).toBe(true)
    // 负责人映射到新成员 id，且共享标记保留
    const sharedItem = copy.items.find((i) => i.shared)!
    expect(sharedItem.assigneeId).toBe(copy.members[0].id)
    expect(copy.items.every((i) => !trip.items.some((o) => o.id === i.id))).toBe(true)
    // 原行程不受影响
    expect(trip.items.every((i) => i.packed)).toBe(true)
  })
})

describe('按目的地与天数生成建议物品', () => {
  it('消耗品数量随天数增长', () => {
    const threeDays = suggestItems('北京', 3)
    const sevenDays = suggestItems('北京', 7)
    const underwear = (items: ReturnType<typeof suggestItems>) =>
      items.find((i) => i.name === '换洗内衣')!.quantity
    expect(underwear(threeDays)).toBe(3)
    expect(underwear(sevenDays)).toBe(7)
  })

  it('目的地关键词触发场景物品', () => {
    const beach = suggestItems('三亚', 4)
    expect(beach.some((i) => i.name === '泳衣')).toBe(true)
    const snow = suggestItems('哈尔滨', 4)
    expect(snow.some((i) => i.name === '羽绒服')).toBe(true)
    const plain = suggestItems('成都', 4)
    expect(plain.some((i) => i.name === '泳衣')).toBe(false)
  })

  it('包含共享物品且默认未指定负责人', () => {
    const items = suggestItems('杭州', 2)
    const shared = items.filter((i) => i.shared)
    expect(shared.length).toBeGreaterThan(0)
    expect(shared.every((i) => i.assigneeId === null)).toBe(true)
  })
})

describe('本地持久化', () => {
  it('序列化后可完整还原，刷新不丢进度', () => {
    const { trip, alice } = makeTrip()
    trip.items.push(createItem({ name: '牙刷', assigneeId: alice.id, packed: true }))
    const state: AppState = { version: 1, trips: [trip], activeTripId: trip.id }
    const restored = deserializeState(serializeState(state))!
    expect(restored.trips).toHaveLength(1)
    expect(restored.activeTripId).toBe(trip.id)
    expect(restored.trips[0].items[0].packed).toBe(true)
    expect(restored.trips[0].items[0].assigneeId).toBe(alice.id)
  })

  it('损坏或缺失的数据返回 null', () => {
    expect(deserializeState(null)).toBeNull()
    expect(deserializeState('not-json')).toBeNull()
    expect(deserializeState('{"version":2}')).toBeNull()
    expect(deserializeState('{"version":1}')).toBeNull()
  })
})
