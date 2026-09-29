/**
 * localStorage 持久化 + 演示种子数据。纯浏览器本地运行，离线可用。
 */
import {
  genId,
  nowIso,
  todayStr,
  type Batch,
  type InboundInput,
  type Txn,
} from './domain';

const KEY = 'donation-sorting-station-v1';

export interface AppState {
  batches: Batch[];
  txns: Txn[];
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.batches) && Array.isArray(parsed.txns)) return parsed;
    }
  } catch {
    // 数据损坏时回退到种子数据
  }
  return seedState();
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState(): AppState {
  const seed = seedState();
  saveState(seed);
  return seed;
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seedState(): AppState {
  const mk = (input: InboundInput & { batchNo: string; receivedAt: string }): Batch => ({
    id: genId(),
    ...input,
  });
  const today = todayStr();
  const batches: Batch[] = [
    mk({
      batchNo: `PC${today.replaceAll('-', '')}-01`,
      name: '矿泉水 550ml',
      category: '饮用水',
      quantity: 200,
      unit: '瓶',
      expiryDate: daysFromToday(20),
      location: 'A区-01架',
      status: 'available',
      donor: '爱心超市',
      note: '临期，优先发放',
      receivedAt: nowIso(),
    }),
    mk({
      batchNo: `PC${today.replaceAll('-', '')}-02`,
      name: '方便面',
      category: '食品',
      quantity: 60,
      unit: '箱',
      expiryDate: daysFromToday(180),
      location: 'B区-02架',
      status: 'available',
      donor: '社区居民',
      note: '',
      receivedAt: nowIso(),
    }),
    mk({
      batchNo: `PC${today.replaceAll('-', '')}-03`,
      name: '冬季棉被',
      category: '衣物',
      quantity: 40,
      unit: '床',
      expiryDate: '',
      location: 'C区-大件区',
      status: 'pending',
      donor: '纺织厂捐赠',
      note: '待抽检',
      receivedAt: nowIso(),
    }),
    mk({
      batchNo: `PC${today.replaceAll('-', '')}-04`,
      name: '罐头食品',
      category: '食品',
      quantity: 30,
      unit: '罐',
      expiryDate: daysFromToday(-10),
      location: '隔离区',
      status: 'rejected',
      donor: '个人捐赠',
      note: '已过期，待销毁',
      receivedAt: nowIso(),
    }),
  ];
  const txns: Txn[] = batches.map((b) => ({
    id: genId(),
    type: 'inbound',
    batchId: b.id,
    batchNo: b.batchNo,
    name: b.name,
    quantity: b.quantity,
    operator: '系统初始化',
    at: b.receivedAt,
    note: '演示数据入库',
  }));
  return { batches, txns };
}
