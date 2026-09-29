import { describe, expect, it } from 'vitest';
import {
  OrderError,
  availabilityFor,
  cancelOrder,
  createOrder,
  productionPlanFor,
} from './domain';
import { formatDate, seedState, type BakeryState } from './store';

function makeState(): { state: BakeryState; date: string } {
  const state = seedState(new Date('2026-09-30T08:00:00'));
  const date = formatDate(new Date('2026-10-01T00:00:00'));
  return { state, date };
}

let seq = 0;
function nextId(): string {
  return `test-${++seq}`;
}

describe('预订下单与占用检查', () => {
  it('下单成功后占用原料与烤箱时段', () => {
    const { state, date } = makeState();
    const before = availabilityFor(date, state);
    const flourBefore = before.ingredients.find((i) => i.id === 'flour')!;

    const order = createOrder(
      {
        customerName: '张三',
        phone: '13800000000',
        pickupDate: date,
        items: [{ productId: 'croissant', qty: 12 }], // 恰好 1 炉
      },
      state,
      '2026-09-30T10:00:00.000Z',
      nextId(),
    );

    expect(order.status).toBe('confirmed');
    expect(order.allocations.reduce((s, a) => s + a.batches, 0)).toBe(1);

    const after = availabilityFor(date, state);
    const flourAfter = after.ingredients.find((i) => i.id === 'flour')!;
    expect(flourBefore.remaining - flourAfter.remaining).toBe(55 * 12);
    expect(after.slots.reduce((s, x) => s + x.remaining, 0)).toBe(
      before.slots.reduce((s, x) => s + x.remaining, 0) - 1,
    );
  });

  it('原料不足时拒绝下单', () => {
    const { state, date } = makeState();
    expect(() =>
      createOrder(
        {
          customerName: '李四',
          phone: '',
          pickupDate: date,
          items: [{ productId: 'whole-wheat-toast', qty: 100 }], // 面粉需求远超库存
        },
        state,
        '2026-09-30T10:00:00.000Z',
        nextId(),
      ),
    ).toThrowError(OrderError);
    expect(state.orders).toHaveLength(0);
  });

  it('烤箱产能不足时拒绝下单', () => {
    const { state, date } = makeState();
    // 把当天原料调到充足，只触发产能限制：当日总产能 11 炉，订 12 炉的蛋挞
    for (const entry of state.stock) {
      if (entry.date === date) entry.amount = 1_000_000;
    }
    expect(() =>
      createOrder(
        {
          customerName: '王五',
          phone: '',
          pickupDate: date,
          items: [{ productId: 'egg-tart', qty: 16 * 12 }],
        },
        state,
        '2026-09-30T10:00:00.000Z',
        nextId(),
      ),
    ).toThrowError(/产能不足/);
    expect(state.orders).toHaveLength(0);
  });

  it('取消订单后释放原料与产能占用', () => {
    const { state, date } = makeState();
    const before = availabilityFor(date, state);

    const order = createOrder(
      {
        customerName: '赵六',
        phone: '',
        pickupDate: date,
        items: [
          { productId: 'croissant', qty: 24 },
          { productId: 'egg-tart', qty: 16 },
        ],
      },
      state,
      '2026-09-30T10:00:00.000Z',
      nextId(),
    );
    cancelOrder(order.id, state);

    const after = availabilityFor(date, state);
    expect(after.ingredients.map((i) => i.remaining)).toEqual(
      before.ingredients.map((i) => i.remaining),
    );
    expect(after.slots.map((s) => s.remaining)).toEqual(
      before.slots.map((s) => s.remaining),
    );
    expect(order.status).toBe('cancelled');
  });

  it('数量向上取整占用炉数', () => {
    const { state, date } = makeState();
    const order = createOrder(
      {
        customerName: '孙七',
        phone: '',
        pickupDate: date,
        items: [{ productId: 'croissant', qty: 13 }], // 每炉 12 个 → 2 炉
      },
      state,
      '2026-09-30T10:00:00.000Z',
      nextId(),
    );
    expect(order.allocations.reduce((s, a) => s + a.batches, 0)).toBe(2);
  });
});

describe('每日制作清单', () => {
  it('按商品汇总数量、炉数与原料需求', () => {
    const { state, date } = makeState();
    const input = {
      customerName: '周八',
      phone: '',
      pickupDate: date,
      items: [{ productId: 'cinnamon-roll', qty: 9 }],
    };
    createOrder(input, state, '2026-09-30T10:00:00.000Z', nextId());
    createOrder(input, state, '2026-09-30T10:05:00.000Z', nextId());

    const plan = productionPlanFor(date, state);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({ productId: 'cinnamon-roll', qty: 18, batches: 2 });
    const flour = plan.ingredientNeeds.find((n) => n.ingredientId === 'flour')!;
    expect(flour.amount).toBe(60 * 18);
  });

  it('已取消订单不计入制作清单', () => {
    const { state, date } = makeState();
    const order = createOrder(
      {
        customerName: '吴九',
        phone: '',
        pickupDate: date,
        items: [{ productId: 'egg-tart', qty: 8 }],
      },
      state,
      '2026-09-30T10:00:00.000Z',
      nextId(),
    );
    cancelOrder(order.id, state);
    const plan = productionPlanFor(date, state);
    expect(plan.lines).toHaveLength(0);
    expect(plan.totalBatches).toBe(0);
  });
});
