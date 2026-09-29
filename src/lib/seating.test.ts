import { describe, expect, it } from 'vitest';
import {
  addGuest,
  assignSeat,
  computeConflicts,
  computeStats,
  createState,
  removeGuest,
  resizeTables,
  seatLocationOf,
  setRelation,
  unseatGuest,
  updateGuest,
} from './seating';
import type { SeatingState } from './types';

function withGuests(state: SeatingState, names: string[]): SeatingState {
  return names.reduce((s, n) => addGuest(s, n), state);
}

function seat(state: SeatingState, name: string, tableId: string, seatIndex: number): SeatingState {
  const guest = state.guests.find((g) => g.name === name);
  if (!guest) throw new Error(`guest ${name} not found`);
  const result = assignSeat(state, guest.id, tableId, seatIndex);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('基础状态与宾客管理', () => {
  it('createState 生成指定桌数与座位数', () => {
    const s = createState(3, 8, 1);
    expect(s.tables).toHaveLength(3);
    expect(s.tables[0].capacity).toBe(8);
    expect(s.tables[0].accessibleSeats).toBe(1);
    expect(s.seats['table-1']).toHaveLength(8);
    expect(s.seats['table-1'].every((x) => x === null)).toBe(true);
  });

  it('addGuest 去除空白并拒绝空姓名', () => {
    let s = createState(1, 4, 0);
    s = addGuest(s, '  张三  ');
    expect(s.guests).toHaveLength(1);
    expect(s.guests[0].name).toBe('张三');
    expect(addGuest(s, '   ')).toBe(s);
  });

  it('updateGuest 可改名与切换无障碍需求', () => {
    let s = withGuests(createState(1, 4, 0), ['张三']);
    const id = s.guests[0].id;
    s = updateGuest(s, id, { name: '张三丰', needsAccessible: true });
    expect(s.guests[0].name).toBe('张三丰');
    expect(s.guests[0].needsAccessible).toBe(true);
  });

  it('removeGuest 同时移除座位与他人关系中的引用', () => {
    let s = withGuests(createState(1, 4, 0), ['甲', '乙']);
    const [a, b] = s.guests;
    s = setRelation(s, a.id, b.id, 'avoid', true);
    s = seat(s, '甲', 'table-1', 0);
    s = removeGuest(s, a.id);
    expect(s.guests).toHaveLength(1);
    expect(s.guests[0].avoid).toHaveLength(0);
    expect(s.seats['table-1'][0]).toBeNull();
  });
});

describe('入座与移出', () => {
  it('assignSeat 成功入座并更新统计', () => {
    let s = withGuests(createState(1, 4, 0), ['甲']);
    s = seat(s, '甲', 'table-1', 2);
    const stats = computeStats(s);
    expect(stats.seatedCount).toBe(1);
    expect(stats.unassignedCount).toBe(0);
    expect(seatLocationOf(s, s.guests[0].id)).toEqual({ tableId: 'table-1', seatIndex: 2 });
  });

  it('占用中的座位拒绝再次安排（防超员）', () => {
    let s = withGuests(createState(1, 4, 0), ['甲', '乙']);
    s = seat(s, '甲', 'table-1', 0);
    const result = assignSeat(s, s.guests[1].id, 'table-1', 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('占用');
    expect(result.state).toBe(s);
  });

  it('已入座宾客再次分配等于移动，旧座位被释放', () => {
    let s = withGuests(createState(2, 4, 0), ['甲']);
    s = seat(s, '甲', 'table-1', 0);
    s = seat(s, '甲', 'table-2', 3);
    expect(s.seats['table-1'][0]).toBeNull();
    expect(s.seats['table-2'][3]).toBe(s.guests[0].id);
    expect(computeStats(s).seatedCount).toBe(1);
  });

  it('unseatGuest 释放座位', () => {
    let s = withGuests(createState(1, 4, 0), ['甲']);
    s = seat(s, '甲', 'table-1', 1);
    s = unseatGuest(s, s.guests[0].id);
    expect(s.seats['table-1'][1]).toBeNull();
    expect(computeStats(s).seatedCount).toBe(0);
  });

  it('非法座位返回失败', () => {
    const s = withGuests(createState(1, 4, 0), ['甲']);
    expect(assignSeat(s, s.guests[0].id, 'table-1', 9).ok).toBe(false);
    expect(assignSeat(s, s.guests[0].id, 'table-x', 0).ok).toBe(false);
    expect(assignSeat(s, 'nobody', 'table-1', 0).ok).toBe(false);
  });
});

describe('关系设置', () => {
  it('同行关系对称写入双方', () => {
    let s = withGuests(createState(1, 4, 0), ['甲', '乙']);
    const [a, b] = s.guests;
    s = setRelation(s, a.id, b.id, 'together', true);
    expect(s.guests[0].together).toContain(b.id);
    expect(s.guests[1].together).toContain(a.id);
    s = setRelation(s, b.id, a.id, 'together', false);
    expect(s.guests[0].together).toHaveLength(0);
    expect(s.guests[1].together).toHaveLength(0);
  });

  it('同行与需避开互斥', () => {
    let s = withGuests(createState(1, 4, 0), ['甲', '乙']);
    const [a, b] = s.guests;
    s = setRelation(s, a.id, b.id, 'together', true);
    s = setRelation(s, a.id, b.id, 'avoid', true);
    expect(s.guests[0].avoid).toContain(b.id);
    expect(s.guests[0].together).toHaveLength(0);
    expect(s.guests[1].together).toHaveLength(0);
  });
});

describe('桌位调整', () => {
  it('扩大规模保留已入座宾客', () => {
    let s = withGuests(createState(1, 4, 0), ['甲']);
    s = seat(s, '甲', 'table-1', 0);
    s = resizeTables(s, 2, 6, 1);
    expect(s.tables).toHaveLength(2);
    expect(s.seats['table-1'][0]).toBe(s.guests[0].id);
    expect(s.seats['table-2']).toHaveLength(6);
  });

  it('缩小规模时被裁掉的宾客回到未安排名单', () => {
    let s = withGuests(createState(2, 4, 0), ['甲', '乙', '丙']);
    s = seat(s, '甲', 'table-1', 0);
    s = seat(s, '乙', 'table-1', 3);
    s = seat(s, '丙', 'table-2', 0);
    s = resizeTables(s, 1, 2, 0);
    const stats = computeStats(s);
    expect(stats.seatedCount).toBe(1);
    expect(stats.unassignedCount).toBe(2);
    expect(s.seats['table-1']).toHaveLength(2);
  });

  it('参数不变时返回原状态', () => {
    const s = createState(2, 4, 1);
    expect(resizeTables(s, 2, 4, 1)).toBe(s);
  });
});

describe('冲突检测', () => {
  it('宾客总数超过总座位数时报超员', () => {
    const s = withGuests(createState(1, 2, 0), ['甲', '乙', '丙']);
    const conflicts = computeConflicts(s);
    expect(conflicts.some((c) => c.type === 'capacity')).toBe(true);
  });

  it('需避开的宾客同桌时报冲突，分桌则无', () => {
    let s = withGuests(createState(2, 4, 0), ['甲', '乙']);
    const [a, b] = s.guests;
    s = setRelation(s, a.id, b.id, 'avoid', true);
    s = seat(s, '甲', 'table-1', 0);
    s = seat(s, '乙', 'table-1', 1);
    let conflicts = computeConflicts(s);
    expect(conflicts.filter((c) => c.type === 'avoid')).toHaveLength(1);
    expect(conflicts[0].guestIds).toContain(a.id);

    s = unseatGuest(s, b.id);
    s = seat(s, '乙', 'table-2', 0);
    conflicts = computeConflicts(s);
    expect(conflicts.filter((c) => c.type === 'avoid')).toHaveLength(0);
  });

  it('同行宾客被分到不同桌时报冲突（含传递成组）', () => {
    let s = withGuests(createState(3, 4, 0), ['甲', '乙', '丙']);
    const [a, b, c] = s.guests;
    s = setRelation(s, a.id, b.id, 'together', true);
    s = setRelation(s, b.id, c.id, 'together', true);
    s = seat(s, '甲', 'table-1', 0);
    s = seat(s, '乙', 'table-1', 1);
    s = seat(s, '丙', 'table-2', 0);
    const conflicts = computeConflicts(s);
    const together = conflicts.filter((x) => x.type === 'together');
    expect(together).toHaveLength(1);
    expect(together[0].guestIds).toHaveLength(3);

    s = unseatGuest(s, c.id);
    s = seat(s, '丙', 'table-1', 2);
    expect(computeConflicts(s).filter((x) => x.type === 'together')).toHaveLength(0);
  });

  it('需要无障碍座位的宾客坐到普通座位时报冲突', () => {
    let s = withGuests(createState(1, 4, 1), ['甲']);
    s = updateGuest(s, s.guests[0].id, { needsAccessible: true });
    s = seat(s, '甲', 'table-1', 3);
    let conflicts = computeConflicts(s);
    expect(conflicts.filter((c) => c.type === 'accessible')).toHaveLength(1);

    s = unseatGuest(s, s.guests[0].id);
    s = seat(s, '甲', 'table-1', 0);
    conflicts = computeConflicts(s);
    expect(conflicts.filter((c) => c.type === 'accessible')).toHaveLength(0);
  });

  it('全部安排合理时无冲突', () => {
    let s = withGuests(createState(2, 4, 1), ['甲', '乙', '丙']);
    const [a, b] = s.guests;
    s = setRelation(s, a.id, b.id, 'together', true);
    s = seat(s, '甲', 'table-1', 0);
    s = seat(s, '乙', 'table-1', 1);
    s = seat(s, '丙', 'table-2', 0);
    expect(computeConflicts(s)).toHaveLength(0);
  });
});
