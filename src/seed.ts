import type { Batch, InventoryState, Txn } from './lib/types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 生成一批演示数据：不同状态、含临期与已过期批次 */
export function seedState(): InventoryState {
  const now = new Date().toISOString();
  const mk = (
    id: string,
    itemName: string,
    category: string,
    unit: string,
    quantity: number,
    remaining: number,
    expiryDays: number | null,
    location: string,
    status: Batch['status'],
    note = '',
  ): Batch => ({
    id,
    itemName,
    category,
    unit,
    quantity,
    remaining,
    expiryDate: expiryDays === null ? '' : isoDaysFromNow(expiryDays),
    location,
    status,
    inboundAt: now,
    note,
  });

  const batches: Batch[] = [
    mk('B-DEMO-001', '矿泉水', '饮品', '箱', 50, 50, 300, 'A区-1架', 'available'),
    mk('B-DEMO-002', '纯牛奶', '食品', '箱', 30, 18, 12, 'A区-2架', 'available', '临期，优先发放'),
    mk('B-DEMO-003', '面包', '食品', '袋', 40, 25, -2, 'A区-2架', 'available', '已过期，待处理'),
    mk('B-DEMO-004', '大米', '粮油', '袋', 100, 100, 540, 'B区-1架', 'available'),
    mk('B-DEMO-005', '棉被', '生活用品', '床', 20, 20, null, 'C区-1架', 'pending'),
    mk('B-DEMO-006', '罐头', '食品', '箱', 15, 15, 200, 'A区-3架', 'rejected', '外包装破损'),
  ];

  const txns: Txn[] = batches.map((b, i) => ({
    id: `T-DEMO-${i + 1}`,
    type: 'in',
    batchId: b.id,
    itemName: b.itemName,
    quantity: b.quantity,
    at: now,
    detail: `入库 ${b.quantity} ${b.unit}，存放于 ${b.location}`,
  }));
  txns.push(
    { id: 'T-DEMO-101', type: 'inspect', batchId: 'B-DEMO-001', itemName: '矿泉水', quantity: 50, at: now, detail: '质检合格，标记为可发放' },
    { id: 'T-DEMO-102', type: 'inspect', batchId: 'B-DEMO-002', itemName: '纯牛奶', quantity: 30, at: now, detail: '质检合格，标记为可发放' },
    { id: 'T-DEMO-103', type: 'out', batchId: 'B-DEMO-002', itemName: '纯牛奶', quantity: 12, at: now, detail: '发放 12 给 阳光社区' },
    { id: 'T-DEMO-104', type: 'inspect', batchId: 'B-DEMO-006', itemName: '罐头', quantity: 15, at: now, detail: '质检不合格，禁止发放' },
  );

  return { batches, txns };
}
