import type { AppData, Gear, RepairTodo, ReturnItem, Trip } from './types';
import { defaultData } from './inventory';

export const STORAGE_KEY = 'camping-kit-checkbook:v1';

function cloneDefaultData(): AppData {
  return defaultData();
}

export function loadData(): AppData {
  if (typeof localStorage === 'undefined') return cloneDefaultData();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      gears: Array.isArray(parsed.gears) ? (parsed.gears as Gear[]) : cloneDefaultData().gears,
      trips: Array.isArray(parsed.trips) ? (parsed.trips as Trip[]) : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : cloneDefaultData().templates,
      repairTodos: Array.isArray(parsed.repairTodos) ? (parsed.repairTodos as RepairTodo[]) : []
    };
  } catch {
    return cloneDefaultData();
  }
}

export function saveData(data: AppData): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createEmptyReturnItem(): ReturnItem {
  return {
    gearId: '',
    expected: 0,
    returned: 0,
    damaged: 0,
    uncharged: 0,
    checked: false
  };
}
