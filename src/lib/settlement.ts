import type { Bill, Member, Payment } from '../types';

export interface MemberBalance {
  memberId: string;
  /** 本月应付（分摊合计，分） */
  owed: number;
  /** 本月已付（作为付款人垫付的账单合计，分） */
  paid: number;
  /** 本月转出的还款 */
  transferredOut: number;
  /** 本月收到的还款 */
  transferredIn: number;
  /**
   * 差额 = 已付 - 应付 + 转出 - 转入。
   * 正数：应收回；负数：应付出。
   */
  balance: number;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** 计算某月每个成员的应付/已付/差额。 */
export function computeMonthBalances(
  members: Member[],
  bills: Bill[],
  payments: Payment[],
  month: string,
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const m of members) {
    map.set(m.id, {
      memberId: m.id,
      owed: 0,
      paid: 0,
      transferredOut: 0,
      transferredIn: 0,
      balance: 0,
    });
  }
  const ensure = (id: string) => {
    let b = map.get(id);
    if (!b) {
      b = { memberId: id, owed: 0, paid: 0, transferredOut: 0, transferredIn: 0, balance: 0 };
      map.set(id, b);
    }
    return b;
  };

  for (const bill of bills) {
    if (monthOf(bill.date) !== month) continue;
    ensure(bill.payerId).paid += bill.totalCents;
    for (const share of bill.shares) {
      ensure(share.memberId).owed += share.amount;
    }
  }
  for (const p of payments) {
    if (monthOf(p.date) !== month) continue;
    ensure(p.fromId).transferredOut += p.amountCents;
    ensure(p.toId).transferredIn += p.amountCents;
  }
  for (const b of map.values()) {
    b.balance = b.paid - b.owed + b.transferredOut - b.transferredIn;
  }
  return [...map.values()];
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * 根据差额给出结清建议：差额为负的成员向为正的成员付款。
 * 贪心匹配，结果中所有人的差额归零（总额守恒时）。
 */
export function suggestTransfers(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.memberId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.memberId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}
