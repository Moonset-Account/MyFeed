import type {
  ActivityLog,
  AppState,
  DayData,
  Party,
  RestaurantTable,
  TableType,
} from './types'

export class RestaurantError extends Error {}

export const asPositiveInt = (value: number, field: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RestaurantError(`${field}必须是大于 0 的整数`)
  }
  return value
}

export const makeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const createLog = (
  type: ActivityLog['type'],
  detail: string,
  now: string,
  extra: Pick<ActivityLog, 'partyId' | 'partyNumber' | 'tableIds'> = {},
): ActivityLog => ({
  id: makeId(),
  time: now,
  type,
  ...extra,
  detail,
})

export const createDay = (dateKey: string): DayData => ({
  dateKey,
  parties: [],
  logs: [],
  nextNumber: 1,
})

export const formatQueueNumber = (value: number): string =>
  `A${String(value).padStart(3, '0')}`

export const createInitialState = (dateKey: string): AppState => {
  const defaults: Array<[string, number, number]> = [
    ['2人桌', 2, 8],
    ['4人桌', 4, 6],
    ['6人桌', 6, 2],
    ['8人桌', 8, 1],
  ]

  const tableTypes: TableType[] = []
  const tables: RestaurantTable[] = []

  defaults.forEach(([name, seats, count], typeIndex) => {
    const typeId = `type-${typeIndex + 1}`
    tableTypes.push({ id: typeId, name, seats, count })
    for (let index = 1; index <= count; index += 1) {
      tables.push({
        id: `${typeId}-table-${index}`,
        typeId,
        label: `${seats}-${index}`,
        seats,
        status: 'free',
        partyIds: [],
      })
    }
  })

  return { tableTypes, tables, day: createDay(dateKey) }
}

const cloneState = (state: AppState): AppState =>
  structuredClone({
    ...state,
    tableTypes: state.tableTypes,
    tables: state.tables,
    day: state.day,
  })

const activePartyStatus = new Set(['waiting', 'called', 'seated'])

export const getParty = (state: AppState, partyId: string): Party => {
  const party = state.day.parties.find((item) => item.id === partyId)
  if (!party) throw new RestaurantError('未找到对应候位记录')
  return party
}

export const getTable = (state: AppState, tableId: string): RestaurantTable => {
  const table = state.tables.find((item) => item.id === tableId)
  if (!table) throw new RestaurantError('未找到对应餐桌')
  return table
}

const isPartyActive = (party: Party): boolean => activePartyStatus.has(party.status)

export const getActiveTableParties = (
  state: AppState,
  table: RestaurantTable,
): Party[] =>
  table.partyIds
    .map((id) => getParty(state, id))
    .filter((party) => isPartyActive(party))

export const getAssignedSeats = (state: AppState, table: RestaurantTable): number =>
  getActiveTableParties(state, table).reduce((sum, party) => sum + party.size, 0)

export const getWaitingParties = (state: AppState): Party[] =>
  state.day.parties
    .filter((party) => party.status === 'waiting')
    .sort((a, b) => {
      const arrival = a.arrivalTime.localeCompare(b.arrivalTime)
      if (arrival !== 0) return arrival
      const created = a.createdAt.localeCompare(b.createdAt)
      return created !== 0 ? created : a.number - b.number
    })

export const addTableType = (
  state: AppState,
  input: { name: string; seats: number; count: number },
): AppState => {
  const next = cloneState(state)
  const name = input.name.trim()
  if (!name) throw new RestaurantError('请输入桌型名称')
  if (next.tableTypes.some((type) => type.name === name)) {
    throw new RestaurantError('桌型名称不能重复')
  }
  const seats = asPositiveInt(input.seats, '座位数')
  if (!Number.isInteger(input.count) || input.count < 0 || input.count > 99) {
    throw new RestaurantError('桌数必须是 0 到 99 的整数')
  }
  const id = `type-${makeId()}`
  next.tableTypes.push({ id, name, seats, count: input.count })
  for (let index = 1; index <= input.count; index += 1) {
    next.tables.push({
      id: `${id}-table-${index}`,
      typeId: id,
      label: `${seats}-${index}`,
      seats,
      status: 'free',
      partyIds: [],
    })
  }
  return next
}

const typeHasActiveTable = (state: AppState, typeId: string): boolean =>
  state.tables.some(
    (table) => table.typeId === typeId && getActiveTableParties(state, table).length > 0,
  )

export const updateTableType = (
  state: AppState,
  typeId: string,
  input: { name: string; seats: number; count: number },
): AppState => {
  const next = cloneState(state)
  const type = next.tableTypes.find((item) => item.id === typeId)
  if (!type) throw new RestaurantError('未找到桌型')
  const name = input.name.trim()
  if (!name) throw new RestaurantError('请输入桌型名称')
  if (
    next.tableTypes.some((item) => item.id !== typeId && item.name === name)
  ) {
    throw new RestaurantError('桌型名称不能重复')
  }
  const seats = asPositiveInt(input.seats, '座位数')
  if (!Number.isInteger(input.count) || input.count < 0 || input.count > 99) {
    throw new RestaurantError('桌数必须是 0 到 99 的整数')
  }
  if (input.count < type.count && typeHasActiveTable(next, typeId)) {
    throw new RestaurantError('该桌型仍有客人在桌或已被叫号，不能减少桌数')
  }

  const existing = next.tables.filter((table) => table.typeId === typeId)
  if (seats !== type.seats) {
    if (typeHasActiveTable(next, typeId)) {
      throw new RestaurantError('该桌型仍有客人在桌或已被叫号，不能修改座位数')
    }
    existing.forEach((table) => {
      table.seats = seats
      table.label = `${seats}-${table.label.split('-').at(-1)}`
    })
  }

  if (input.count > type.count) {
    for (let index = type.count + 1; index <= input.count; index += 1) {
      next.tables.push({
        id: `${typeId}-table-${index}`,
        typeId,
        label: `${seats}-${index}`,
        seats,
        status: 'free',
        partyIds: [],
      })
    }
  } else if (input.count < type.count) {
    const removeIds = existing
      .slice(input.count)
      .filter((table) => getActiveTableParties(next, table).length === 0)
      .map((table) => table.id)
    if (removeIds.length !== type.count - input.count) {
      throw new RestaurantError('只能减少末尾空闲餐桌')
    }
    next.tables = next.tables.filter((table) => !removeIds.includes(table.id))
  }

  type.name = name
  type.seats = seats
  type.count = input.count
  return next
}

export const deleteTableType = (state: AppState, typeId: string): AppState => {
  const next = cloneState(state)
  const type = next.tableTypes.find((item) => item.id === typeId)
  if (!type) throw new RestaurantError('未找到桌型')
  if (typeHasActiveTable(next, typeId)) {
    throw new RestaurantError('该桌型仍有客人在桌或已被叫号，不能删除')
  }
  next.tables = next.tables.filter((table) => table.typeId !== typeId)
  next.tableTypes = next.tableTypes.filter((item) => item.id !== typeId)
  return next
}
