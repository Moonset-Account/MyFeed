import { describe, expect, it } from 'vitest';
import {
  addInbound,
  applyDistribution,
  availableStock,
  batchTrace,
  daysUntil,
  expiringBatches,
  inspectBatch,
  planDistribution,
  summarizeStock,
} from './inventory';
import { batchesToCsv, csvCell, txnsToCsv } from './csv';
import type { InventoryState } from './types';

const NOW = new Date('2026-09-30T10:00:00');

function inbound(
  state: InventoryState,
  itemName: string,
  quantity: number,
  expiryDate = '',
  location = 'A区-1架',
): InventoryState {
  return addInbound(
    state,
    { itemName, category: '食品', unit: '箱', quantity, expiryDate, location },
    NOW,
  );
}

function makeAvailable(state: InventoryState): InventoryState {
  return state.batches
    .filter((b) => b.status === 'pending')
    .reduce((s, b) => inspectBatch(s, b.id, true, NOW), state);
}

describe('入库登记', () => {
  it('新批次默认为待检查，并记录入库流水', () => {
    const s = inbound({ batches: [], txns: [] }, '矿泉水', 10, '2027-01-01');
    expect(s.batches).toHaveLength(1);
    expect(s.batches[0].status).toBe('pending');
    expect(s.batches[0].remaining).toBe(10);
    expect(s.txns).toHaveLength(1);
    expect(s.txns[0].type).toBe('in');
  });

  it('拒绝非法数量与空名称', () => {
    const s: InventoryState = { batches: [], txns: [] };
    expect(() => addInbound(s, { itemName: '米', category: '', unit: '', quantity: 0, expiryDate: '', location: 'A' })).toThrow();
    expect(() => addInbound(s, { itemName: ' ', category: '', unit: '', quantity: 1, expiryDate: '', location: 'A' })).toThrow();
    expect(() => addInbound(s, { itemName: '米', category: '', unit: '', quantity: 1.5, expiryDate: '', location: 'A' })).toThrow();
  });
});

describe('质检标记', () => {
  it('待检查批次可标记为可发放或不合格，且不能重复质检', () => {
    let s = inbound({ batches: [], txns: [] }, '矿泉水', 10);
    const id = s.batches[0].id;
    s = inspectBatch(s, id, true, NOW);
    expect(s.batches[0].status).toBe('available');
    expect(() => inspectBatch(s, id, false, NOW)).toThrow();

    let s2 = inbound({ batches: [], txns: [] }, '方便面', 5);
    s2 = inspectBatch(s2, s2.batches[0].id, false, NOW);
    expect(s2.batches[0].status).toBe('rejected');
    expect(availableStock(s2.batches, '方便面')).toBe(0);
  });
});

describe('发放控制', () => {
  it('发放数量不得超过可用库存', () => {
    let s = inbound({ batches: [], txns: [] }, '矿泉水', 10);
    s = makeAvailable(s);
    expect(() => applyDistribution(s, '矿泉水', 11, '张三', NOW)).toThrow(/超过/);
    s = applyDistribution(s, '矿泉水', 10, '张三', NOW);
    expect(availableStock(s.batches, '矿泉水')).toBe(0);
  });

  it('待检查批次不计入可发放库存', () => {
    const s = inbound({ batches: [], txns: [] }, '矿泉水', 10);
    expect(availableStock(s.batches, '矿泉水')).toBe(0);
    expect(() => applyDistribution(s, '矿泉水', 1, '张三', NOW)).toThrow();
  });

  it('按 FEFO 分配：临期批次优先扣减', () => {
    let s: InventoryState = { batches: [], txns: [] };
    s = inbound(s, '牛奶', 10, '2027-06-01');
    s = inbound(s, '牛奶', 10, '2026-10-15');
    s = inbound(s, '牛奶', 10, '');
    s = makeAvailable(s);
    const [late, early, noExpiry] = s.batches;

    const plan = planDistribution(s.batches, '牛奶', 15);
    expect(plan).toEqual([
      { batchId: early.id, take: 10 },
      { batchId: late.id, take: 5 },
    ]);

    s = applyDistribution(s, '牛奶', 25, '社区', NOW);
    const remain = (id: string) => s.batches.find((b) => b.id === id)!.remaining;
    expect(remain(early.id)).toBe(0);
    expect(remain(late.id)).toBe(0);
    expect(remain(noExpiry.id)).toBe(5);
  });
});

describe('临期提示', () => {
  it('30 天内到期（含已过期）的可发放批次按剩余天数升序', () => {
    let s: InventoryState = { batches: [], txns: [] };
    s = inbound(s, '面包', 5, '2026-09-28'); // 已过期 2 天
    s = inbound(s, '牛奶', 5, '2026-10-10'); // 10 天
    s = inbound(s, '罐头', 5, '2027-06-01'); // 不临期
    s = makeAvailable(s);
    const list = expiringBatches(s.batches, 30, NOW);
    expect(list.map((e) => e.batch.itemName)).toEqual(['面包', '牛奶']);
    expect(list[0].daysLeft).toBe(-2);
    expect(list[1].daysLeft).toBe(10);
  });

  it('daysUntil 计算正确', () => {
    expect(daysUntil('2026-10-01', NOW)).toBe(1);
    expect(daysUntil('2026-09-30', NOW)).toBe(0);
  });
});

describe('批次追溯与汇总', () => {
  it('批次流水按时间升序完整可追溯', () => {
    let s = inbound({ batches: [], txns: [] }, '矿泉水', 10);
    const id = s.batches[0].id;
    s = inspectBatch(s, id, true, NOW);
    s = applyDistribution(s, '矿泉水', 4, '李四', NOW);
    const trace = batchTrace(s.txns, id);
    expect(trace.map((t) => t.type)).toEqual(['in', 'inspect', 'out']);
  });

  it('按物资汇总三种状态数量', () => {
    let s: InventoryState = { batches: [], txns: [] };
    s = inbound(s, '矿泉水', 10);
    s = inbound(s, '矿泉水', 6);
    s = inspectBatch(s, s.batches[0].id, true, NOW);
    s = inspectBatch(s, s.batches[1].id, false, NOW);
    s = inbound(s, '矿泉水', 3);
    const sum = summarizeStock(s.batches);
    expect(sum).toHaveLength(1);
    expect(sum[0]).toMatchObject({ available: 10, rejected: 6, pending: 3 });
  });
});

describe('CSV 导出', () => {
  it('单元格转义逗号、引号与换行', () => {
    expect(csvCell('普通')).toBe('普通');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('说"你好"')).toBe('"说""你好"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('收发记录与批次均可导出为带表头的 CSV', () => {
    let s = inbound({ batches: [], txns: [] }, '矿泉水', 10, '2027-01-01');
    s = inspectBatch(s, s.batches[0].id, true, NOW);
    s = applyDistribution(s, '矿泉水', 2, '王五', NOW);

    const txnCsv = txnsToCsv(s.txns);
    expect(txnCsv).toContain('时间,类型,批次号,物资名称,数量,说明');
    expect(txnCsv).toContain('发放');
    expect(txnCsv.split('\r\n')).toHaveLength(1 + 3);

    const batchCsv = batchesToCsv(s.batches);
    expect(batchCsv).toContain('批次号,物资名称,类别');
    expect(batchCsv).toContain('可发放');
  });
});
