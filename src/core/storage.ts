import type { ExpenseState } from '../types';
import { createSampleState } from './sampleData';

export const STORAGE_KEY = 'shared-expenses-book-v1';

export function loadState(): ExpenseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleState();
    const parsed = JSON.parse(raw) as ExpenseState;
    if (parsed.version !== 1 || !Array.isArray(parsed.people) || !Array.isArray(parsed.bills) || !Array.isArray(parsed.payments)) {
      return createSampleState();
    }
    return { ...parsed, settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [] };
  } catch {
    return createSampleState();
  }
}

export function saveState(state: ExpenseState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
