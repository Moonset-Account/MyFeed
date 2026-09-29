import type { AppData } from './types';
import { createEmptyData } from './care';
import { parseBackup } from './backup';

export const STORAGE_KEY = 'balcony-plant-care-calendar:v1';

export function loadData(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyData();
    return parseBackup(JSON.parse(raw));
  } catch (error) {
    console.warn('无法读取本地植物记录，已使用空数据。', error);
    return createEmptyData();
  }
}

export function saveData(data: AppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
