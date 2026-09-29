import type { OrderStatus } from '../../shared/types';

export function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatAmount(amount: number, unit: string): string {
  const rounded = Math.round(amount * 10) / 10;
  const label = unit === 'pcs' ? '个' : unit;
  return `${rounded}${label}`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmed: '待取货',
  completed: '已完成',
  cancelled: '已取消',
};
