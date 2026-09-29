import { describe, expect, it } from 'vitest';
import { conflicts, isAccessibleSeat, tableGuests, unseated } from './rules';
import type { AppState, Guest } from './types';

function guest(partial: Partial<Guest> & { id: string; name: string }): Guest {
  return { needsAccessible: false, together: [], avoid: [], ...partial };
}

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    settings: { tableCount: 2, seatsPerTable: 4, accessiblePerTable: 1 },
    guests: [],
    assignments: {},
    ...overrides,
  };
}

describe('unseated / tableGuests', () => {
  it('区分已安排与未安排宾客', () => {
    const s = baseState({
      guests: [guest({ id: 'a', name: '甲' }), guest({ id: 'b', name: '乙' })],
      assignments: { a: { table: 0, seat: 0 } },
    });
    expect(unseated(s).map((g) => g.id)).toEqual(['b']);
    expect(tableGuests(s, 0)).toEqual(['a']);
    expect(tableGuests(s, 1)).toEqual([]);
  });
});

describe('conflicts', () => {
  it('无冲突时返回空数组', () => {
    const s = baseState({
      guests: [guest({ id: 'a', name: '甲' })],
      assignments: { a: { table: 0, seat: 0 } },
    });
    expect(conflicts(s)).toEqual([]);
  });

  it('座位超出桌数或座位数时报超员', () => {
    const s = baseState({
      guests: [guest({ id: 'a', name: '甲' }), guest({ id: 'b', name: '乙' })],
      assignments: { a: { table: 0, seat: 4 }, b: { table: 2, seat: 0 } },
    });
    const c = conflicts(s).filter((x) => x.type === 'overcapacity');
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.table).sort()).toEqual([0, 2]);
  });

  it('需避开的宾客同席时报冲突（关系双向生效）', () => {
    const s = baseState({
      guests: [
        guest({ id: 'a', name: '甲', avoid: ['b'] }),
        guest({ id: 'b', name: '乙' }),
      ],
      assignments: { a: { table: 0, seat: 0 }, b: { table: 0, seat: 1 } },
    });
    const c = conflicts(s).filter((x) => x.type === 'avoid');
    expect(c).toHaveLength(1);
    expect(c[0].guestIds.sort()).toEqual(['a', 'b']);
  });

  it('需避开的宾客分桌则无冲突', () => {
    const s = baseState({
      guests: [
        guest({ id: 'a', name: '甲', avoid: ['b'] }),
        guest({ id: 'b', name: '乙' }),
      ],
      assignments: { a: { table: 0, seat: 0 }, b: { table: 1, seat: 0 } },
    });
    expect(conflicts(s).filter((x) => x.type === 'avoid')).toEqual([]);
  });

  it('同行宾客分桌或仅一人入座时报冲突', () => {
    const guests = [
      guest({ id: 'a', name: '甲', together: ['b'] }),
      guest({ id: 'b', name: '乙' }),
    ];
    const apart = baseState({
      guests,
      assignments: { a: { table: 0, seat: 0 }, b: { table: 1, seat: 0 } },
    });
    expect(conflicts(apart).filter((x) => x.type === 'together')).toHaveLength(1);

    const oneSeated = baseState({ guests, assignments: { a: { table: 0, seat: 0 } } });
    expect(conflicts(oneSeated).filter((x) => x.type === 'together')).toHaveLength(1);

    const sameTable = baseState({
      guests,
      assignments: { a: { table: 0, seat: 0 }, b: { table: 0, seat: 1 } },
    });
    expect(conflicts(sameTable).filter((x) => x.type === 'together')).toEqual([]);

    const bothUnseated = baseState({ guests });
    expect(conflicts(bothUnseated).filter((x) => x.type === 'together')).toEqual([]);
  });

  it('同行关系不因重复记录而重复报冲突', () => {
    const s = baseState({
      guests: [
        guest({ id: 'a', name: '甲', together: ['b'] }),
        guest({ id: 'b', name: '乙', together: ['a'] }),
      ],
      assignments: { a: { table: 0, seat: 0 }, b: { table: 1, seat: 0 } },
    });
    expect(conflicts(s).filter((x) => x.type === 'together')).toHaveLength(1);
  });

  it('无障碍需求宾客坐在普通座位时报冲突', () => {
    const s = baseState({
      guests: [guest({ id: 'a', name: '甲', needsAccessible: true })],
      assignments: { a: { table: 0, seat: 2 } },
    });
    const c = conflicts(s).filter((x) => x.type === 'accessible');
    expect(c).toHaveLength(1);

    const ok = baseState({
      guests: [guest({ id: 'a', name: '甲', needsAccessible: true })],
      assignments: { a: { table: 0, seat: 0 } },
    });
    expect(conflicts(ok)).toEqual([]);
  });

  it('isAccessibleSeat 依据每桌无障碍座位数判断', () => {
    const s = baseState();
    expect(isAccessibleSeat(s, { table: 0, seat: 0 })).toBe(true);
    expect(isAccessibleSeat(s, { table: 0, seat: 1 })).toBe(false);
  });
});
