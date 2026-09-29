/** 批次质检状态：待检查 / 可发放 / 不合格 */
export type BatchStatus = 'pending' | 'available' | 'rejected';

export const STATUS_LABEL: Record<BatchStatus, string> = {
  pending: '待检查',
  available: '可发放',
  rejected: '不合格',
};

/** 入库批次 */
export interface Batch {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  /** 入库数量 */
  quantity: number;
  /** 剩余数量 */
  remaining: number;
  /** 有效期，ISO 日期 yyyy-mm-dd；空字符串表示无有效期 */
  expiryDate: string;
  /** 存放位置 */
  location: string;
  status: BatchStatus;
  /** 入库时间，ISO 日期时间 */
  inboundAt: string;
  note: string;
}

/** 收发记录类型：入库 / 发放 / 质检 */
export type TxnType = 'in' | 'out' | 'inspect';

export const TXN_LABEL: Record<TxnType, string> = {
  in: '入库',
  out: '发放',
  inspect: '质检',
};

/** 收发记录（追溯用） */
export interface Txn {
  id: string;
  type: TxnType;
  batchId: string;
  itemName: string;
  quantity: number;
  at: string;
  detail: string;
}

export interface InventoryState {
  batches: Batch[];
  txns: Txn[];
}
