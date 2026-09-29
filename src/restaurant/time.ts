const pad = (value: number): string => String(value).padStart(2, '0')

export const getDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const nowLocalDateTime = (date: Date = new Date()): string =>
  `${getDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

export const toDateTimeInputValue = (date: Date = new Date()): string =>
  `${getDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`

export const formatClock = (value: string): string => value.slice(11, 16)

export const formatDateCN = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export const minutesBetween = (from: string, to: string): number => {
  const fromTime = new Date(from).getTime()
  const toTime = new Date(to).getTime()
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return 0
  return Math.max(0, Math.round((toTime - fromTime) / 60000))
}
