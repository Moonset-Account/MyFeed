import type {
  Allocation,
  AllocationIssue,
  AppData,
  Gear,
  GearCategory,
  RepairTodo,
  ReturnItem,
  ReturnSummary,
  Template,
  Trip
} from './types';

export const categories: GearCategory[] = ['帐篷', '炉具', '照明', '睡眠', '炊具', '工具', '其他'];

export function toCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function createId(prefix = 'id'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

export function normalizeGear(gear: Gear): Gear {
  const total = toCount(gear.total);
  const damaged = Math.min(toCount(gear.damaged), total);
  const uncharged = gear.usesBatteries
    ? Math.min(toCount(gear.uncharged), total - damaged)
    : 0;

  return {
    ...gear,
    name: gear.name.trim() || '未命名装备',
    category: gear.category,
    total,
    damaged,
    uncharged,
    usesBatteries: Boolean(gear.usesBatteries),
    notes: gear.notes.trim()
  };
}

export function readyCount(gear: Gear): number {
  return Math.max(0, gear.total - gear.damaged);
}

export function chargedCount(gear: Gear): number {
  return Math.max(0, readyCount(gear) - gear.uncharged);
}

export function normalizeAllocation(gear: Gear, allocation: Allocation): Allocation {
  const quantity = Math.min(toCount(allocation.quantity), 999);
  const charged = gear.usesBatteries
    ? Math.min(toCount(allocation.charged), quantity, chargedCount(gear))
    : 0;
  return { gearId: gear.id, quantity, charged };
}

export function evaluateAllocation(gear: Gear, allocation: Allocation): AllocationIssue {
  const quantity = toCount(allocation.quantity);
  const healthy = readyCount(gear);
  const shortage = Math.max(0, quantity - gear.total);
  const damaged = Math.min(Math.max(0, quantity - healthy), gear.damaged);
  const plannedHealthy = Math.min(quantity, healthy);
  const charged = gear.usesBatteries
    ? Math.min(toCount(allocation.charged), chargedCount(gear), plannedHealthy)
    : plannedHealthy;
  const uncharged = Math.max(0, plannedHealthy - charged);

  return {
    gearId: gear.id,
    name: gear.name,
    shortage,
    damaged,
    uncharged
  };
}

export function evaluateTrip(gears: Gear[], allocations: Allocation[]): AllocationIssue[] {
  const byId = new Map(gears.map((gear) => [gear.id, gear]));

  return allocations
    .filter((allocation) => allocation.quantity > 0 && byId.has(allocation.gearId))
    .map((allocation) => evaluateAllocation(byId.get(allocation.gearId)!, allocation))
    .filter((issue) => issue.shortage > 0 || issue.damaged > 0 || issue.uncharged > 0);
}

export function departWithGear(gear: Gear, allocation: Allocation): Gear {
  const quantity = Math.min(toCount(allocation.quantity), gear.total);
  const healthy = readyCount(gear);
  const damagedTaken = Math.min(Math.max(0, quantity - healthy), gear.damaged);
  const healthyTaken = quantity - damagedTaken;
  const chargedTaken = gear.usesBatteries
    ? Math.min(toCount(allocation.charged), chargedCount(gear), healthyTaken)
    : healthyTaken;
  const unchargedTaken = healthyTaken - chargedTaken;

  return normalizeGear({
    ...gear,
    total: gear.total - quantity,
    damaged: gear.damaged - damagedTaken,
    uncharged: gear.uncharged - unchargedTaken
  });
}

export function createReturnItem(gear: Gear, allocation: Allocation): ReturnItem {
  const expected = Math.min(toCount(allocation.quantity), 999);
  const damagedTaken = Math.min(Math.max(0, expected - readyCount(gear)), gear.damaged, expected);
  const healthyTaken = expected - damagedTaken;
  const chargedTaken = gear.usesBatteries
    ? Math.min(toCount(allocation.charged), chargedCount(gear), healthyTaken)
    : healthyTaken;

  return {
    gearId: gear.id,
    expected,
    returned: expected,
    damaged: damagedTaken,
    uncharged: gear.usesBatteries ? healthyTaken - chargedTaken : 0,
    checked: false,
    preexistingDamaged: damagedTaken
  };
}

export function normalizeReturnItem(gear: Gear, item: ReturnItem): ReturnItem {
  const expected = toCount(item.expected);
  const returned = Math.min(toCount(item.returned), expected);
  const damaged = Math.min(toCount(item.damaged), returned);
  const uncharged = gear.usesBatteries
    ? Math.min(toCount(item.uncharged), returned - damaged)
    : 0;
  return { ...item, expected, returned, damaged, uncharged };
}

export function returnGear(gear: Gear, item: ReturnItem): Gear {
  const returned = Math.min(toCount(item.returned), toCount(item.expected));
  const damaged = Math.min(toCount(item.damaged), returned);
  const uncharged = gear.usesBatteries
    ? Math.min(toCount(item.uncharged), returned - damaged)
    : 0;

  return normalizeGear({
    ...gear,
    total: gear.total + returned,
    damaged: gear.damaged + damaged,
    uncharged: gear.uncharged + uncharged
  });
}

export function summarizeReturn(items: ReturnItem[]): ReturnSummary {
  return items.reduce(
    (summary, item) => {
      if (!item.checked) return summary;
      summary.returned += item.returned;
      summary.missing += Math.max(0, item.expected - item.returned);
      summary.damaged += item.damaged;
      summary.uncharged += item.uncharged;
      return summary;
    },
    { returned: 0, missing: 0, damaged: 0, uncharged: 0 }
  );
}

export function repairTodosFromReturn(trip: Trip, gears: Gear[], now: string): RepairTodo[] {
  const gearById = new Map(gears.map((gear) => [gear.id, gear]));
  return (trip.returnItems ?? [])
    .filter((item) => item.checked && item.damaged > 0)
    .flatMap((item) => {
      const gear = gearById.get(item.gearId);
      if (!gear) return [];
      const newDamage = Math.max(0, item.damaged - (item.preexistingDamaged ?? 0));
      return Array.from({ length: newDamage }, () => ({
        id: createId('repair'),
        gearId: gear.id,
        quantity: 1,
        note: `${trip.name} 归来发现损坏`,
        resolved: false,
        createdAt: now
      }));
    });
}

export function allocationsFromTemplate(template: Template, gears: Gear[]): Allocation[] {
  const ids = new Set(gears.map((gear) => gear.id));
  return template.allocations
    .filter((allocation) => ids.has(allocation.gearId))
    .map((allocation) => ({ ...allocation }));
}

export function defaultData(): AppData {
  const gears: Gear[] = [
    ['帐篷', '双人帐篷', 2, 0, 0, false, '含地布和风绳'],
    ['炉具', '卡式炉', 1, 0, 0, false, ''],
    ['炉具', '气罐', 4, 0, 0, false, '出行前检查余量'],
    ['照明', '头灯', 4, 0, 1, true, ''],
    ['照明', '营地灯', 2, 1, 0, true, '灯罩有裂纹'],
    ['睡眠', '睡袋', 3, 0, 0, false, ''],
    ['炊具', '套锅', 1, 0, 0, false, ''],
    ['工具', '多功能刀', 1, 0, 0, false, '']
  ].map(([category, name, total, damaged, uncharged, usesBatteries, notes]) =>
    normalizeGear({
      id: createId('gear'),
      name: name as string,
      category: category as GearCategory,
      total: total as number,
      damaged: damaged as number,
      uncharged: uncharged as number,
      usesBatteries: usesBatteries as boolean,
      notes: notes as string
    })
  );

  const weekend: Template = {
    id: createId('template'),
    name: '周末过夜',
    description: '两人一晚露营的常用装备',
    allocations: [
      { gearId: gears[0].id, quantity: 1, charged: 0 },
      { gearId: gears[1].id, quantity: 1, charged: 0 },
      { gearId: gears[2].id, quantity: 2, charged: 0 },
      { gearId: gears[3].id, quantity: 2, charged: 2 },
      { gearId: gears[4].id, quantity: 1, charged: 1 },
      { gearId: gears[5].id, quantity: 2, charged: 0 },
      { gearId: gears[6].id, quantity: 1, charged: 0 }
    ]
  };

  return { gears, trips: [], templates: [weekend], repairTodos: [] };
}
