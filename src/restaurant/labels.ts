import type { LogType, PartyStatus } from './types'

export const partyStatusLabels: Record<PartyStatus, string> = {
  waiting: '候位中',
  called: '已叫号',
  seated: '已入座',
  missed: '过号',
  cancelled: '已取消',
  left: '已离店',
}

export const logTypeLabels: Record<LogType, string> = {
  registered: '登记',
  called: '叫号',
  seated: '入座',
  missed: '过号',
  cancelled: '取消',
  left: '离店',
  shared: '拼桌',
  cleared: '清空',
}
