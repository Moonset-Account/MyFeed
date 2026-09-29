import { describe, expect, it } from 'vitest';
import type { Item, Member, Trip } from '../types';
import {
  assignItem,
  duplicateTrip,
  filterItemsByMember,
  formatWeight,
  isMemberOverLimit,
  itemWeightGrams,
  memberLoadGrams,
  overLimitMembers,
  packingProgress,
  tripIssues,
  tripWeightGrams,
} from './packing';

let seq = 0;
const id = () => `t-${++seq}`;

function member(name: string, limitKg: number): Member {
  return { id: id(), name, luggageLimitKg: limitKg };
}

function item(partial: Partial<Item> & { name: string }): Item {
  return {
    id: id(),
    category: '杂物',
    quantity: 1,
    weightGrams: 100,
    shared: false,
    assigneeId: null,
    packed: false,
    ...partial,
  };
}

function trip(members: Member[], items: Item[]): Trip {
  return {
    id: id(),
    name: '测试行程',
    destination: '测试目的地',
    days: 3,
    members,
    items,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('重量计算', () => {
  it('物品重量 = 单件重量 × 数量', () => {
    expect(itemWeightGrams(item({ name: '袜子', quantity: 3, weightGrams: 60 }))).toBe(180);
  });

  it('成员负重只统计其名下的物品', () => {
    const a = member('甲', 20);
    const b = member('乙', 20);
    const t = trip(
      [a, b],
      [
        item({ name: '相机', weightGrams: 800, assigneeId: a.id }),
        item({ name: '衣物', quantity: 2, weightGrams: 350, assigneeId: a.id }),
        item({ name: '帐篷', weightGrams: 2500, assigneeId: b.id }),
        item({ name: '雨伞', weightGrams: 300 }),
      ],
    );
    expect(memberLoadGrams(t, a.id)).toBe(1500);
    expect(memberLoadGrams(t, b.id)).toBe(2500);
    expect(tripWeightGrams(t)).toBe(4300);
  });
});

describe('超重提醒', () => {
  it('超出行李箱预设重量时判定为超重', () => {
    const a = member('甲', 1); // 限重 1kg
    const b = member('乙', 10);
    const t = trip(
      [a, b],
      [
        item({ name: '帐篷', weightGrams: 2500, assigneeId: a.id, shared: true }),
        item({ name: '相机', weightGrams: 800, assigneeId: b.id }),
      ],
    );
    expect(isMemberOverLimit(t, a.id)).toBe(true);
    expect(isMemberOverLimit(t, b.id)).toBe(false);
    expect(overLimitMembers(t).map((m) => m.name)).toEqual(['甲']);
    expect(tripIssues(t).some((i) => i.kind === 'over-limit')).toBe(true);
  });

  it('恰好等于限重不算超重', () => {
    const a = member('甲', 2);
    const t = trip([a], [item({ name: '装备', weightGrams: 2000, assigneeId: a.id })]);
    expect(isMemberOverLimit(t, a.id)).toBe(false);
  });
});

describe('共享物品负责人', () => {
  it('重新指派共享物品会替换负责人，始终只有一名', () => {
    const a = member('甲', 20);
    const b = member('乙', 20);
    let shared = item({ name: '药箱', shared: true });
    shared = assignItem(shared, a.id);
    shared = assignItem(shared, b.id);
    const t = trip([a, b], [shared]);
    const owners = t.items.filter((i) => i.shared).map((i) => i.assigneeId);
    expect(owners).toEqual([b.id]);
    expect(memberLoadGrams(t, a.id)).toBe(0);
  });

  it('共享物品未指定负责人时产生提醒', () => {
    const a = member('甲', 20);
    const t = trip([a], [item({ name: '防晒霜', shared: true })]);
    const issues = tripIssues(t);
    expect(issues.some((i) => i.kind === 'shared-unassigned')).toBe(true);
    // 指定负责人后提醒消失
    t.items[0] = assignItem(t.items[0], a.id);
    expect(tripIssues(t).some((i) => i.kind === 'shared-unassigned')).toBe(false);
  });
});

describe('按人筛选', () => {
  it('支持全部 / 未分配 / 指定成员', () => {
    const a = member('甲', 20);
    const items = [
      item({ name: '相机', assigneeId: a.id }),
      item({ name: '雨伞' }),
      item({ name: '墨镜', assigneeId: a.id }),
    ];
    expect(filterItemsByMember(items, 'all')).toHaveLength(3);
    expect(filterItemsByMember(items, 'unassigned').map((i) => i.name)).toEqual(['雨伞']);
    expect(filterItemsByMember(items, a.id).map((i) => i.name)).toEqual(['相机', '墨镜']);
  });
});

describe('打包进度', () => {
  it('按已打包数量计算百分比', () => {
    const t = trip(
      [],
      [item({ name: 'a', packed: true }), item({ name: 'b', packed: true }), item({ name: 'c' })],
    );
    expect(packingProgress(t)).toEqual({ total: 3, packed: 2, percent: 67 });
  });

  it('空清单进度为 0', () => {
    expect(packingProgress(trip([], []))).toEqual({ total: 0, packed: 0, percent: 0 });
  });
});

describe('复用历史清单', () => {
  it('生成全新 id，保留携带人关系，打包进度清零', () => {
    const a = member('甲', 20);
    const source = trip(
      [a],
      [
        item({ name: '相机', assigneeId: a.id, packed: true }),
        item({ name: '药箱', shared: true, assigneeId: a.id, packed: true }),
        item({ name: '雨伞' }),
      ],
    );
    let n = 0;
    const copy = duplicateTrip(source, () => `new-${++n}`, 123);

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe(`${source.name}（副本）`);
    expect(copy.createdAt).toBe(123);
    expect(copy.members).toHaveLength(1);
    expect(copy.members[0].id).not.toBe(a.id);
    expect(copy.members[0].name).toBe('甲');
    // 携带人关系映射到新成员 id
    expect(copy.items[0].assigneeId).toBe(copy.members[0].id);
    expect(copy.items[1].assigneeId).toBe(copy.members[0].id);
    expect(copy.items[2].assigneeId).toBeNull();
    // 进度清零
    expect(copy.items.every((i) => !i.packed)).toBe(true);
    expect(packingProgress(copy).packed).toBe(0);
    // 原清单不受影响
    expect(source.items[0].packed).toBe(true);
  });
});

describe('重量格式化', () => {
  it('小于 1kg 显示克，否则显示千克', () => {
    expect(formatWeight(800)).toBe('800 g');
    expect(formatWeight(1500)).toBe('1.5 kg');
    expect(formatWeight(2000)).toBe('2 kg');
  });
});
