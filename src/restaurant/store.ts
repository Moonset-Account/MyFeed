import { computed, ref } from 'vue'
import type { AppState, RegisterInput } from './types'
import { createInitialState } from './logic'
import {
  callParty,
  cancelParty,
  clearDay,
  leaveParty,
  markPartyMissed,
  registerParty,
  seatParty,
  startDayIfNeeded,
} from './operations'
import { getCallSuggestions } from './operations'
import { addTableType, deleteTableType, updateTableType } from './logic'
import { getDateKey, nowLocalDateTime } from './time'

const STORAGE_KEY = 'restaurant-waitlist-state-v1'

const validateState = (value: unknown): value is AppState => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppState>
  return (
    Array.isArray(candidate.tableTypes) &&
    Array.isArray(candidate.tables) &&
    Boolean(candidate.day && Array.isArray(candidate.day.parties) && Array.isArray(candidate.day.logs))
  )
}

const loadState = (): AppState => {
  const today = getDateKey()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState(today)
    const parsed = JSON.parse(raw) as unknown
    if (!validateState(parsed)) return createInitialState(today)
    return startDayIfNeeded(parsed, today)
  } catch {
    return createInitialState(today)
  }
}

const stateRef = ref<AppState>(loadState())
const errorRef = ref('')

const persist = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.value))
    errorRef.value = ''
  } catch {
    errorRef.value = '浏览器存储不可用，当前操作可能无法在刷新后保留'
  }
}

const mutate = (action: () => AppState): void => {
  try {
    stateRef.value = action()
    persist()
  } catch (error) {
    errorRef.value = error instanceof Error ? error.message : '操作失败'
  }
}

export const useWaitlistStore = () => {
  const ensureToday = (): void => {
    const today = getDateKey()
    if (stateRef.value.day.dateKey !== today) {
      mutate(() => startDayIfNeeded(stateRef.value, today, nowLocalDateTime()))
    }
  }

  return {
    state: stateRef,
    error: errorRef,
    summary: computed(() => stateRef.value),
    suggestions: computed(() => getCallSuggestions(stateRef.value)),
    ensureToday,
    dismissError: () => {
      errorRef.value = ''
    },
    register: (input: RegisterInput) =>
      mutate(() => registerParty(stateRef.value, input, nowLocalDateTime())),
    call: (partyId: string, tableId: string, kind: 'direct' | 'shared') =>
      mutate(() => callParty(stateRef.value, partyId, tableId, kind, nowLocalDateTime())),
    seat: (partyId: string) =>
      mutate(() => seatParty(stateRef.value, partyId, nowLocalDateTime())),
    miss: (partyId: string) =>
      mutate(() => markPartyMissed(stateRef.value, partyId, nowLocalDateTime())),
    cancel: (partyId: string) =>
      mutate(() => cancelParty(stateRef.value, partyId, nowLocalDateTime())),
    leave: (partyId: string) =>
      mutate(() => leaveParty(stateRef.value, partyId, nowLocalDateTime())),
    clearDay: () =>
      mutate(() => clearDay(stateRef.value, nowLocalDateTime(), getDateKey())),
    addTableType: (input: { name: string; seats: number; count: number }) =>
      mutate(() => addTableType(stateRef.value, input)),
    updateTableType: (
      typeId: string,
      input: { name: string; seats: number; count: number },
    ) => mutate(() => updateTableType(stateRef.value, typeId, input)),
    deleteTableType: (typeId: string) =>
      mutate(() => deleteTableType(stateRef.value, typeId)),
  }
}
