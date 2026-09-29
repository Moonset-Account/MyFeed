import type { Batch, BatchStatus, InventoryState, Txn } from './types';

/** 临期提示阈值（天） */
export const EXPIRY_WARNING_DAYS = 30;

export interface InboundInput {
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  expiryDate: string;
  location: string;
  note?: string;
}

let seq = 0;
/** 生成批次号：B + 日期 + 序号，如 B20260930-001 */
export function nextBatchId(now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  seq += 1;
  return `B${d}-${String(seq).padStart(3, '0')}`;
}

export function nextTxnId(): string {
  seq += 1;
  return `T${Date.now().toString(36)}-${seq}`;
}

function assertPositiveInt(n: number, what: string): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${what}必须是正整数`);
  }
}

/** 入库登记：新批次默认“待检查”，并记录一条入库流水 */
export function addInbound(
  state: InventoryState,
  input: InboundInput,
  now: Date = new Date(),
): InventoryState {
  assertPositiveInt(input.quantity, '入库数量');
  if (!input.itemName.trim()) throw new Error('物资名称不能为空');
  if (!input.location.trim()) throw new Error('存放位置不能为空');

  const batch: Batch = {
    id: nextBatchId(now),
    itemName: input.itemName.trim(),
    category: input.category.trim() || '未分类',
    unit: input.unit.trim() || '件',
    quantity: input.quantity,
    remaining: input.quantity,
    expiryDate: input.expiryDate,
    location: input.location.trim(),
    status: 'pending',
    inboundAt: now.toISOString(),
    note: input.note?.trim() ?? '',
  };
  const txn: Txn = {
    id: nextTxnId(),
    type: 'in',
    batchId: batch.id,
    itemName: batch.itemName,
    quantity: batch.quantity,
    at: batch.inboundAt,
    detail: `入库 ${batch.quantity} ${batch.unit}，存放于 ${batch.location}，标记为待检查`,
  };
  return { batches: [...state.batches, batch], txns: [...state.txns, txn] };
}

/** 质检：待检查批次标记为可发放（pass=true）或不合格（pass=false） */
export function inspectBatch(
  state: InventoryState,
  batchId: string,
  pass: boolean,
  now: Date = new Date(),
): InventoryState {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) throw new Error(`批次 ${batchId} 不存在`);
  if (batch.status !== 'pending') throw new Error(`批次 ${batchId} 已完成质检，不能重复操作`);

  const status: BatchStatus = pass ? 'available' : 'rejected';
  const batches = state.batches.map((b) => (b.id === batchId ? { ...b, status } : b));
  const txn: Txn = {
    id: nextTxnId(),
    type: 'inspect',
    batchId,
    itemName: batch.itemName,
    quantity: batch.remaining,
    at: now.toISOString(),
    detail: pass ? '质检合格，标记为可发放' : '质检不合格，禁止发放',
  };
  return { batches, txns: [...state.txns, txn] };
}

/** 某物资当前可发放库存（仅统计“可发放”批次的剩余量） */
export function availableStock(batches: Batch[], itemName: string): number {
  return batches
    .filter((b) => b.itemName === itemName && b.status === 'available')
    .reduce((sum, b) => sum + b.remaining, 0);
}

export interface Allocation {
  batchId: string;
  take: number;
}

/**
 * 发放分配计划：按 FEFO（先到期先出）排序，临期物资优先发出。
 * 无有效期的批次排在最后。数量超过可用库存时抛错。
 */
export function planDistribution(
  batches: Batch[],
  itemName: string,
  quantity: number,
): Allocation[] {
  assertPositiveInt(quantity, '发放数量');
  const stock = availableStock(batches, itemName);
  if (quantity > stock) {
    throw new Error(`发放数量 ${quantity} 超过「${itemName}」可用库存 ${stock}`);
  }
  const candidates = batches
    .filter((b) => b.itemName === itemName && b.status === 'available' && b.remaining > 0)
    .sort((a, b) => {
      const ea = a.expiryDate || '9999-12-31';
      const eb = b.expiryDate || '9999-12-31';
      if (ea !== eb) return ea < eb ? -1 : 1;
      return a.inboundAt < b.inboundAt ? -1 : 1;
    });

  const plan: Allocation[] = [];
  let left = quantity;
  for (const b of candidates) {
    if (left <= 0) break;
    const take = Math.min(b.remaining, left);
    plan.push({ batchId: b.id, take });
    left -= take;
  }
  return plan;
}

/** 执行发放：扣减批次剩余量并记录发放流水 */
export function applyDistribution(
  state: InventoryState,
  itemName: string,
  quantity: number,
  receiver: string,
  now: Date = new Date(),
): InventoryState {
  const plan = planDistribution(state.batches, itemName, quantity);
  const takeBy = new Map(plan.map((p) => [p.batchId, p.take]));
  const batches = state.batches.map((b) =>
    takeBy.has(b.id) ? { ...b, remaining: b.remaining - takeBy.get(b.id)! } : b,
  );
  const at = now.toISOString();
  const to = receiver.trim() || '未登记领取人';
  const newTxns: Txn[] = plan.map((p) => ({
    id: nextTxnId(),
    type: 'out',
    batchId: p.batchId,
    itemName,
    quantity: p.take,
    at,
    detail: `发放 ${p.take} 给 ${to}`,
  }));
  return { batches, txns: [...state.txns, ...newTxns] };
}

export function daysUntil(dateStr: string, today: Date = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d = new Date(dateStr + 'T00:00:00').getTime();
  return Math.round((d - t) / 86400000);
}

export interface ExpiringBatch {
  batch: Batch;
  daysLeft: number;
}

/**
 * 临期物资：可发放、有剩余、有有效期，且距到期不超过 withinDays 天
 * （含已过期，daysLeft 为负），按剩余天数升序。
 */
export function expiringBatches(
  batches: Batch[],
  withinDays: number = EXPIRY_WARNING_DAYS,
  today: Date = new Date(),
): ExpiringBatch[] {
  return batches
    .filter((b) => b.status === 'available' && b.remaining > 0 && b.expiryDate)
    .map((b) => ({ batch: b, daysLeft: daysUntil(b.expiryDate, today) }))
    .filter((e) => e.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** 批次追溯：某批次的全部流水，按时间升序 */
export function batchTrace(txns: Txn[], batchId: string): Txn[] {
  return txns
    .filter((t) => t.batchId === batchId)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** 库存总览：按物资名称汇总 */
export interface StockSummary {
  itemName: string;
  category: string;
  unit: string;
  available: number;
  pending: number;
  rejected: number;
}

export function summarizeStock(batches: Batch[]): StockSummary[] {
  const map = new Map<string, StockSummary>();
  for (const b of batches) {
    let s = map.get(b.itemName);
    if (!s) {
      s = { itemName: b.itemName, category: b.category, unit: b.unit, available: 0, pending: 0, rejected: 0 };
      map.set(b.itemName, s);
    }
    if (b.status === 'available') s.available += b.remaining;
    else if (b.status === 'pending') s.pending += b.remaining;
    else s.rejected += b.remaining;
  }
  return [...map.values()].sort((a, b) => a.itemName.localeCompare(b.itemName, 'zh'));
}
