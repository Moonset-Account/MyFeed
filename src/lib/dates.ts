const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISODate(value);
  return !Number.isNaN(parsed.getTime()) && toISODateUtc(parsed) === value;
}

function toISODateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const result = new Date(parseISODate(isoDate).getTime() + days * DAY_IN_MS);
  return toISODateUtc(result);
}

export function diffDays(fromISODate: string, toISODate: string): number {
  const from = parseISODate(fromISODate).getTime();
  const to = parseISODate(toISODate).getTime();
  return Math.round((to - from) / DAY_IN_MS);
}

export function formatISODate(isoDate: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(parseISODate(isoDate));
}

export function relativeDayLabel(daysFromToday: number): string {
  if (daysFromToday > 0) return `逾期 ${daysFromToday} 天`;
  if (daysFromToday === 0) return '今天';
  if (daysFromToday === -1) return '明天';
  return `${Math.abs(daysFromToday)} 天后`;
}
