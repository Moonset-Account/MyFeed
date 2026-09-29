import { writable } from 'svelte/store';
import type { AppState } from './types';
import { emptyState, seedState } from './logic';

const STORAGE_KEY = 'camping-gear-checklist:v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...emptyState(),
      ...parsed,
      gear: parsed.gear ?? [],
      trips: parsed.trips ?? [],
      templates: parsed.templates ?? [],
      repairs: parsed.repairs ?? [],
    };
  } catch {
    return seedState();
  }
}

function createStore() {
  const initial = typeof localStorage === 'undefined' ? emptyState() : load();
  const { subscribe, set, update } = writable<AppState>(initial);

  if (typeof localStorage !== 'undefined') {
    subscribe((state) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // 存储失败（如隐私模式）时保持内存态
      }
    });
  }

  return {
    subscribe,
    update,
    set,
    reset: () => set(seedState()),
  };
}

export const appState = createStore();
