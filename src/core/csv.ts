import { categoryLabel, formatCurrency, methodLabel, monthOf, allocateBill } from './finance';
import type { Bill, Payment, Person } from '../types';

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function billsToCsv(bills: Bill[], people: Person[]): string {
  const personName = (id: string) => people.find((person) => person.id === id)?.name ?? id;
  const rows: (string | number)[][] = [
    ['日期', '月份', '类别', '账单', '分摊方式', '账单金额', '分摊成员', ...people.map((person) => `${person.name}应付`), ...people.map((person) => `${person.name}已付`), '付款备注'],
  ];

  for (const bill of bills) {
    const allocation = allocateBill(bill);
    rows.push([
      bill.date,
      monthOf(bill.date),
      categoryLabel(bill.category),
      bill.title,
      methodLabel(bill.method),
      formatCurrency(bill.amount),
      bill.participantIds.map(personName).join(' / '),
      ...people.map((person) => allocation[person.id] != null ? formatCurrency(allocation[person.id]) : ''),
      ...people.map((person) => bill.paid[person.id] ? formatCurrency(bill.paid[person.id]) : ''),
      bill.note,
    ]);
  }

  return `﻿${toCsv(rows)}`;
}

export function paymentsToCsv(payments: Payment[], people: Person[]): string {
  const personName = (id: string) => people.find((person) => person.id === id)?.name ?? id;
  const rows: (string | number)[][] = [['日期', '月份', '付款人', '收款人', '金额', '备注']];
  for (const payment of payments) {
    rows.push([
      payment.date,
      monthOf(payment.date),
      personName(payment.payerId),
      personName(payment.payeeId),
      formatCurrency(payment.amount),
      payment.note,
    ]);
  }
  return `﻿${toCsv(rows)}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
