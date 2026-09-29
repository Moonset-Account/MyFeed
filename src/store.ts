import { reactive, watch } from 'vue'
import type { AppState } from './lib/types'
import { loadState, resetState, saveState } from './lib/storage'
import { toLocalISO } from './lib/datetime'

/** 全局响应式状态，任何变动自动写入 localStorage */
export const store = reactive(loadState()) as AppState

watch(
  store,
  () => {
    saveState(store)
  },
  { deep: true },
)

export function resetDemo(): void {
  const fresh = resetState()
  store.rooms = fresh.rooms
  store.maintenance = fresh.maintenance
  store.bookings = fresh.bookings
}

export function nowISO(): string {
  return toLocalISO(new Date())
}
