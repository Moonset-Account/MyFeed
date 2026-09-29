import { describe, expect, it } from 'vitest'
import { addTableType, createInitialState, formatQueueNumber, updateTableType } from '../restaurant/logic'
import {
  callParty,
  cancelParty,
  clearDay,
  getCallSuggestions,
  leaveParty,
  markPartyMissed,
  registerParty,
  seatParty,
  startDayIfNeeded,
} from '../restaurant/operations'
import type { AppState } from '../restaurant/types'

const NOW = '2026-09-30T12:00:00'

const register = (
  state: AppState,
  name: string,
  size: number,
  arrivalTime: string,
  acceptShare = false,
) => registerParty(state, { name, size, arrivalTime, acceptShare }, NOW)

const occupyOtherTables = (state: AppState, exceptTableId: string): AppState => {
  let next = state
  next.tables
    .filter((table) => table.status === 'free' && table.id !== exceptTableId)
    .forEach((table) => {
      next = register(next, `占用 ${table.label}`, table.seats, '2026-09-30T11:00', false)
      const partyId = next.day.parties.at(-1)!.id
      next = callParty(next, partyId, table.id, 'direct', NOW)
      next = seatParty(next, partyId, NOW)
    })
  return next
}

describe('候位核心规则', () => {
  it('按到店时间排序，并优先选择能坐下的最小空桌', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '6人聚餐', 6, '2026-09-30T12:20')
    state = register(state, '4人家庭', 4, '2026-09-30T12:10')

    const suggestions = getCallSuggestions(state)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].party.name).toBe('4人家庭')
    expect(suggestions[0].table.seats).toBe(4)
    expect(suggestions[0].kind).toBe('direct')
    expect(suggestions[1].party.name).toBe('6人聚餐')
    expect(suggestions[1].table.seats).toBe(6)
  })

  it('成批建议会预留已建议餐桌，避免同一张桌重复叫号', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '甲', 4, '2026-09-30T12:00')
    state = register(state, '乙', 2, '2026-09-30T12:05')

    const suggestions = getCallSuggestions(state)
    expect(suggestions.map((item) => item.table.id)).not.toContain(
      suggestions[0]?.table.id === suggestions[1]?.table.id ? 'duplicate' : '',
    )
    expect(new Set(suggestions.map((item) => item.table.id)).size).toBe(2)
  })

  it('只在双方接受拼桌且余位足够时推荐拼桌', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '先到四人', 4, '2026-09-30T11:30', true)
    const targetTableId = state.tables.find((table) => table.seats === 6)!.id
    state = callParty(state, state.day.parties[0]!.id, targetTableId, 'direct', NOW)
    state = seatParty(state, state.day.parties[0]!.id, NOW)
    state = occupyOtherTables(state, targetTableId)
    state = register(state, '拒绝拼桌二人', 2, '2026-09-30T12:00', false)
    expect(getCallSuggestions(state)).toHaveLength(0)

    state = register(state, '接受拼桌二人', 2, '2026-09-30T12:05', true)
    const suggestions = getCallSuggestions(state)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.kind).toBe('shared')
    expect(suggestions[0]?.table.seats).toBe(6)
    expect(suggestions[0]?.spareSeats).toBe(2)
  })

  it('拒绝拼桌的客人不会被安排到已占用桌，且会保留为候位', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '先到', 8, '2026-09-30T11:00', true)
    const targetTableId = state.tables.find((table) => table.seats === 8)!.id
    state = callParty(state, state.day.parties[0]!.id, targetTableId, 'direct', NOW)
    state = seatParty(state, state.day.parties[0]!.id, NOW)
    state = occupyOtherTables(state, targetTableId)
    state = register(state, '不拼桌', 1, '2026-09-30T12:00', false)

    expect(getCallSuggestions(state)).toHaveLength(0)
    expect(state.day.parties.at(-1)?.status).toBe('waiting')
  })

  it('过号和取消会结束候位、释放预留桌并写入记录', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '甲', 2, '2026-09-30T12:00')
    const partyId = state.day.parties[0]!.id
    const tableId = getCallSuggestions(state)[0]!.table.id
    state = callParty(state, partyId, tableId, 'direct', NOW)
    expect(state.tables.find((table) => table.id === tableId)?.status).toBe('occupied')

    state = markPartyMissed(state, partyId, NOW)
    expect(state.day.parties[0]?.status).toBe('missed')
    expect(state.tables.find((table) => table.id === tableId)?.status).toBe('free')
    expect(state.day.logs[0]?.type).toBe('missed')

    state = register(state, '乙', 2, '2026-09-30T12:10')
    const secondId = state.day.parties.at(-1)!.id
    state = cancelParty(state, secondId, NOW)
    expect(state.day.parties.at(-1)?.status).toBe('cancelled')
    expect(state.day.logs[0]?.type).toBe('cancelled')
  })

  it('入座、拼桌和离店均留痕，并在最后一组离店后释放餐桌', () => {
    let state = createInitialState('2026-09-30')
    state = register(state, '甲', 4, '2026-09-30T11:30', true)
    const firstId = state.day.parties[0]!.id
    const tableId = state.tables.find((table) => table.seats === 6)!.id
    state = callParty(state, firstId, tableId, 'direct', NOW)
    state = seatParty(state, firstId, NOW)
    state = occupyOtherTables(state, tableId)

    state = register(state, '乙', 2, '2026-09-30T12:00', true)
    const secondId = state.day.parties.at(-1)!.id
    state = callParty(state, secondId, tableId, 'shared', NOW)
    state = seatParty(state, secondId, NOW)
    expect(state.day.logs[0]?.type).toBe('shared')

    state = leaveParty(state, firstId, NOW)
    expect(state.tables.find((table) => table.id === tableId)?.status).toBe('occupied')
    state = leaveParty(state, secondId, NOW)
    expect(state.tables.find((table) => table.id === tableId)?.status).toBe('free')
    expect(state.day.logs.filter((log) => log.type === 'left')).toHaveLength(2)
  })

  it('清空当天业务数据但保留桌型配置，并写入清空记录', () => {
    let state = createInitialState('2026-09-30')
    state = addTableType(state, { name: '10人包厢', seats: 10, count: 1 })
    state = register(state, '甲', 2, '2026-09-30T12:00')
    state = clearDay(state, NOW, '2026-09-30')

    expect(state.day.parties).toHaveLength(0)
    expect(state.tables.every((table) => table.status === 'free' && table.partyIds.length === 0)).toBe(true)
    expect(state.tableTypes.some((type) => type.name === '10人包厢')).toBe(true)
    expect(state.day.logs[0]?.type).toBe('cleared')
  })

  it('跨天自动开始新的一天，且桌型配置延续', () => {
    const state = createInitialState('2026-09-30')
    const next = startDayIfNeeded(state, '2026-10-01')
    expect(next.day.dateKey).toBe('2026-10-01')
    expect(next.day.parties).toHaveLength(0)
    expect(next.tableTypes.length).toBeGreaterThan(0)
  })

  it('可修改桌型名称、座位数和桌数', () => {
    const state = createInitialState('2026-09-30')
    const typeId = state.tableTypes[0]!.id
    const updated = updateTableType(state, typeId, { name: '双人雅座', seats: 2, count: 10 })
    const type = updated.tableTypes.find((item) => item.id === typeId)
    expect(type?.name).toBe('双人雅座')
    expect(updated.tables.filter((table) => table.typeId === typeId)).toHaveLength(10)
  })

  it('格式化排队号', () => {
    expect(formatQueueNumber(1)).toBe('A001')
    expect(formatQueueNumber(42)).toBe('A042')
  })
})
