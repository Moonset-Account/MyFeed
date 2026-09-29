import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { addGuest, assignSeat } from './seating';
import {
  createSeatingStore,
  HISTORY_KEY,
  parseHistory,
  parseState,
  STATE_KEY,
} from './store';
import type { StorageLike } from './store';

class FakeStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('本地持久化', () => {
  it('commit 后写入 localStorage，新会话可恢复', () => {
    const storage = new FakeStorage();
    const store = createSeatingStore(storage);
    store.commit((s) => addGuest(s, '张三'));

    const raw = storage.getItem(STATE_KEY);
    expect(raw).toBeTruthy();
    expect(parseState(raw)?.guests.map((g) => g.name)).toEqual(['张三']);

    const restored = createSeatingStore(storage);
    expect(get(restored.state).guests.map((g) => g.name)).toEqual(['张三']);
  });

  it('损坏的存储内容回退到初始状态', () => {
    const storage = new FakeStorage();
    storage.setItem(STATE_KEY, '{not json');
    storage.setItem(HISTORY_KEY, '[1,2');
    const store = createSeatingStore(storage);
    expect(get(store.state).guests).toHaveLength(0);
    expect(get(store.canUndo)).toBe(false);
  });

  it('normalize 会修复座位表中的无效引用', () => {
    const storage = new FakeStorage();
    storage.setItem(
      STATE_KEY,
      JSON.stringify({
        guests: [],
        tables: [{ id: 'table-1', name: '1 号桌', capacity: 2, accessibleSeats: 0 }],
        seats: { 'table-1': ['ghost', null] },
      }),
    );
    const store = createSeatingStore(storage);
    expect(get(store.state).seats['table-1']).toEqual([null, null]);
  });
});

describe('撤销', () => {
  it('undo 恢复上一步并同步持久化', () => {
    const storage = new FakeStorage();
    const store = createSeatingStore(storage);

    store.commit((s) => addGuest(s, '甲'));
    store.commit((s) => addGuest(s, '乙'));
    expect(get(store.state).guests).toHaveLength(2);
    expect(get(store.canUndo)).toBe(true);

    store.undo();
    expect(get(store.state).guests.map((g) => g.name)).toEqual(['甲']);

    store.undo();
    expect(get(store.state).guests).toHaveLength(0);
    expect(get(store.canUndo)).toBe(false);

    store.undo(); // 空历史上撤销应为无操作
    expect(get(store.state).guests).toHaveLength(0);

    const persisted = parseState(storage.getItem(STATE_KEY));
    expect(persisted?.guests).toHaveLength(0);
  });

  it('历史随会话持久化，刷新后仍可撤销', () => {
    const storage = new FakeStorage();
    const store = createSeatingStore(storage);
    store.commit((s) => addGuest(s, '甲'));

    const restored = createSeatingStore(storage);
    expect(get(restored.canUndo)).toBe(true);
    restored.undo();
    expect(get(restored.state).guests).toHaveLength(0);
  });

  it('无实际变化的 commit 不产生历史', () => {
    const storage = new FakeStorage();
    const store = createSeatingStore(storage);
    store.commit((s) => s);
    expect(get(store.canUndo)).toBe(false);
  });

  it('连续操作可逐步撤销到最初', () => {
    const storage = new FakeStorage();
    const store = createSeatingStore(storage);
    store.commit((s) => addGuest(s, '甲'));
    const guestId = get(store.state).guests[0].id;
    store.commit((s) => assignSeat(s, guestId, 'table-1', 0).state);
    expect(get(store.state).seats['table-1'][0]).toBe(guestId);

    store.undo();
    expect(get(store.state).seats['table-1'][0]).toBeNull();
    expect(get(store.state).guests).toHaveLength(1);

    store.undo();
    expect(get(store.state).guests).toHaveLength(0);
  });
});

describe('派生数据', () => {
  it('conflicts 与 stats 随状态即时更新', () => {
    const store = createSeatingStore(null);
    store.commit((s) => addGuest(s, '甲'));
    store.commit((s) => addGuest(s, '乙'));
    store.commit((s) => addGuest(s, '丙'));
    // 默认 6 桌 60 座，无超员；缩到 1 桌 2 座后超员 1 人。
    store.commit((s) => ({
      ...s,
      tables: [{ id: 'table-1', name: '1 号桌', capacity: 2, accessibleSeats: 0 }],
      seats: { 'table-1': [null, null] },
    }));
    expect(get(store.stats).overCapacityBy).toBe(1);
    expect(get(store.conflicts).some((c) => c.type === 'capacity')).toBe(true);
  });
});
