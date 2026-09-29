import type { Item, Member, Trip } from '../types';

/** 物品总重（克）= 单件重量 × 数量 */
export function itemWeightGrams(item: Item): number {
  return item.weightGrams * item.quantity;
}

/** 整个行程的物品总重（克） */
export function tripWeightGrams(trip: Trip): number {
  return trip.items.reduce((sum, item) => sum + itemWeightGrams(item), 0);
}

/** 某位成员名下物品的负重（克） */
export function memberLoadGrams(trip: Trip, memberId: string): number {
  return trip.items
    .filter((item) => item.assigneeId === memberId)
    .reduce((sum, item) => sum + itemWeightGrams(item), 0);
}

/** 成员行李箱预设限重（克） */
export function memberLimitGrams(member: Member): number {
  return Math.round(member.luggageLimitKg * 1000);
}

/** 成员负重是否超出行李箱预设重量 */
export function isMemberOverLimit(trip: Trip, memberId: string): boolean {
  const member = trip.members.find((m) => m.id === memberId);
  if (!member) return false;
  return memberLoadGrams(trip, memberId) > memberLimitGrams(member);
}

/** 所有超重的成员 */
export function overLimitMembers(trip: Trip): Member[] {
  return trip.members.filter((m) => isMemberOverLimit(trip, m.id));
}

export interface PackingProgress {
  total: number;
  packed: number;
  /** 0-100 的整数百分比，无物品时为 0 */
  percent: number;
}

export function packingProgress(trip: Trip): PackingProgress {
  const total = trip.items.length;
  const packed = trip.items.filter((item) => item.packed).length;
  return {
    total,
    packed,
    percent: total === 0 ? 0 : Math.round((packed / total) * 100),
  };
}

/** 'all' 全部；'unassigned' 未分配；其余为成员 id */
export type MemberFilter = 'all' | 'unassigned' | (string & {});

export function filterItemsByMember(items: Item[], filter: MemberFilter): Item[] {
  if (filter === 'all') return items;
  if (filter === 'unassigned') return items.filter((item) => item.assigneeId === null);
  return items.filter((item) => item.assigneeId === filter);
}

/**
 * 为物品指定携带人。
 * 共享物品也只能有一名负责人：重新指派会替换原负责人，而不是叠加。
 */
export function assignItem(item: Item, memberId: string | null): Item {
  return { ...item, assigneeId: memberId };
}

export interface TripIssue {
  kind: 'over-limit' | 'shared-unassigned';
  message: string;
}

/** 行程当前需要提醒的问题：成员超重、共享物品缺少负责人 */
export function tripIssues(trip: Trip): TripIssue[] {
  const issues: TripIssue[] = [];
  for (const member of overLimitMembers(trip)) {
    issues.push({
      kind: 'over-limit',
      message: `${member.name} 的行李已超出行李箱限重（${formatWeight(memberLoadGrams(trip, member.id))} / ${member.luggageLimitKg} kg）`,
    });
  }
  for (const item of trip.items) {
    if (item.shared && item.assigneeId === null) {
      issues.push({
        kind: 'shared-unassigned',
        message: `共享物品「${item.name}」需要指定一名负责人`,
      });
    }
  }
  return issues;
}

/** 克数格式化：小于 1kg 显示克，否则显示千克（最多两位小数） */
export function formatWeight(grams: number): string {
  if (Math.abs(grams) < 1000) return `${Math.round(grams)} g`;
  const kg = grams / 1000;
  return `${Number(kg.toFixed(2))} kg`;
}

/**
 * 复用历史清单：生成一份全新行程，所有 id 重新生成，
 * 携带人关系保留，打包进度清零。
 */
export function duplicateTrip(trip: Trip, createId: () => string, now: number): Trip {
  const memberIdMap = new Map<string, string>();
  const members = trip.members.map((member) => {
    const id = createId();
    memberIdMap.set(member.id, id);
    return { ...member, id };
  });
  const items = trip.items.map((item) => ({
    ...item,
    id: createId(),
    assigneeId: item.assigneeId === null ? null : (memberIdMap.get(item.assigneeId) ?? null),
    packed: false,
  }));
  return {
    ...trip,
    id: createId(),
    name: `${trip.name}（副本）`,
    members,
    items,
    createdAt: now,
    updatedAt: now,
  };
}
