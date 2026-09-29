import type { ActivityLog, AppState, Party, RestaurantTable } from './types'
export { getWaitingParties } from './logic'
import { getActiveTableParties, getAssignedSeats, getWaitingParties } from './logic'

export interface DaySummary {
  waitingGroups: number
  waitingPeople: number
  calledGroups: number
  seatedGroups: number
  servedPeople: number
  freeTables: number
  occupiedTables: number
  missedGroups: number
  cancelledGroups: number
}

export const getCalledParties = (state: AppState): Party[] =>
  state.day.parties
    .filter((party) => party.status === 'called')
    .sort((a, b) => (a.calledAt ?? '').localeCompare(b.calledAt ?? '') || a.number - b.number)

export const getSeatedParties = (state: AppState): Party[] =>
  state.day.parties
    .filter((party) => party.status === 'seated')
    .sort((a, b) => (a.seatedAt ?? '').localeCompare(b.seatedAt ?? '') || a.number - b.number)

export const getDaySummary = (state: AppState): DaySummary => {
  const parties = state.day.parties
  const waiting = getWaitingParties(state)
  return {
    waitingGroups: waiting.length,
    waitingPeople: waiting.reduce((sum, party) => sum + party.size, 0),
    calledGroups: parties.filter((party) => party.status === 'called').length,
    seatedGroups: parties.filter((party) => party.status === 'seated').length,
    servedPeople: parties
      .filter((party) => ['seated', 'left'].includes(party.status))
      .reduce((sum, party) => sum + party.size, 0),
    freeTables: state.tables.filter((table) => table.status === 'free').length,
    occupiedTables: state.tables.filter((table) => table.status === 'occupied').length,
    missedGroups: parties.filter((party) => party.status === 'missed').length,
    cancelledGroups: parties.filter((party) => party.status === 'cancelled').length,
  }
}

export interface TableView {
  table: RestaurantTable
  activeParties: Party[]
  usedSeats: number
  spareSeats: number
}

export const getTableViews = (state: AppState): TableView[] =>
  state.tables.map((table) => {
    const activeParties = getActiveTableParties(state, table)
    const usedSeats = getAssignedSeats(state, table)
    return {
      table,
      activeParties,
      usedSeats,
      spareSeats: table.seats - usedSeats,
    }
  })

export const getAheadCounts = (
  state: AppState,
  partyId: string,
): { groups: number; people: number } => {
  const waiting = getWaitingParties(state)
  const index = waiting.findIndex((party) => party.id === partyId)
  if (index <= 0) return { groups: 0, people: 0 }
  return {
    groups: index,
    people: waiting.slice(0, index).reduce((sum, party) => sum + party.size, 0),
  }
}

export const getLogsByType = (
  state: AppState,
  allowed: ActivityLog['type'][] | undefined,
): ActivityLog[] => {
  const logs = [...state.day.logs].sort((a, b) => b.time.localeCompare(a.time))
  return allowed ? logs.filter((log) => allowed.includes(log.type)) : logs
}
