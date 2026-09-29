import type { CareEvent, CareType, Plant, Postponement } from './types';

/** 以本地时区格式化 Date 为 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** a 比 b 晚几天（可为负） */
export function diffDays(a: string, b: string): number {
  const ms = new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

/** 某植物某类养护的最近一次实际日期；没有记录时回退到植物建档日期 */
export function lastCareDate(
  plant: Plant,
  events: CareEvent[],
  type: CareType
): string {
  let last: string | null = null;
  for (const e of events) {
    if (e.plantId === plant.id && e.type === type && (last === null || e.date > last)) {
      last = e.date;
    }
  }
  return last ?? plant.createdAt;
}

/**
 * 当前浇水周期内有效的顺延天数。
 * 只统计上次实际浇水之后创建的顺延；浇水完成后旧顺延自然失效。
 */
export function activePostponedDays(
  plant: Plant,
  events: CareEvent[],
  postponements: Postponement[]
): number {
  const lastWater = lastCareDate(plant, events, 'water');
  return postponements
    .filter((p) => p.plantId === plant.id && p.createdAt >= lastWater)
    .reduce((sum, p) => sum + p.days, 0);
}

export type TodoStatus = 'overdue' | 'today' | 'upcoming';

export interface TodoItem {
  plantId: string;
  plantName: string;
  plantIcon: string;
  type: 'water' | 'fertilize';
  dueDate: string;
  status: TodoStatus;
  /** 距到期天数；负数表示已逾期 */
  daysUntil: number;
  /** 本周期累计顺延天数（仅浇水） */
  postponedDays: number;
}

function makeTodo(
  plant: Plant,
  type: 'water' | 'fertilize',
  dueDate: string,
  today: string,
  postponedDays: number
): TodoItem {
  const daysUntil = diffDays(dueDate, today);
  const status: TodoStatus = daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming';
  return {
    plantId: plant.id,
    plantName: plant.name,
    plantIcon: plant.icon,
    type,
    dueDate,
    status,
    daysUntil,
    postponedDays
  };
}

/** 浇水到期日 = 上次实际浇水 + 间隔 + 本周期顺延天数 */
export function waterDueDate(
  plant: Plant,
  events: CareEvent[],
  postponements: Postponement[]
): string {
  const base = addDays(lastCareDate(plant, events, 'water'), plant.waterIntervalDays);
  return addDays(base, activePostponedDays(plant, events, postponements));
}

/** 由上次实际养护日期生成全部待办，按紧迫程度排序 */
export function computeTodos(
  plants: Plant[],
  events: CareEvent[],
  postponements: Postponement[],
  today: string
): TodoItem[] {
  const todos: TodoItem[] = [];
  for (const plant of plants) {
    const postponed = activePostponedDays(plant, events, postponements);
    todos.push(makeTodo(plant, 'water', waterDueDate(plant, events, postponements), today, postponed));
    if (plant.fertilizeIntervalDays !== null && plant.fertilizeIntervalDays > 0) {
      const due = addDays(lastCareDate(plant, events, 'fertilize'), plant.fertilizeIntervalDays);
      todos.push(makeTodo(plant, 'fertilize', due, today, 0));
    }
  }
  return todos.sort((a, b) => a.daysUntil - b.daysUntil);
}
