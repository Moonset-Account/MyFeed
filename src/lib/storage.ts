import type { AppState } from './types'
import { seedState } from './seed'

const STORAGE_KEY = 'campus-room-booking:v1'

/** 从 localStorage 读取；不存在或损坏时回退到演示数据 */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.bookings) && Array.isArray(parsed.maintenance)) {
        return parsed
      }
    }
  } catch {
    // 读取失败时按首次启动处理
  }
  return seedState()
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储被禁用或已满时静默失败，页面内数据仍可用
  }
}

export function resetState(): AppState {
  const fresh = seedState()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  } catch {
    // 同上
  }
  return fresh
}
