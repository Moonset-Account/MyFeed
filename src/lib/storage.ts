import type { InventoryState } from './types';

const KEY = 'donation-sorting-station/v1';

export function loadState(): InventoryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { batches: [], txns: [] };
    const parsed = JSON.parse(raw) as InventoryState;
    if (!Array.isArray(parsed.batches) || !Array.isArray(parsed.txns)) {
      return { batches: [], txns: [] };
    }
    return parsed;
  } catch {
    return { batches: [], txns: [] };
  }
}

export function saveState(state: InventoryState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
