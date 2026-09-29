import type {
  Bill,
  BillValidationResult,
  Payment,
  Person,
  PersonSummary,
  SettlementSuggestion,
  SplitMethod,
} from '../types';

export const CENTS_PER_YUAN = 100;

export function yuanToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * CENTS_PER_YUAN);
}

export function centsToYuan(cents: number): number {
  return cents / CENTS_PER_YUAN;
}

export function formatCurrency(cents: number): string {
  const negative = cents < 0;
  const value = Math.abs(cents);
  const yuan = Math.floor(value / CENTS_PER_YUAN);
  const fraction = String(value % CENTS_PER_YUAN).padStart(3, '0').slice(0, 2);
  return `${negative ? '-' : ''}¥${yuan.toLocaleString('zh-CN')}.${fraction}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function stableOrder(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * Allocate integer cents with the largest-remainder method. The result always
 * equals the original total and never creates cents through floating point.
 */
export function allocateByWeights(totalCents: number, weights: Record<string, number>): Record<string, number> {
  const ids = stableOrder(Object.keys(weights).filter((id) => weights[id] > 0));
  const weightTotal = ids.reduce((sum, id) => sum + weights[id], 0);

  if (totalCents <= 0 || ids.length === 0 || weightTotal <= 0) {
    return {};
  }

  const exact = ids.map((id) => {
    const raw = (totalCents * weights[id]) / weightTotal;
    return { id, raw, floor: Math.floor(raw) };
  });

  const allocated = exact.reduce((sum, item) => sum + item.floor, 0);
  let remainder = totalCents - allocated;

  const result = Object.fromEntries(exact.map((item) => [item.id, item.floor]));
  const byRemainder = exact.sort((a, b) => {
    const difference = b.raw - b.floor - (a.raw - a.floor);
    if (difference !== 0) return difference;
    return a.id.localeCompare(b.id);
  });

  for (const item of byRemainder) {
    if (remainder <= 0) break;
    result[item.id] += 1;
    remainder -= 1;
  }

  return result;
}

export function allocateBill(bill: Pick<Bill, 'amount' | 'method' | 'participantIds' | 'shares'>): Record<string, number> {
  const ids = stableOrder(bill.participantIds);
  if (bill.method === 'fixed') {
    return Object.fromEntries(ids.map((id) => [id, Math.max(0, Math.round(bill.shares[id] ?? 0))]));
  }

  if (bill.method === 'percent') {
    return allocateByWeights(
      bill.amount,
      Object.fromEntries(ids.map((id) => [id, Number(bill.shares[id] ?? 0)])),
    );
  }

  return allocateByWeights(bill.amount, Object.fromEntries(ids.map((id) => [id, 1])));
}

export function validateBill(bill: Pick<Bill, 'amount' | 'method' | 'participantIds' | 'shares' | 'paid'>, people: Person[]): BillValidationResult {
  const errors: string[] = [];
  const personIds = new Set(people.map((person) => person.id));
  const participants = stableOrder(bill.participantIds.filter((id, index, all) => personIds.has(id) && all.indexOf(id) === index));

  if (bill.amount <= 0) errors.push('账单金额必须大于 0。');
  if (participants.length === 0) errors.push('请至少选择一位分摊成员。');

  for (const id of participants) {
    if (bill.method === 'percent') {
      const percent = Number(bill.shares[id] ?? 0);
      if (!Number.isFinite(percent) || percent <= 0) errors.push('固定比例必须为正数。');
    }
    if (bill.method === 'fixed') {
      const amount = Math.round(Number(bill.shares[id] ?? 0));
      if (!Number.isFinite(Number(bill.shares[id] ?? 0)) || amount < 0) errors.push('指定金额不能为负数。');
    }
  }

  if (bill.method === 'percent' && participants.length > 0) {
    const total = participants.reduce((sum, id) => sum + Number(bill.shares[id] ?? 0), 0);
    if (Math.abs(total - 100) > 0.001) {
      errors.push(`固定比例合计必须等于 100%，当前为 ${trimNumber(total)}%。`);
    }
  }

  if (bill.method === 'fixed' && participants.length > 0 && bill.amount > 0) {
    const total = participants.reduce((sum, id) => sum + Math.max(0, Math.round(Number(bill.shares[id] ?? 0))), 0);
    if (total !== bill.amount) {
      errors.push(`指定金额合计必须等于账单金额，差额 ${formatCurrency(bill.amount - total)}。`);
    }
  }

  const payerIds = Object.keys(bill.paid).filter((id) => personIds.has(id));
  const paidTotal = payerIds.reduce((sum, id) => sum + Math.max(0, Math.round(Number(bill.paid[id] ?? 0))), 0);
  if (payerIds.every((id) => Math.round(Number(bill.paid[id] ?? 0)) <= 0)) {
    errors.push('请记录至少一位实际付款人。');
  }
  if (bill.amount > 0 && paidTotal !== bill.amount) {
    errors.push(`实际付款合计必须等于账单金额，差额 ${formatCurrency(bill.amount - paidTotal)}。`);
  }

  return { valid: errors.length === 0, errors };
}

export function validatePayment(payment: Pick<Payment, 'payerId' | 'payeeId' | 'amount'>, people: Person[]): string[] {
  const errors: string[] = [];
  const ids = new Set(people.map((person) => person.id));
  if (!ids.has(payment.payerId)) errors.push('请选择付款人。');
  if (!ids.has(payment.payeeId)) errors.push('请选择收款人。');
  if (payment.payerId && payment.payerId === payment.payeeId) errors.push('付款人和收款人不能相同。');
  if (payment.amount <= 0) errors.push('付款金额必须大于 0。');
  return errors;
}

export function summarizeMonth(month: string, people: Person[], bills: Bill[], payments: Payment[]): PersonSummary[] {
  const monthBills = bills.filter((bill) => monthOf(bill.date) === month);
  const monthPayments = payments.filter((payment) => monthOf(payment.date) === month);

  return people.map((person) => {
    const shouldPay = monthBills.reduce((sum, bill) => sum + (allocateBill(bill)[person.id] ?? 0), 0);
    const paid = monthBills.reduce((sum, bill) => sum + Math.max(0, Math.round(bill.paid[person.id] ?? 0)), 0);
    const settlementOut = monthPayments
      .filter((payment) => payment.payerId === person.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const settlementIn = monthPayments
      .filter((payment) => payment.payeeId === person.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const billBalance = paid - shouldPay;

    return {
      personId: person.id,
      name: person.name,
      shouldPay,
      paid,
      billBalance,
      settlementOut,
      settlementIn,
      netBalance: billBalance - settlementOut + settlementIn,
    };
  });
}

export function settlementSuggestions(summaries: Pick<PersonSummary, 'personId' | 'name' | 'netBalance'>[]): SettlementSuggestion[] {
  const debtors = summaries
    .filter((item) => item.netBalance < 0)
    .map((item) => ({ ...item, remaining: -item.netBalance }))
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
  const creditors = summaries
    .filter((item) => item.netBalance > 0)
    .map((item) => ({ ...item, remaining: item.netBalance }))
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));

  const suggestions: SettlementSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].remaining, creditors[creditorIndex].remaining);
    if (amount > 0) {
      suggestions.push({
        fromId: debtors[debtorIndex].personId,
        fromName: debtors[debtorIndex].name,
        toId: creditors[creditorIndex].personId,
        toName: creditors[creditorIndex].name,
        amount,
      });
      debtors[debtorIndex].remaining -= amount;
      creditors[creditorIndex].remaining -= amount;
    }
    if (debtors[debtorIndex].remaining === 0) debtorIndex += 1;
    if (creditorIndex < creditors.length && creditors[creditorIndex].remaining === 0) creditorIndex += 1;
  }

  return suggestions;
}

export function defaultPercent(participantIds: string[], previous: Record<string, number>): Record<string, number> {
  const count = participantIds.length;
  if (count === 0) return {};
  const base = Math.floor((100 / count) * 1000) / 1000;
  const values = Object.fromEntries(participantIds.map((id) => [id, previous[id] > 0 ? previous[id] : base]));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const first = participantIds[0];
  values[first] = Math.round((values[first] + (100 - total)) * 1000) / 1000;
  return values;
}

export function methodLabel(method: SplitMethod): string {
  return method === 'equal' ? '按人均' : method === 'percent' ? '固定比例' : '指定金额';
}

export function categoryLabel(category: Bill['category']): string {
  const labels: Record<Bill['category'], string> = {
    rent: '房租',
    utilities: '水电',
    groceries: '采购',
    other: '其他',
  };
  return labels[category];
}

function trimNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
