/**
 * 捐赠物资分拣台 —— 核心领域逻辑（纯函数，不依赖 UI / 存储）。
 */

export const CATEGORIES = ['食品', '饮用水', '衣物', '药品', '日用品', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 入库质检状态：待检查 / 可发放 / 不合格 */
export type InspectStatus = 'pending' | 'available' | 'rejected';

export const STATUS_LABEL: Record<InspectStatus, string> = {
  pending: '待检查',
  available: '可发放',
  rejected: '不合格',
};

/** 物资批次（一次入库登记即一个批次） */
export interface Batch {
  id: string;
  batchNo: string; // 批次号，用于追溯
  name: string; // 物资名称
  category: Category;
  quantity: number; // 入库数量
  unit: string; // 计量单位：件 / 箱 / 瓶…
  expiryDate: string; // 有效期，YYYY-MM-DD；无有效期为空串
  location: string; // 存放位置
  status: InspectStatus;
  donor: string; // 捐赠方
  receivedAt: string; // 入库时间 ISO
  note: string;
}

export type TxnType = 'inbound' | 'outbound' | 'inspect';

/** 收发 / 质检记录 */
export interface Txn {
  id: string;
  type: TxnType;
  batchId: string;
  batchNo: string;
  name: string;
  quantity: number; // inbound 为正入库数；outbound 为发放数；inspect 为 0
  operator: string;
  at: string; // ISO 时间
  note: string;
}

export const TXN_LABEL: Record<TxnType, string> = {
  inbound: '入库',
  outbound: '发放',
  inspect: '质检',
};

/* ---------------- 库存计算 ---------------- */

/** 某批次已发放数量 */
export function distributedOf(batchId: string, txns: Txn[]): number {
  return txns
    .filter((t) => t.type === 'outbound' && t.batchId === batchId)
    .reduce((sum, t) => sum + t.quantity, 0);
}

/** 某批次剩余库存 */
export function remainingOf(batch: Batch, txns: Txn[]): number {
  return batch.quantity - distributedOf(batch.id, txns);
}

export interface DistributeCheck {
  ok: boolean;
  reason?: string;
}

/**
 * 发放校验：
 * - 仅“可发放”状态可出库；
 * - 数量必须为正整数；
 * - 不得超过该批次剩余库存。
 */
export function checkDistribute(batch: Batch, txns: Txn[], qty: number): DistributeCheck {
  if (batch.status !== 'available') {
    return { ok: false, reason: `该批次状态为「${STATUS_LABEL[batch.status]}」，不可发放` };
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, reason: '发放数量必须为正整数' };
  }
  const remaining = remainingOf(batch, txns);
  if (qty > remaining) {
    return { ok: false, reason: `发放数量 ${qty} 超过剩余库存 ${remaining}` };
  }
  return { ok: true };
}

/* ---------------- 有效期 / 临期 ---------------- */

export type ExpiryLevel = 'none' | 'expired' | 'near' | 'safe';

export const EXPIRY_LABEL: Record<ExpiryLevel, string> = {
  none: '无有效期',
  expired: '已过期',
  near: '临期',
  safe: '正常',
};

/** 距到期天数（负数表示已过期）；无有效期返回 null */
export function daysToExpiry(batch: Batch, today: string): number | null {
  if (!batch.expiryDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const exp = Date.parse(batch.expiryDate + 'T00:00:00Z');
  const now = Date.parse(today + 'T00:00:00Z');
  return Math.round((exp - now) / msPerDay);
}

/** 临期判定：threshold 天内（含）到期视为临期；已过期单独标记 */
export function expiryLevel(batch: Batch, today: string, nearThresholdDays = 30): ExpiryLevel {
  const days = daysToExpiry(batch, today);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= nearThresholdDays) return 'near';
  return 'safe';
}

/**
 * 发放优先级排序：已过期/临期优先提示，按剩余天数升序；无有效期排最后。
 * 仅用于提示排序，不改变库存数据。
 */
export function sortByExpiryPriority(batches: Batch[], today: string): Batch[] {
  const rank = (b: Batch): number => {
    const days = daysToExpiry(b, today);
    if (days === null) return Number.MAX_SAFE_INTEGER;
    return days;
  };
  return [...batches].sort((a, b) => rank(a) - rank(b));
}

/* ---------------- 入库登记 ---------------- */

export interface InboundInput {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  expiryDate: string;
  location: string;
  status: InspectStatus;
  donor: string;
  note: string;
}

export function validateInbound(input: InboundInput): string | null {
  if (!input.name.trim()) return '请填写物资名称';
  if (!CATEGORIES.includes(input.category)) return '请选择物资类别';
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) return '入库数量必须为正整数';
  if (!input.unit.trim()) return '请填写计量单位';
  if (!input.location.trim()) return '请填写存放位置';
  if (input.expiryDate && Number.isNaN(Date.parse(input.expiryDate))) return '有效期格式不正确';
  return null;
}

/** 生成批次号：PC + 日期 + 序号，如 PC20260930-01 */
export function makeBatchNo(existing: Batch[], date: string, seqWidth = 2): string {
  const compact = date.replaceAll('-', '');
  const prefix = `PC${compact}-`;
  const maxSeq = existing
    .filter((b) => b.batchNo.startsWith(prefix))
    .map((b) => Number(b.batchNo.slice(prefix.length)) || 0)
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(seqWidth, '0')}`;
}

/* ---------------- 质检状态流转 ---------------- */

/** 允许的状态流转：待检查 → 可发放 / 不合格；其余不允许 */
export function canTransition(from: InspectStatus, to: InspectStatus): boolean {
  if (from === to) return false;
  return from === 'pending';
}

/* ---------------- CSV 导出 ---------------- */

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(','));
  // 加 BOM，保证 Excel 直接打开不乱码
  return '﻿' + lines.join('\r\n');
}

/** 收发记录导出为 CSV 文本 */
export function txnsToCsv(txns: Txn[]): string {
  return toCsv(
    ['时间', '类型', '批次号', '物资名称', '数量', '经手人', '备注'],
    txns.map((t) => [t.at, TXN_LABEL[t.type], t.batchNo, t.name, t.quantity, t.operator, t.note]),
  );
}

/** 库存台账导出为 CSV 文本 */
export function batchesToCsv(batches: Batch[], txns: Txn[], today: string): string {
  return toCsv(
    ['批次号', '物资名称', '类别', '入库数量', '已发放', '剩余库存', '单位', '有效期', '临期状态', '存放位置', '质检状态', '捐赠方', '入库时间', '备注'],
    batches.map((b) => [
      b.batchNo,
      b.name,
      b.category,
      b.quantity,
      distributedOf(b.id, txns),
      remainingOf(b, txns),
      b.unit,
      b.expiryDate || '无',
      EXPIRY_LABEL[expiryLevel(b, today)],
      b.location,
      STATUS_LABEL[b.status],
      b.donor,
      b.receivedAt,
      b.note,
    ]),
  );
}

/* ---------------- 工具 ---------------- */

export function todayStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}

export function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
