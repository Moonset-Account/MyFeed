import { describe, expect, it } from 'vitest';
import { billsToCsv, settlementToCsv, toCsv } from './csv';
import type { Bill, Member } from '../types';

const members: Member[] = [
  { id: 'a', name: '甲' },
  { id: 'b', name: '乙' },
];

const bill: Bill = {
  id: '1',
  title: '9月房租,含物业',
  category: '房租',
  date: '2026-09-01',
  totalCents: 300000,
  payerId: 'a',
  splitType: 'equal',
  participantIds: ['a', 'b'],
  ratios: [],
  shares: [
    { memberId: 'a', amount: 150000 },
    { memberId: 'b', amount: 150000 },
  ],
  note: '他说"月底结"',
  createdAt: 0,
  updatedAt: 0,
};

describe('CSV 导出', () => {
  it('带 BOM 且转义逗号与引号', () => {
    const csv = billsToCsv([bill], members);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"9月房租,含物业"');
    expect(csv).toContain('"他说""月底结"""');
    expect(csv).toContain('3000.00');
    expect(csv).toContain('甲:1500.00; 乙:1500.00');
  });

  it('月结 CSV 含每人差额', () => {
    const csv = settlementToCsv('2026-09', [
      { memberId: 'a', owed: 150000, paid: 300000, transferredOut: 0, transferredIn: 0, balance: 150000 },
      { memberId: 'b', owed: 150000, paid: 0, transferredOut: 0, transferredIn: 0, balance: -150000 },
    ], members);
    expect(csv).toContain('2026-09 月结');
    expect(csv).toContain('甲,1500.00,3000.00,0.00,0.00,1500.00');
    expect(csv).toContain('乙,1500.00,0.00,0.00,0.00,-1500.00');
  });

  it('toCsv 使用 CRLF 行尾', () => {
    expect(toCsv([['a'], ['b']])).toBe('﻿a\r\nb\r\n');
  });
});
