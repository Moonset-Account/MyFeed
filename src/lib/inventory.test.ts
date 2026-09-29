import { describe, expect, it } from 'vitest';
import {
  createReturnItem,
  defaultData,
  departWithGear,
  evaluateTrip,
  normalizeGear,
  repairTodosFromReturn,
  returnGear
} from './inventory';
import type { Gear, Trip } from './types';

function gear(overrides: Partial<Gear> = {}): Gear {
  return normalizeGear({
    id: 'headlamp',
    name: '头灯',
    category: '照明',
    total: 4,
    damaged: 1,
    uncharged: 1,
    usesBatteries: true,
    notes: '',
    ...overrides
  });
}

describe('inventory rules', () => {
  it('normalizes damaged and uncharged counts so they never overlap or exceed total', () => {
    const result = gear({ total: 3, damaged: 4, uncharged: 3 });
    expect(result.damaged).toBe(3);
    expect(result.uncharged).toBe(0);
  });

  it('reports shortage, damaged items that would be taken, and uncharged batteries', () => {
    const tent = normalizeGear({
      id: 'tent',
      name: '帐篷',
      category: '帐篷',
      total: 1,
      damaged: 0,
      uncharged: 0,
      usesBatteries: false,
      notes: ''
    });
    const issues = evaluateTrip([tent, gear()], [
      { gearId: 'tent', quantity: 2, charged: 0 },
      { gearId: 'headlamp', quantity: 4, charged: 1 }
    ]);

    expect(issues).toEqual([
      expect.objectContaining({ gearId: 'tent', shortage: 1, damaged: 0, uncharged: 0 }),
      expect.objectContaining({ gearId: 'headlamp', shortage: 0, damaged: 1, uncharged: 2 })
    ]);
  });

  it('removes packed items from home inventory and returns them item by item', () => {
    const before = gear();
    const allocation = { gearId: before.id, quantity: 4, charged: 2 };
    const away = departWithGear(before, allocation);
    expect(away.total).toBe(0);
    expect(away.damaged).toBe(0);
    expect(away.uncharged).toBe(0);

    const returnItem = createReturnItem(before, allocation);
    expect(returnItem.expected).toBe(4);
    expect(returnItem.uncharged).toBe(1);

    const checked = {
      ...returnItem,
      returned: 3,
      damaged: 1,
      uncharged: 1,
      checked: true
    };
    const afterReturn = returnGear(away, checked);
    expect(afterReturn.total).toBe(3);
    expect(afterReturn.damaged).toBe(1);
    expect(afterReturn.uncharged).toBe(1);
  });

  it('creates repair todos only for damage found after the trip', () => {
    const trip: Trip = {
      id: 'trip_1',
      name: '周末露营',
      destination: '',
      date: '2026-10-01',
      status: '已归来',
      allocations: [{ gearId: 'headlamp', quantity: 2, charged: 0 }],
      returnItems: [
        {
          gearId: 'headlamp',
          expected: 2,
          returned: 2,
          damaged: 2,
          uncharged: 0,
          checked: true,
          preexistingDamaged: 1
        }
      ]
    };

    const todos = repairTodosFromReturn(trip, [gear()], '2026-10-02T00:00:00.000Z');
    expect(todos).toHaveLength(1);
    expect(todos.every((todo) => todo.gearId === 'headlamp' && todo.quantity === 1)).toBe(true);
  });

  it('seeds an offline demo inventory and a reusable weekend template', () => {
    const data = defaultData();
    expect(data.gears.length).toBeGreaterThanOrEqual(8);
    expect(data.templates[0]?.name).toBe('周末过夜');
    expect(data.templates[0]?.allocations.length).toBeGreaterThan(0);
  });
});
