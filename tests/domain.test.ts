import { describe, expect, it } from 'vitest';
import {
  availableActions,
  computeAmountCents,
  formatYuan,
  isOverdue,
  summarize,
  type Order,
} from '../shared/domain.js';

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: 'x',
    code: 'L-0001',
    customerName: '测试',
    phone: '13800000000',
    itemCount: 1,
    serviceIds: ['wash'],
    pickupDate: '2026-09-30',
    stainNotes: '',
    amountCents: 1200,
    status: 'washing',
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z',
    history: [],
    ...partial,
  };
}

describe('金额计算', () => {
  it('金额 = 服务单价之和 x 件数', () => {
    // 水洗 12 元 + 去渍 15 元 = 27 元/件,3 件 = 81 元
    expect(computeAmountCents(['wash', 'stain'], 3)).toBe(8100);
  });

  it('未知服务按 0 计', () => {
    expect(computeAmountCents(['nope'], 2)).toBe(0);
  });

  it('formatYuan 格式化', () => {
    expect(formatYuan(8100)).toBe('¥81.00');
  });
});

describe('状态流转', () => {
  it('清洗中只能送质检', () => {
    expect(availableActions('washing')).toEqual(['finish_wash']);
  });

  it('质检中可通过或退回重洗', () => {
    expect(availableActions('inspecting')).toEqual(['pass_qc', 'fail_qc']);
  });

  it('待领取只能取件,已取件无后续动作', () => {
    expect(availableActions('ready')).toEqual(['pickup']);
    expect(availableActions('picked_up')).toEqual([]);
  });
});

describe('逾期判断', () => {
  it('超过约定取件日期且未取走为逾期', () => {
    expect(isOverdue(makeOrder({ pickupDate: '2026-09-29' }), '2026-09-30')).toBe(true);
    expect(isOverdue(makeOrder({ pickupDate: '2026-09-30' }), '2026-09-30')).toBe(false);
  });

  it('已取件不算逾期', () => {
    expect(
      isOverdue(makeOrder({ pickupDate: '2026-09-01', status: 'picked_up' }), '2026-09-30'),
    ).toBe(false);
  });
});

describe('金额汇总', () => {
  it('按状态统计单数与金额,并汇总逾期', () => {
    const orders = [
      makeOrder({ id: '1', status: 'washing', amountCents: 1000, pickupDate: '2026-10-01' }),
      makeOrder({ id: '2', status: 'ready', amountCents: 2000, pickupDate: '2026-09-01' }),
      makeOrder({ id: '3', status: 'picked_up', amountCents: 3000, pickupDate: '2026-09-01' }),
    ];
    const s = summarize(orders, '2026-09-30');
    expect(s.totalOrders).toBe(3);
    expect(s.activeOrders).toBe(2);
    expect(s.byStatus).toEqual({ washing: 1, inspecting: 0, ready: 1, picked_up: 1 });
    expect(s.readyAmountCents).toBe(2000);
    expect(s.pickedUpAmountCents).toBe(3000);
    expect(s.activeAmountCents).toBe(3000);
    expect(s.overdueCount).toBe(1); // 只有待领取的那单逾期
    expect(s.overdueAmountCents).toBe(2000);
  });
});
