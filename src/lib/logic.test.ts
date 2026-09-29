import { describe, expect, it } from 'vitest';
import {
  assessRequirement,
  availableOf,
  canDepart,
  completeReturn,
  depart,
  resolveRepair,
  saveAsTemplate,
  tripFromTemplate,
  tripWarnings,
} from './logic';
import type { GearItem, RepairTask, Trip } from './types';

function gear(partial: Partial<GearItem>): GearItem {
  return {
    id: 'g1',
    name: '营地灯',
    category: '照明',
    owned: 3,
    damaged: 0,
    batteryPowered: false,
    batteryCharged: false,
    notes: '',
    ...partial,
  };
}

function trip(requirements: Trip['requirements']): Trip {
  return { id: 't1', name: '测试行程', date: '2026-10-01', requirements, status: 'planning', checklist: [] };
}

describe('availableOf / assessRequirement', () => {
  it('可用数量 = 拥有 - 损坏，且不为负', () => {
    expect(availableOf(gear({ owned: 3, damaged: 1 }))).toBe(2);
    expect(availableOf(gear({ owned: 1, damaged: 5 }))).toBe(0);
  });

  it('缺件数量按可用量计算', () => {
    const a = assessRequirement(gear({ owned: 3, damaged: 1 }), 3);
    expect(a.available).toBe(2);
    expect(a.shortage).toBe(1);
  });

  it('电池装备未充电时给出电池标记', () => {
    expect(assessRequirement(gear({ batteryPowered: true, batteryCharged: false }), 1).batteryLow).toBe(true);
    expect(assessRequirement(gear({ batteryPowered: true, batteryCharged: true }), 1).batteryLow).toBe(false);
    expect(assessRequirement(gear({ batteryPowered: false }), 1).batteryLow).toBe(false);
  });
});

describe('tripWarnings / canDepart', () => {
  it('同时报告缺件、损坏与电池未充电', () => {
    const lamp = gear({ id: 'lamp', name: '营地灯', owned: 1, damaged: 1, batteryPowered: true, batteryCharged: false });
    const t = trip([{ gearId: 'lamp', quantity: 2 }]);
    const kinds = tripWarnings(t, [lamp]).map((w) => w.kind);
    expect(kinds).toContain('shortage');
    expect(kinds).toContain('damaged');
    expect(kinds).toContain('battery');
  });

  it('装备被删除后需求报缺件', () => {
    const t = trip([{ gearId: 'ghost', quantity: 1 }]);
    const warnings = tripWarnings(t, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('shortage');
  });

  it('无缺件时可出发，缺件时不可出发', () => {
    const tent = gear({ id: 'tent', owned: 2 });
    expect(canDepart(trip([{ gearId: 'tent', quantity: 2 }]), [tent])).toBe(true);
    expect(canDepart(trip([{ gearId: 'tent', quantity: 3 }]), [tent])).toBe(false);
  });
});

describe('depart / completeReturn', () => {
  it('出发时快照清单，归来损坏写回装备库并生成维修待办', () => {
    const tent = gear({ id: 'tent', name: '帐篷', owned: 2, damaged: 0 });
    const departed = depart(trip([{ gearId: 'tent', quantity: 2 }]), [tent]);
    expect(departed.status).toBe('departed');
    expect(departed.checklist).toHaveLength(1);
    expect(departed.checklist[0]).toMatchObject({ name: '帐篷', quantity: 2, checked: false });

    const checked = {
      ...departed,
      checklist: departed.checklist.map((c) => ({ ...c, checked: true, returnedQty: 2, newlyDamaged: 1 })),
    };
    const result = completeReturn(checked, [tent], []);
    expect(result.trip.status).toBe('returned');
    expect(result.gear[0].damaged).toBe(1);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].gearId).toBe('tent');
    expect(result.repairs[0].title).toContain('帐篷');
  });

  it('新增损坏不会超过拥有数量', () => {
    const tent = gear({ id: 'tent', owned: 1, damaged: 0 });
    const departed = depart(trip([{ gearId: 'tent', quantity: 1 }]), [tent]);
    const checked = {
      ...departed,
      checklist: departed.checklist.map((c) => ({ ...c, newlyDamaged: 5 })),
    };
    expect(completeReturn(checked, [tent], []).gear[0].damaged).toBe(1);
  });
});

describe('模板与维修', () => {
  it('行程可存为模板并从模板创建新行程', () => {
    const t = trip([{ gearId: 'a', quantity: 1 }]);
    const tpl = saveAsTemplate(t, '周末模板');
    expect(tpl.requirements).toEqual([{ gearId: 'a', quantity: 1 }]);

    const next = tripFromTemplate(tpl, '五一出行', '2026-05-01');
    expect(next.status).toBe('planning');
    expect(next.requirements).toEqual(tpl.requirements);
    expect(next.id).not.toBe(t.id);
  });

  it('完成维修可减少装备损坏数量，且不为负', () => {
    const lamp = gear({ id: 'lamp', damaged: 2 });
    const task: RepairTask = { id: 'r1', gearId: 'lamp', title: '修灯', done: false, createdAt: '' };
    expect(resolveRepair(task, [lamp], 1)[0].damaged).toBe(1);
    expect(resolveRepair(task, [lamp], 9)[0].damaged).toBe(0);
    const manual: RepairTask = { ...task, gearId: null };
    expect(resolveRepair(manual, [lamp], 1)[0].damaged).toBe(2);
  });
});
