import { get, writable } from 'svelte/store';
import type { AppState, Guest, SeatRef, Settings } from './types';

const STORAGE_KEY = 'banquet-seating-v1';
const HISTORY_LIMIT = 100;

const defaultState: AppState = {
  settings: { tableCount: 4, seatsPerTable: 10, accessiblePerTable: 2 },
  guests: [],
  assignments: {},
};

function load(): AppState {
  try {
    if (typeof localStorage === 'undefined') return defaultState;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.settings || !Array.isArray(parsed.guests) || !parsed.assignments) {
      return defaultState;
    }
    return parsed;
  } catch {
    return defaultState;
  }
}

function persist(s: AppState) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
  } catch {
    // 存储不可用时静默失败，应用仍可正常使用
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const appState = writable<AppState>(load());
export const history = writable<AppState[]>([]);

appState.subscribe(persist);

/** 所有会修改状态的操作都经过 commit，以便支持撤销 */
function commit(mutate: (s: AppState) => AppState) {
  const prev = get(appState);
  history.update((h) => [...h.slice(-(HISTORY_LIMIT - 1)), prev]);
  appState.update(mutate);
}

export function undo(): void {
  const h = get(history);
  if (h.length === 0) return;
  appState.set(h[h.length - 1]);
  history.set(h.slice(0, -1));
}

export function updateSettings(settings: Settings): void {
  commit((s) => ({ ...s, settings }));
}

export function addGuest(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  commit((s) => ({
    ...s,
    guests: [
      ...s.guests,
      { id: newId(), name: trimmed, needsAccessible: false, together: [], avoid: [] },
    ],
  }));
}

export function removeGuest(id: string): void {
  commit((s) => {
    const assignments = { ...s.assignments };
    delete assignments[id];
    return {
      ...s,
      guests: s.guests
        .filter((g) => g.id !== id)
        .map((g) => ({
          ...g,
          together: g.together.filter((x) => x !== id),
          avoid: g.avoid.filter((x) => x !== id),
        })),
      assignments,
    };
  });
}

export function updateGuest(id: string, patch: Partial<Omit<Guest, 'id'>>): void {
  commit((s) => ({
    ...s,
    guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  }));
}

export function assign(guestId: string, seat: SeatRef): void {
  commit((s) => {
    const assignments = { ...s.assignments };
    // 同一座位已有他人时，原宾客回到未安排
    for (const [id, ref] of Object.entries(assignments)) {
      if (ref.table === seat.table && ref.seat === seat.seat && id !== guestId) {
        delete assignments[id];
      }
    }
    assignments[guestId] = seat;
    return { ...s, assignments };
  });
}

export function unassign(guestId: string): void {
  commit((s) => {
    if (!s.assignments[guestId]) return s;
    const assignments = { ...s.assignments };
    delete assignments[guestId];
    return { ...s, assignments };
  });
}

export function resetAll(): void {
  commit(() => defaultState);
}
