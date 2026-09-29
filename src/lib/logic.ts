import type {
  AppState,
  ChecklistEntry,
  GearItem,
  RepairTask,
  Requirement,
  RequirementAssessment,
  Trip,
  TripTemplate,
  TripWarning,
} from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function emptyState(): AppState {
  return { gear: [], trips: [], templates: [], repairs: [] };
}

/** 可用数量 = 拥有 - 损坏，不为负 */
export function availableOf(item: GearItem): number {
  return Math.max(0, item.owned - item.damaged);
}

/** 评估一条需求：缺件、损坏、电池 */
export function assessRequirement(item: GearItem, required: number): RequirementAssessment {
  const available = availableOf(item);
  return {
    gearId: item.id,
    name: item.name,
    category: item.category,
    required,
    owned: item.owned,
    damaged: item.damaged,
    available,
    shortage: Math.max(0, required - available),
    hasDamaged: item.damaged > 0,
    batteryLow: item.batteryPowered && !item.batteryCharged,
  };
}

/** 汇总一次行程的全部警告 */
export function tripWarnings(trip: Trip, gear: GearItem[]): TripWarning[] {
  const warnings: TripWarning[] = [];
  for (const req of trip.requirements) {
    const item = gear.find((g) => g.id === req.gearId);
    if (!item) {
      warnings.push({
        kind: 'shortage',
        gearId: req.gearId,
        gearName: '（已删除的装备）',
        message: `需求 ${req.quantity} 件，但装备已从库中删除`,
      });
      continue;
    }
    const a = assessRequirement(item, req.quantity);
    if (a.shortage > 0) {
      warnings.push({
        kind: 'shortage',
        gearId: item.id,
        gearName: item.name,
        message: `缺 ${a.shortage} 件（需要 ${a.required}，可用 ${a.available}）`,
      });
    }
    if (a.hasDamaged) {
      warnings.push({
        kind: 'damaged',
        gearId: item.id,
        gearName: item.name,
        message: `有 ${a.damaged} 件损坏待修`,
      });
    }
    if (a.batteryLow) {
      warnings.push({
        kind: 'battery',
        gearId: item.id,
        gearName: item.name,
        message: '电池未充电',
      });
    }
  }
  return warnings;
}

/** 行程是否满足出发条件（无缺件） */
export function canDepart(trip: Trip, gear: GearItem[]): boolean {
  return !tripWarnings(trip, gear).some((w) => w.kind === 'shortage');
}

/** 出发：把需求快照为清单 */
export function depart(trip: Trip, gear: GearItem[]): Trip {
  const checklist: ChecklistEntry[] = trip.requirements.map((req) => {
    const item = gear.find((g) => g.id === req.gearId);
    return {
      gearId: req.gearId,
      name: item ? item.name : '（已删除的装备）',
      quantity: req.quantity,
      checked: false,
      returnedQty: 0,
      newlyDamaged: 0,
    };
  });
  return { ...trip, status: 'departed', checklist };
}

export interface ReturnResult {
  trip: Trip;
  gear: GearItem[];
  repairs: RepairTask[];
}

/**
 * 完成归来检查：把清单中的新增损坏写回装备库，
 * 并为仍有损坏的装备生成维修待办。
 */
export function completeReturn(trip: Trip, gear: GearItem[], repairs: RepairTask[]): ReturnResult {
  const nextGear = gear.map((g) => {
    const entry = trip.checklist.find((c) => c.gearId === g.id);
    if (!entry || entry.newlyDamaged <= 0) return g;
    return { ...g, damaged: Math.min(g.owned, g.damaged + entry.newlyDamaged) };
  });

  const now = new Date().toISOString();
  const newTasks: RepairTask[] = [];
  for (const entry of trip.checklist) {
    if (entry.newlyDamaged <= 0) continue;
    const item = nextGear.find((g) => g.id === entry.gearId);
    newTasks.push({
      id: uid(),
      gearId: entry.gearId,
      title: `「${trip.name}」归来：${entry.name} 新增 ${entry.newlyDamaged} 件损坏（当前共 ${item ? item.damaged : entry.newlyDamaged} 件待修）`,
      done: false,
      createdAt: now,
    });
  }

  return {
    trip: { ...trip, status: 'returned' },
    gear: nextGear,
    repairs: [...repairs, ...newTasks],
  };
}

/** 把行程需求保存为模板 */
export function saveAsTemplate(trip: Trip, name: string): TripTemplate {
  return {
    id: uid(),
    name,
    requirements: trip.requirements.map((r) => ({ ...r })),
  };
}

/** 用模板创建新行程 */
export function tripFromTemplate(template: TripTemplate, name: string, date: string): Trip {
  return {
    id: uid(),
    name,
    date,
    requirements: template.requirements.map((r) => ({ ...r })),
    status: 'planning',
    checklist: [],
  };
}

/** 完成维修待办：若关联装备则减少其损坏数量 */
export function resolveRepair(task: RepairTask, gear: GearItem[], fixedQty: number): GearItem[] {
  if (!task.gearId || fixedQty <= 0) return gear;
  return gear.map((g) =>
    g.id === task.gearId ? { ...g, damaged: Math.max(0, g.damaged - fixedQty) } : g,
  );
}

/** 示例数据：首次启动时填充，便于离线演示 */
export function seedState(): AppState {
  const tent: GearItem = {
    id: uid(), name: '双人帐篷', category: '帐篷', owned: 2, damaged: 0,
    batteryPowered: false, batteryCharged: false, notes: '含地钉与风绳',
  };
  const stove: GearItem = {
    id: uid(), name: '卡式炉', category: '炉具', owned: 1, damaged: 0,
    batteryPowered: false, batteryCharged: false, notes: '',
  };
  const lantern: GearItem = {
    id: uid(), name: 'LED 营地灯', category: '照明', owned: 3, damaged: 1,
    batteryPowered: true, batteryCharged: false, notes: 'USB 充电',
  };
  const sleepingBag: GearItem = {
    id: uid(), name: '羽绒睡袋', category: '睡眠', owned: 2, damaged: 0,
    batteryPowered: false, batteryCharged: false, notes: '舒适温标 -5°C',
  };
  const cookware: GearItem = {
    id: uid(), name: '套锅', category: '炊具', owned: 1, damaged: 0,
    batteryPowered: false, batteryCharged: false, notes: '',
  };
  const gear = [tent, stove, lantern, sleepingBag, cookware];

  const weekend: TripTemplate = {
    id: uid(),
    name: '周末双人露营',
    requirements: [
      { gearId: tent.id, quantity: 1 },
      { gearId: stove.id, quantity: 1 },
      { gearId: lantern.id, quantity: 2 },
      { gearId: sleepingBag.id, quantity: 2 },
      { gearId: cookware.id, quantity: 1 },
    ],
  };

  return {
    gear,
    trips: [],
    templates: [weekend],
    repairs: [
      {
        id: uid(),
        gearId: lantern.id,
        title: 'LED 营地灯 1 件不亮，检查充电口',
        done: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
