import type { Bill, Member, Payment } from '../types';
import type { MemberBalance } from './settlement';
import { formatYuan } from './money';

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  // 加 BOM 让 Excel 正确识别 UTF-8 中文。
  return '﻿' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

const SPLIT_LABEL: Record<Bill['splitType'], string> = {
  equal: '人均',
  ratio: '固定比例',
  fixed: '指定金额',
};

export function billsToCsv(bills: Bill[], members: Member[]): string {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const rows: string[][] = [
    ['日期', '标题', '分类', '总额(元)', '付款人', '分摊方式', '分摊明细', '备注'],
  ];
  for (const b of bills) {
    const detail = b.shares.map((s) => `${nameOf(s.memberId)}:${formatYuan(s.amount)}`).join('; ');
    rows.push([
      b.date,
      b.title,
      b.category,
      formatYuan(b.totalCents),
      nameOf(b.payerId),
      SPLIT_LABEL[b.splitType],
      detail,
      b.note,
    ]);
  }
  return toCsv(rows);
}

export function paymentsToCsv(payments: Payment[], members: Member[]): string {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const rows: string[][] = [['日期', '付款人', '收款人', '金额(元)', '备注']];
  for (const p of payments) {
    rows.push([p.date, nameOf(p.fromId), nameOf(p.toId), formatYuan(p.amountCents), p.note]);
  }
  return toCsv(rows);
}

export function settlementToCsv(month: string, balances: MemberBalance[], members: Member[]): string {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const rows: string[][] = [
    [`${month} 月结`],
    ['成员', '应付(元)', '已付(元)', '转出还款(元)', '收到还款(元)', '差额(元)'],
  ];
  for (const b of balances) {
    rows.push([
      nameOf(b.memberId),
      formatYuan(b.owed),
      formatYuan(b.paid),
      formatYuan(b.transferredOut),
      formatYuan(b.transferredIn),
      formatYuan(b.balance),
    ]);
  }
  return toCsv(rows);
}

/** 触发浏览器下载（仅在前端使用）。 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
