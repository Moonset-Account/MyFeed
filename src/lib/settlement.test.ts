import { describe, expect, it } from 'vitest';
import { computeMonthBalances, suggestTransfers } from './settlement';
import type { Bill, Member, Payment } from '../types';

const members: Member[] = [
  { id: 'a', name: '甲' },
  { id: 'b', name: '乙' },
];

function bill(partial: Partial<Bill>): Bill {
  return {
    id: 'bill1',
    title: 't',
    category: '房租',
    date: '2026-09-01',
    totalCents: 0,
    payerId: 'a',
    splitType: 'equal',
    participantIds: [],
    ratios: [],
    shares: [],
    note: '',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('computeMonthBalances 月结差额', () => {
  it('垫付人差额为正，其他人为负，且全员差额之和为 0', () => {
    const bills = [
      bill({ totalCents: 10000, payerId: 'a', shares: [
        { memberId: 'a', amount: 5000 },
        { memberId: 'b', amount: 5000 },
      ] }),
    ];
    const balances = computeMonthBalances(members, bills, [], '2026-09');
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b]));
    expect(byId.a.paid).toBe(10000);
    expect(byId.a.owed).toBe(5000);
    expect(byId.a.balance).toBe(5000);
    expect(byId.b.balance).toBe(-5000);
    expect(balances.reduce((s, b) => s + b.balance, 0)).toBe(0);
  });

  it('只统计所选月份', () => {
    const bills = [
      bill({ id: '1', date: '2026-09-01', totalCents: 10000, shares: [{ memberId: 'a', amount: 10000 }] }),
      bill({ id: '2', date: '2026-10-01', totalCents: 20000, shares: [{ memberId: 'a', amount: 20000 }] }),
    ];
    const balances = computeMonthBalances(members, bills, [], '2026-09');
    expect(balances.find((b) => b.memberId === 'a')!.paid).toBe(10000);
  });

  it('付款记录冲抵差额', () => {
    const bills = [
      bill({ totalCents: 10000, payerId: 'a', shares: [
        { memberId: 'a', amount: 5000 },
        { memberId: 'b', amount: 5000 },
      ] }),
    ];
    const payments: Payment[] = [
      { id: 'p1', date: '2026-09-15', fromId: 'b', toId: 'a', amountCents: 5000, note: '结清', createdAt: 0 },
    ];
    const balances = computeMonthBalances(members, bills, payments, '2026-09');
    expect(balances.every((b) => b.balance === 0)).toBe(true);
  });

  it('修改账单后用新数据重算，差额随之更新', () => {
    const before = [bill({ totalCents: 10000, shares: [{ memberId: 'a', amount: 10000 }] })];
    const after = [bill({ totalCents: 8000, shares: [{ memberId: 'a', amount: 8000 }] })];
    const b1 = computeMonthBalances(members, before, [], '2026-09');
    const b2 = computeMonthBalances(members, after, [], '2026-09');
    expect(b1.find((b) => b.memberId === 'a')!.balance).toBe(0);
    expect(b2.find((b) => b.memberId === 'a')!.balance).toBe(0);
    expect(b2.find((b) => b.memberId === 'a')!.paid).toBe(8000);
  });
});

describe('suggestTransfers 结清建议', () => {
  it('债务人与债权人贪心匹配，执行后全部归零', () => {
    const bills = [
      bill({ id: '1', totalCents: 9000, payerId: 'a', shares: [
        { memberId: 'a', amount: 3000 },
        { memberId: 'b', amount: 3000 },
        { memberId: 'c', amount: 3000 },
      ] }),
    ];
    const three = [...members, { id: 'c', name: '丙' }];
    const balances = computeMonthBalances(three, bills, [], '2026-09');
    const transfers = suggestTransfers(balances);
    expect(transfers).toEqual([
      { fromId: 'b', toId: 'a', amount: 3000 },
      { fromId: 'c', toId: 'a', amount: 3000 },
    ]);
    // 模拟执行转账后差额归零
    const after = balances.map((b) => ({ ...b }));
    for (const t of transfers) {
      after.find((b) => b.memberId === t.fromId)!.balance += t.amount;
      after.find((b) => b.memberId === t.toId)!.balance -= t.amount;
    }
    expect(after.every((b) => b.balance === 0)).toBe(true);
  });

  it('全部平衡时不产生建议', () => {
    const balances = computeMonthBalances(members, [], [], '2026-09');
    expect(suggestTransfers(balances)).toEqual([]);
  });
});
