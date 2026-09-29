import type {
  AppState,
  CallSuggestion,
  Party,
  RegisterInput,
  RestaurantTable,
} from './types'
import { RestaurantError } from './logic'
import {
  createDay,
  createLog,
  formatQueueNumber,
  getActiveTableParties,
  getAssignedSeats,
  getParty,
  getTable,
  getWaitingParties,
  makeId,
} from './logic'

export const cloneState = (state: AppState): AppState =>
  structuredClone({
    ...state,
    tableTypes: state.tableTypes,
    tables: state.tables,
    day: state.day,
  })

const validateArrivalTime = (value: string): void => {
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) {
    throw new RestaurantError('请选择有效的到店时间')
  }
}

export const registerParty = (
  state: AppState,
  input: RegisterInput,
  now: string,
): AppState => {
  const next = cloneState(state)
  const name = input.name.trim()
  const size = input.size
  if (!name) throw new RestaurantError('请输入联系人或称呼')
  if (!Number.isInteger(size) || size <= 0 || size > 99) {
    throw new RestaurantError('人数必须是 1 到 99 的整数')
  }
  validateArrivalTime(input.arrivalTime)

  const number = next.day.nextNumber
  const party: Party = {
    id: makeId(),
    number,
    name,
    size,
    arrivalTime: input.arrivalTime,
    createdAt: now,
    acceptShare: input.acceptShare,
    status: 'waiting',
    tableIds: [],
  }
  next.day.parties.push(party)
  next.day.nextNumber += 1
  next.day.logs.unshift(
    createLog(
      'registered',
      `${formatQueueNumber(number)} ${name} ${size}人登记，到店时间 ${input.arrivalTime.slice(11, 16)}${input.acceptShare ? '，接受拼桌' : ''}`,
      now,
      { partyId: party.id, partyNumber: number },
    ),
  )
  return next
}

const findFreeTable = (tables: RestaurantTable[], size: number): RestaurantTable | undefined =>
  tables
    .filter((table) => table.status === 'free' && table.seats >= size)
    .sort((a, b) => a.seats - b.seats || a.label.localeCompare(b.label, 'zh-Hans-CN'))[0]

const findSharedTable = (
  state: AppState,
  party: Party,
): { table: RestaurantTable; spareSeats: number; seatedPartyCount: number } | undefined => {
  if (!party.acceptShare) return undefined
  const matches: Array<{ table: RestaurantTable; spareSeats: number; seatedPartyCount: number }> = []
  for (const table of state.tables) {
    if (table.status !== 'occupied') continue
    const parties = getActiveTableParties(state, table)
    if (!parties.some((item) => item.status === 'seated')) continue
    if (parties.some((item) => !item.acceptShare)) continue
    const spareSeats = table.seats - getAssignedSeats(state, table)
    if (spareSeats >= party.size) {
      matches.push({ table, spareSeats, seatedPartyCount: parties.length })
    }
  }
  return matches
    .sort(
      (a, b) =>
        a.spareSeats - b.spareSeats ||
        a.table.seats - b.table.seats ||
        a.table.label.localeCompare(b.table.label, 'zh-Hans-CN'),
    )[0]
}

export const getCallSuggestions = (state: AppState): CallSuggestion[] => {
  const simulation = cloneState(state)
  const suggestions: CallSuggestion[] = []

  for (const originalParty of getWaitingParties(state)) {
    const party = getParty(simulation, originalParty.id)
    if (party.status !== 'waiting') continue

    const freeTable = findFreeTable(simulation.tables, party.size)
    if (freeTable) {
      suggestions.push({
        party,
        table: freeTable,
        kind: 'direct',
        spareSeats: freeTable.seats - party.size,
        seatedPartyCount: 0,
        reason: `${freeTable.label} 可直接入座，空余 ${freeTable.seats - party.size} 个座位`,
      })
      freeTable.status = 'occupied'
      freeTable.partyIds.push(party.id)
      party.tableIds.push(freeTable.id)
      continue
    }

    const shared = findSharedTable(simulation, party)
    if (!shared) continue
    suggestions.push({
      party,
        table: shared.table,
        kind: 'shared',
        spareSeats: shared.spareSeats,
        seatedPartyCount: shared.seatedPartyCount,
      reason: `${shared.table.label} 可拼桌，加入后空余 ${shared.spareSeats - party.size} 个座位`,
    })
    shared.table.partyIds.push(party.id)
    party.tableIds.push(shared.table.id)
  }

  return suggestions
}

export const callParty = (
  state: AppState,
  partyId: string,
  tableId: string,
  kind: 'direct' | 'shared',
  now: string,
): AppState => {
  const next = cloneState(state)
  const party = getParty(next, partyId)
  const table = getTable(next, tableId)
  if (party.status !== 'waiting') throw new RestaurantError('该客人不在候位中')

  const assignedSeats = getAssignedSeats(next, table)
  if (kind === 'direct') {
    if (table.status !== 'free' || table.partyIds.length > 0) {
      throw new RestaurantError('该餐桌不是空闲桌')
    }
    if (table.seats < party.size) throw new RestaurantError('该餐桌座位不足')
  } else {
    const parties = getActiveTableParties(next, table)
    if (
      table.status !== 'occupied' ||
      !parties.some((item) => item.status === 'seated') ||
      parties.length === 0
    ) {
      throw new RestaurantError('该餐桌当前没有已入座客人，不能拼桌')
    }
    if (!party.acceptShare || parties.some((item) => !item.acceptShare)) {
      throw new RestaurantError('双方都接受拼桌才能安排')
    }
    if (table.seats < assignedSeats + party.size) {
      throw new RestaurantError('拼桌后座位不足')
    }
  }

  party.status = 'called'
  party.calledAt = now
  party.tableIds = [table.id]
  table.status = 'occupied'
  table.partyIds.push(party.id)

  const queueNo = formatQueueNumber(party.number)
  next.day.logs.unshift(
    createLog(
      'called',
      kind === 'shared'
        ? `叫号 ${queueNo} ${party.name} 至 ${table.label} 拼桌`
        : `叫号 ${queueNo} ${party.name} 至 ${table.label}`,
      now,
      { partyId: party.id, partyNumber: party.number, tableIds: [table.id] },
    ),
  )
  return next
}

const releaseCalledTable = (state: AppState, party: Party): void => {
  party.tableIds.forEach((tableId) => {
    const table = getTable(state, tableId)
    table.partyIds = table.partyIds.filter((id) => id !== party.id)
    if (getActiveTableParties(state, table).length === 0) {
      table.status = 'free'
    }
  })
  party.tableIds = []
  party.calledAt = undefined
}

export const seatParty = (state: AppState, partyId: string, now: string): AppState => {
  const next = cloneState(state)
  const party = getParty(next, partyId)
  if (party.status !== 'called') throw new RestaurantError('该客人尚未叫号')
  party.status = 'seated'
  party.seatedAt = now
  const tableIds = [...party.tableIds]
  const wasSharing = tableIds.some(
    (id) => getActiveTableParties(next, getTable(next, id)).length > 1,
  )

  next.day.logs.unshift(
    createLog(
      wasSharing ? 'shared' : 'seated',
      `${formatQueueNumber(party.number)} ${party.name} 已入座 ${tableIds
        .map((id) => getTable(next, id).label)
        .join('、')}${wasSharing ? '（拼桌）' : ''}`,
      now,
      { partyId: party.id, partyNumber: party.number, tableIds },
    ),
  )
  return next
}

const completeParty = (
  state: AppState,
  partyId: string,
  now: string,
  status: 'missed' | 'cancelled' | 'left',
  detailPrefix: string,
  logType: 'missed' | 'cancelled' | 'left',
): AppState => {
  const next = cloneState(state)
  const party = getParty(next, partyId)
  if (party.status === 'waiting' && status === 'left') {
    throw new RestaurantError('候位中的客人请使用取消登记')
  }
  if (status === 'missed' && party.status !== 'called') {
    throw new RestaurantError('只有已叫号客人可以标记过号')
  }
  if (party.status === 'seated' && status !== 'left') {
    throw new RestaurantError('已入座客人只能办理离店')
  }
  if (party.status === 'called' && status === 'left') {
    throw new RestaurantError('已叫号客人请先入座或标记过号/取消')
  }
  if (!['waiting', 'called', 'seated'].includes(party.status)) {
    throw new RestaurantError('该记录已结束')
  }

  const tableIds = [...party.tableIds]
  const wasSharing = tableIds.some((id) => {
    const parties = getActiveTableParties(next, getTable(next, id)).filter(
      (item) => item.id !== party.id,
    )
    return parties.length > 0
  })

  party.status = status
  party.completedAt = now
  releaseCalledTable(next, party)

  next.day.logs.unshift(
    createLog(
      logType,
      `${detailPrefix} ${formatQueueNumber(party.number)} ${party.name}${
        tableIds.length ? `，餐桌 ${tableIds.map((id) => getTable(next, id).label).join('、')}` : ''
      }${wasSharing ? '（拼桌结束）' : ''}`,
      now,
      { partyId: party.id, partyNumber: party.number, tableIds },
    ),
  )
  return next
}

export const markPartyMissed = (state: AppState, partyId: string, now: string): AppState =>
  completeParty(state, partyId, now, 'missed', '过号', 'missed')

export const cancelParty = (state: AppState, partyId: string, now: string): AppState =>
  completeParty(state, partyId, now, 'cancelled', '取消登记', 'cancelled')

export const leaveParty = (state: AppState, partyId: string, now: string): AppState =>
  completeParty(state, partyId, now, 'left', '离店', 'left')

export const clearDay = (
  state: AppState,
  now: string,
  dateKey: string = state.day.dateKey,
): AppState => {
  const next = cloneState(state)
  next.day = createDay(dateKey)
  next.tables = next.tables.map((table) => ({
    ...table,
    status: 'free',
    partyIds: [],
  }))
  next.day.logs.unshift(createLog('cleared', '当天候位、叫号、入座和餐桌数据已清空', now))
  return next
}

export const startDayIfNeeded = (
  state: AppState,
  dateKey: string,
  now: string = new Date().toISOString(),
): AppState => {
  if (state.day.dateKey === dateKey) return state
  return clearDay(state, now, dateKey)
}
