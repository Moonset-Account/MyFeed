import type { Batch, Txn } from './types';
import { STATUS_LABEL, TXN_LABEL } from './types';

/** CSV 单元格转义：含逗号、引号、换行时加引号，引号双写 */
export function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  // 加 BOM 便于 Excel 正确识别中文
  return '﻿' + lines.join('\r\n');
}

/** 收发记录导出 */
export function txnsToCsv(txns: Txn[]): string {
  const sorted = [...txns].sort((a, b) => (a.at < b.at ? -1 : 1));
  return toCsv(
    ['时间', '类型', '批次号', '物资名称', '数量', '说明'],
    sorted.map((t) => [formatTime(t.at), TXN_LABEL[t.type], t.batchId, t.itemName, t.quantity, t.detail]),
  );
}

/** 批次库存导出 */
export function batchesToCsv(batches: Batch[]): string {
  return toCsv(
    ['批次号', '物资名称', '类别', '单位', '入库数量', '剩余数量', '有效期', '存放位置', '状态', '入库时间', '备注'],
    batches.map((b) => [
      b.id,
      b.itemName,
      b.category,
      b.unit,
      b.quantity,
      b.remaining,
      b.expiryDate || '无',
      b.location,
      STATUS_LABEL[b.status],
      formatTime(b.inboundAt),
      b.note,
    ]),
  );
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
