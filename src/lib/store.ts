import { reactive, watch } from 'vue'
import {
  createInitialState,
  todayString,
  clearDay,
  type State
} from './core'

const STORAGE_KEY = 'restaurant-waitlist-v1'

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (parsed && Array.isArray(parsed.tableTypes) && Array.isArray(parsed.parties)) {
        // 跨天自动清空候位数据，保留桌型配置
        if (parsed.date !== todayString()) {
          const fresh = createInitialState()
          fresh.tableTypes = parsed.tableTypes
          return fresh
        }
        return parsed
      }
    }
  } catch {
    // 本地数据损坏时回退到初始状态
  }
  return createInitialState()
}

export const state = reactive<State>(load())

watch(
  state,
  (s) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      // 存储不可用时静默失败（演示环境）
    }
  },
  { deep: true }
)

export function resetDay(): void {
  clearDay(state, Date.now())
}
