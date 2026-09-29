import { describe, expect, it } from 'vitest';
import {
  availabilityFor,
  batchesFor,
  checkOrder,
  ovenMinutesFor,
  productionPlanFor,
} from '../server/domain.js';
import { seedDatabase } from '../server/seed.js';
import type { Database, Order } from '../shared/types.js';

function makeOrder(db: Database, patch: Partial<Order>): Order {
  return {
    id: 'o1',
    customerName: '测试',
    pickupDate: db.ovenSlots[0].date,
    items: [],
    status: 'reserved',
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

describe('炉数与烤箱时间', () => {
  it('按每炉数量向上取整', () => {
    const db = seedDatabase();
    const croissant = db.recipes.find((r) => r.id === 'croissant')!;
    expect(batchesFor(croissant, 12)).toBe(1);
    expect(batchesFor(croissant, 13)).toBe(2);
    expect(ovenMinutesFor(croissant, 13)).toBe(40);
  });
});

describe('下单检查', () => {
  it('原料与产能充足时通过', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    expect(checkOrder(db, date, [{ recipeId: 'croissant', qty: 6 }])).toEqual([]);
  });

  it('原料不足时报告缺口', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    const shortages = checkOrder(db, date, [{ recipeId: 'croissant', qty: 1000 }]);
    expect(shortages.some((s) => s.kind === 'ingredient' && s.ingredientId === 'flour')).toBe(true);
  });

  it('烤箱产能不足时报告缺口', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    // 当天总产能 330 分钟；法棍每炉 25 分钟，订到需要 14 炉 = 350 分钟
    const shortages = checkOrder(db, date, [{ recipeId: 'baguette', qty: 8 * 14 }]);
    expect(shortages.some((s) => s.kind === 'oven')).toBe(true);
  });

  it('已有订单的占用会计入检查', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    db.orders.push(makeOrder(db, { items: [{ recipeId: 'baguette', qty: 8 * 12 }] })); // 300 分钟
    const shortages = checkOrder(db, date, [{ recipeId: 'baguette', qty: 8 * 2 }]); // 再要 50 分钟
    expect(shortages.some((s) => s.kind === 'oven')).toBe(true);
  });

  it('取消的订单释放占用', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    db.orders.push(
      makeOrder(db, { items: [{ recipeId: 'baguette', qty: 8 * 12 }], status: 'cancelled' }),
    );
    const avail = availabilityFor(db, date);
    expect(avail.oven.reserved).toBe(0);
    expect(avail.oven.remaining).toBe(avail.oven.capacity);
  });
});

describe('每日制作清单', () => {
  it('汇总数量、炉数与原料', () => {
    const db = seedDatabase();
    const date = db.ovenSlots[0].date;
    db.orders.push(
      makeOrder(db, { id: 'a', items: [{ recipeId: 'croissant', qty: 10 }] }),
      makeOrder(db, { id: 'b', items: [{ recipeId: 'croissant', qty: 5 }] }),
      makeOrder(db, { id: 'c', items: [{ recipeId: 'egg-tart', qty: 16 }], status: 'cancelled' }),
    );
    const plan = productionPlanFor(db, date);
    const line = plan.lines.find((l) => l.recipeId === 'croissant')!;
    expect(line.qty).toBe(15);
    expect(line.batches).toBe(2); // 10 -> 1 炉，5 -> 1 炉
    expect(plan.lines.find((l) => l.recipeId === 'egg-tart')).toBeUndefined();
    const flour = plan.ingredientTotals.find((t) => t.ingredientId === 'flour')!;
    expect(flour.qty).toBe(15 * 55);
  });
});
