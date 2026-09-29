import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addGuest,
  assign,
  history,
  removeGuest,
  resetAll,
  appState,
  unassign,
  undo,
  updateSettings,
} from './store';

beforeEach(() => {
  history.set([]);
  appState.set({
    settings: { tableCount: 2, seatsPerTable: 4, accessiblePerTable: 1 },
    guests: [],
    assignments: {},
  });
});

describe('store', () => {
  it('addGuest 追加宾客并去除首尾空白', () => {
    addGuest('  张三  ');
    expect(get(appState).guests).toHaveLength(1);
    expect(get(appState).guests[0].name).toBe('张三');
    addGuest('   ');
    expect(get(appState).guests).toHaveLength(1);
  });

  it('assign 入座，同一座位原有宾客被替换回未安排', () => {
    addGuest('甲');
    addGuest('乙');
    const [a, b] = get(appState).guests;
    assign(a.id, { table: 0, seat: 0 });
    assign(b.id, { table: 0, seat: 0 });
    const s = get(appState);
    expect(s.assignments[b.id]).toEqual({ table: 0, seat: 0 });
    expect(s.assignments[a.id]).toBeUndefined();
  });

  it('unassign 移除座位安排', () => {
    addGuest('甲');
    const [a] = get(appState).guests;
    assign(a.id, { table: 0, seat: 0 });
    unassign(a.id);
    expect(get(appState).assignments[a.id]).toBeUndefined();
  });

  it('removeGuest 同时清理座位与他人的关系引用', () => {
    addGuest('甲');
    addGuest('乙');
    const [a, b] = get(appState).guests;
    assign(a.id, { table: 0, seat: 0 });
    appState.update((s) => ({
      ...s,
      guests: s.guests.map((g) => (g.id === b.id ? { ...g, avoid: [a.id] } : g)),
    }));
    removeGuest(a.id);
    const s = get(appState);
    expect(s.guests).toHaveLength(1);
    expect(s.assignments[a.id]).toBeUndefined();
    expect(s.guests[0].avoid).toEqual([]);
  });

  it('undo 撤销上一步操作', () => {
    addGuest('甲');
    const [a] = get(appState).guests;
    assign(a.id, { table: 0, seat: 0 });
    undo();
    expect(get(appState).assignments[a.id]).toBeUndefined();
    undo();
    expect(get(appState).guests).toHaveLength(0);
    // 空历史上撤销不报错
    undo();
    expect(get(appState).guests).toHaveLength(0);
  });

  it('updateSettings 修改桌数配置且可撤销', () => {
    updateSettings({ tableCount: 8, seatsPerTable: 12, accessiblePerTable: 2 });
    expect(get(appState).settings.tableCount).toBe(8);
    undo();
    expect(get(appState).settings.tableCount).toBe(2);
  });

  it('resetAll 恢复默认状态', () => {
    addGuest('甲');
    resetAll();
    expect(get(appState).guests).toHaveLength(0);
    expect(get(appState).settings.tableCount).toBe(4);
  });
});
