import { computed, reactive, watch } from 'vue'
import type { AppState, Trip } from './types'
import {
  cloneTripAsNew,
  createEmptyState,
  deserializeState,
  serializeState,
  STORAGE_KEY,
} from './logic'

function loadInitialState(): AppState {
  if (typeof localStorage === 'undefined') return createEmptyState()
  try {
    return deserializeState(localStorage.getItem(STORAGE_KEY)) ?? createEmptyState()
  } catch {
    return createEmptyState()
  }
}

export const state = reactive<AppState>(loadInitialState())

// 任意状态变化后自动持久化，刷新页面后保留进度
watch(
  state,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(value))
    } catch {
      // 存储不可用（如隐私模式）时静默降级为内存态
    }
  },
  { deep: true },
)

export const activeTrip = computed<Trip | null>(
  () => state.trips.find((t) => t.id === state.activeTripId) ?? null,
)

export function setActiveTrip(id: string | null): void {
  state.activeTripId = id
}

export function addTrip(trip: Trip): void {
  state.trips.push(trip)
  state.activeTripId = trip.id
}

export function removeTrip(id: string): void {
  const idx = state.trips.findIndex((t) => t.id === id)
  if (idx >= 0) state.trips.splice(idx, 1)
  if (state.activeTripId === id) {
    state.activeTripId = state.trips[0]?.id ?? null
  }
}

/** 复用历史清单：以某次行程为模板复制出新行程并切换过去 */
export function reuseTrip(sourceId: string, destination?: string, days?: number): Trip | null {
  const source = state.trips.find((t) => t.id === sourceId)
  if (!source) return null
  const copy = cloneTripAsNew(source, destination, days)
  addTrip(copy)
  return copy
}
