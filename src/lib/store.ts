import { derived, get, writable } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import {
  addGuest,
  assignSeat,
  computeConflicts,
  computeStats,
  createState,
  emptySeatMap,
  removeGuest,
  resizeTables,
  setRelation,
  unseatGuest,
  updateGuest,
} from './seating';
import type { RelationKind } from './seating';
import type { Conflict, Guest, SeatingState, SeatingStats, SeatMap, TableSpec } from './types';

export const STATE_KEY = 'banquet-seating:state';
export const HISTORY_KEY = 'banquet-seating:history';
const HISTORY_LIMIT = 100;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** 校验并修复从本地存储读出的数据，损坏时返回 null。 */
export function normalizeState(raw: unknown): SeatingState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.guests) || !Array.isArray(s.tables) || !s.seats || typeof s.seats !== 'object') {
    return null;
  }
  const tables: TableSpec[] = [];
  for (const t of s.tables as unknown[]) {
    const tr = t as Record<string, unknown>;
    if (!tr || typeof tr.id !== 'string' || typeof tr.capacity !== 'number') return null;
    const capacity = Math.max(1, Math.floor(tr.capacity));
    tables.push({
      id: tr.id,
      name: typeof tr.name === 'string' ? tr.name : tr.id,
      capacity,
      accessibleSeats: Math.max(0, Math.min(Math.floor(Number(tr.accessibleSeats) || 0), capacity)),
    });
  }
  const guests: Guest[] = [];
  for (const g of s.guests as unknown[]) {
    const gr = g as Record<string, unknown>;
    if (!gr || typeof gr.id !== 'string' || typeof gr.name !== 'string') return null;
    guests.push({
      id: gr.id,
      name: gr.name,
      needsAccessible: Boolean(gr.needsAccessible),
      together: asStringArray(gr.together),
      avoid: asStringArray(gr.avoid),
    });
  }
  const guestIds = new Set(guests.map((g) => g.id));
  const seats: SeatMap = {};
  const used = new Set<string>();
  const rawSeats = s.seats as SeatMap;
  for (const t of tables) {
    const arr: (string | null)[] = Array<string | null>(t.capacity).fill(null);
    const rawArr = rawSeats[t.id];
    if (Array.isArray(rawArr)) {
      for (let i = 0; i < Math.min(rawArr.length, t.capacity); i += 1) {
        const v = rawArr[i];
        if (typeof v === 'string' && guestIds.has(v) && !used.has(v)) {
          arr[i] = v;
          used.add(v);
        }
      }
    }
    seats[t.id] = arr;
  }
  return { guests, tables, seats };
}

export function parseState(raw: string | null): SeatingState | null {
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseHistory(raw: string | null): SeatingState[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .map(normalizeState)
      .filter((s): s is SeatingState => s !== null)
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export interface SeatingStore {
  state: Writable<SeatingState>;
  canUndo: Readable<boolean>;
  conflicts: Readable<Conflict[]>;
  stats: Readable<SeatingStats>;
  commit: (mutate: (s: SeatingState) => SeatingState) => void;
  undo: () => void;
}

export function createSeatingStore(storage: StorageLike | null = browserStorage()): SeatingStore {
  const state = writable<SeatingState>((storage && parseState(storage.getItem(STATE_KEY))) || createState());
  const past = writable<SeatingState[]>((storage && parseHistory(storage.getItem(HISTORY_KEY))) || []);

  function persist(s: SeatingState, history: SeatingState[]): void {
    if (!storage) return;
    try {
      storage.setItem(STATE_KEY, JSON.stringify(s));
      storage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
    } catch {
      // 存储不可用（如隐私模式）时退化为纯内存状态。
    }
  }

  /** 所有会改动数据的操作都经过 commit：记录历史、持久化到 localStorage。 */
  function commit(mutate: (s: SeatingState) => SeatingState): void {
    const prev = get(state);
    const next = mutate(prev);
    if (next === prev) return;
    const history = [...get(past), prev].slice(-HISTORY_LIMIT);
    state.set(next);
    past.set(history);
    persist(next, history);
  }

  function undo(): void {
    const history = get(past);
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const rest = history.slice(0, -1);
    state.set(prev);
    past.set(rest);
    persist(prev, rest);
  }

  return {
    state,
    canUndo: derived(past, (p) => p.length > 0),
    conflicts: derived(state, (s) => computeConflicts(s)),
    stats: derived(state, (s) => computeStats(s)),
    commit,
    undo,
  };
}

const root = createSeatingStore();

export const seating = root.state;
export const canUndo = root.canUndo;
export const conflicts = root.conflicts;
export const stats = root.stats;
export const commit = root.commit;
export const undo = root.undo;

/** 当前在编辑器中选中的宾客。 */
export const selectedGuestId = writable<string | null>(null);

/** 轻量提示条。 */
export const toast = writable<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(message: string): void {
  toast.set(message);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(null), 2600);
}

// ---- 页面操作 ----

export function doAddGuest(name: string, needsAccessible: boolean): void {
  commit((s) => addGuest(s, name, { needsAccessible }));
}

export function doRemoveGuest(guestId: string): void {
  commit((s) => removeGuest(s, guestId));
  if (get(selectedGuestId) === guestId) selectedGuestId.set(null);
}

export function doUpdateGuest(
  guestId: string,
  patch: { name?: string; needsAccessible?: boolean },
): void {
  commit((s) => updateGuest(s, guestId, patch));
}

export function doSetRelation(aId: string, bId: string, kind: RelationKind, on: boolean): void {
  commit((s) => setRelation(s, aId, bId, kind, on));
}

export function doAssign(guestId: string, tableId: string, seatIndex: number): void {
  const result = assignSeat(get(seating), guestId, tableId, seatIndex);
  if (!result.ok) {
    showToast(result.reason ?? '无法安排该座位');
    return;
  }
  if (result.state !== get(seating)) commit(() => result.state);
}

export function doUnseat(guestId: string): void {
  commit((s) => unseatGuest(s, guestId));
}

export function applySettings(tableCount: number, seatsPerTable: number, accessiblePerTable: number): void {
  const before = get(seating);
  const next = resizeTables(before, tableCount, seatsPerTable, accessiblePerTable);
  if (next === before) return;
  const freed = computeStats(before).seatedCount - computeStats(next).seatedCount;
  commit(() => next);
  if (freed > 0) showToast(`桌位调整，${freed} 位宾客被移回未安排名单`);
}

export function doUnseatAll(): void {
  commit((s) => ({ ...s, seats: emptySeatMap(s.tables) }));
}

export function doResetAll(): void {
  const s = get(seating);
  const first = s.tables[0];
  commit(() => createState(s.tables.length, first?.capacity ?? 10, first?.accessibleSeats ?? 0));
  selectedGuestId.set(null);
}
