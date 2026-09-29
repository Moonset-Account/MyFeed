import { reactive, watch } from 'vue';
import type { AppState, Item, Member, Trip } from './types';
import { suggestItems, type ItemDraft } from './lib/templates';
import { duplicateTrip } from './lib/packing';

const STORAGE_KEY = 'trip-packing-state-v1';

export function createId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as AppState).trips)) {
        return parsed as AppState;
      }
    }
  } catch {
    // 本地数据损坏时回退到空状态
  }
  return { trips: [] };
}

/** 全局响应式状态，任何修改都会防抖写入 localStorage，刷新后保留进度 */
export const state = reactive<AppState>(loadState());

let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  state,
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // 存储配额不足时静默失败，不打断使用
      }
    }, 150);
  },
  { deep: true },
);

export function getTrip(id: string): Trip | undefined {
  return state.trips.find((trip) => trip.id === id);
}

function touch(trip: Trip): void {
  trip.updatedAt = Date.now();
}

export interface NewTripInput {
  name?: string;
  destination: string;
  days: number;
  members: { name: string; luggageLimitKg: number }[];
}

/** 按目的地与行程天数建立行程，并自动生成建议物品 */
export function createTrip(input: NewTripInput): Trip {
  const members: Member[] = input.members.map((m) => ({
    id: createId(),
    name: m.name,
    luggageLimitKg: m.luggageLimitKg,
  }));
  const items: Item[] = suggestItems(input.destination, input.days).map((d) => ({
    ...d,
    id: createId(),
  }));
  const now = Date.now();
  const trip: Trip = {
    id: createId(),
    name: input.name?.trim() || `${input.destination} ${input.days} 日游`,
    destination: input.destination.trim(),
    days: input.days,
    members,
    items,
    createdAt: now,
    updatedAt: now,
  };
  state.trips.unshift(trip);
  return trip;
}

export function deleteTrip(id: string): void {
  const index = state.trips.findIndex((trip) => trip.id === id);
  if (index !== -1) state.trips.splice(index, 1);
}

/** 复用历史清单：复制为新行程，打包进度清零 */
export function reuseTrip(id: string): Trip | undefined {
  const source = getTrip(id);
  if (!source) return undefined;
  const copy = duplicateTrip(source, createId, Date.now());
  state.trips.unshift(copy);
  return copy;
}

export function addItem(trip: Trip, draft: ItemDraft): Item {
  const item: Item = { ...draft, id: createId() };
  trip.items.push(item);
  touch(trip);
  return item;
}

export function removeItem(trip: Trip, itemId: string): void {
  const index = trip.items.findIndex((item) => item.id === itemId);
  if (index !== -1) {
    trip.items.splice(index, 1);
    touch(trip);
  }
}

export function addMember(trip: Trip, name: string, luggageLimitKg: number): Member {
  const member: Member = { id: createId(), name, luggageLimitKg };
  trip.members.push(member);
  touch(trip);
  return member;
}

/** 移除成员，其名下物品变为未分配 */
export function removeMember(trip: Trip, memberId: string): void {
  const index = trip.members.findIndex((m) => m.id === memberId);
  if (index === -1) return;
  trip.members.splice(index, 1);
  for (const item of trip.items) {
    if (item.assigneeId === memberId) item.assigneeId = null;
  }
  touch(trip);
}
