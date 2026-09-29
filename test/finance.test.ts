import { describe, expect, it } from 'vitest';
import type { Bill, Payment, Person } from '../src/types';
import {
  allocateBill,
  allocateByWeights,
  settlementSuggestions,
  summarizeMonth,
  validateBill,
} from '../src/core/finance';

const people: Person[] = [
  { id: 'a', name: '甲' },
  { id: 'b', name: '乙' },
  { id: 'c', name: '丙' },
];

const bill = (overrides: Partial<Bill>): Bill => ({
  id: 'bill',
  date: '2026-09-03',
  category: 'rent',
  title: '测试账单',
  amount: 10000,
  method: 'equal',
  participantIds: ['a', 'b', 'c'],
  shares: {},
  paid: { a: 10000 },
  note: '',
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  ...overrides,
});

describe('金额分摊', () => {
  it('按权重分配时使用最大余数法，总额完全一致', () => {
    const result = allocateByWeights(100, { a: 1, b: 1, c: 1 });
    expect(result).toEqual({ a: 34, b: 33, c: 33 });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('人均、比例和指定金额都返回原账单金额', () => {
    const equal = allocateBill(bill({}));
    const percent = allocateBill(bill({ amount: 36735, method: 'percent', shares: { a: 40, b: 35, c: 25 } }));
    const fixed = allocateBill(bill({ amount: 42860, method: 'fixed', shares: { a: 16000, b: 13240, c: 13620 } }));

    for (const allocation of [equal, percent, fixed]) {
      expect(Object.values(allocation).reduce((sum, value) => sum + value, 0)).toBe(allocation === equal ? 10000 : allocation === percent ? 36735 : 42860);
    }
  });

  it('拒绝比例不等于 100、固定金额或付款金额不等于账单总额', () => {
    const badPercent = validateBill(bill({ method: 'percent', shares: { a: 40, b: 30, c: 20 }, paid: { a: 10000 } }), people);
    const badFixed = validateBill(bill({ method: 'fixed', shares: { a: 3000, b: 3000, c: 3000 }, paid: { a: 10000 } }), people);
    const badPaid = validateBill(bill({ paid: { a: 9999 } }), people);

    expect(badPercent.valid).toBe(false);
    expect(badPercent.errors.join(' ')).toContain('100%');
    expect(badFixed.valid).toBe(false);
    expect(badFixed.errors.join(' ')).toContain('指定金额合计');
    expect(badPaid.valid).toBe(false);
    expect(badPaid.errors.join(' ')).toContain('实际付款合计');
  });
});

describe('月度差额和月结建议', () => {
  const bills = [
    bill({ id: 'rent', amount: 30000, participantIds: ['a', 'b', 'c'], paid: { a: 30000 } }),
    bill({
      id: 'utility',
      date: '2026-09-05',
      category: 'utilities',
      title: '水电',
      amount: 10000,
      method: 'percent',
      shares: { a: 40, b: 35, c: 25 },
      paid: { b: 10000 },
    }),
  ];

  it('按账单计算应付、已付和未含付款时的净差额', () => {
    const summaries = summarizeMonth('2026-09', people, bills, []);
    expect(summaries.map((item) => [item.personId, item.netBalance])).toEqual([
      ['a', 30000 - 10000 - 4000],
      ['b', 10000 - 10000 - 3500],
      ['c', 0 - 10000 - 2500],
    ]);
  });

  it('付款记录会更新净差额并生成最小化付款路径', () => {
    const payments: Payment[] = [{
      id: 'p1',
      date: '2026-09-30',
      payerId: 'c',
      payeeId: 'a',
      amount: 2500,
      note: '微信转账',
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z',
    }];
    const summaries = summarizeMonth('2026-09', people, bills, payments);
    const suggestions = settlementSuggestions(summaries);

    expect(summaries.find((item) => item.personId === 'c')?.netBalance).toBe(-15000);
    expect(suggestions).toHaveLength(2);
    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'b', toId: 'a', amount: 3500 }),
      expect.objectContaining({ fromId: 'c', toId: 'a', amount: 15000 }),
    ]));
  });
});
