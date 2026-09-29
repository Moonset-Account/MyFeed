import { useEffect, useMemo, useState } from 'react';
import {
  canTransition,
  checkDistribute,
  genId,
  makeBatchNo,
  nowIso,
  remainingOf,
  todayStr,
  validateInbound,
  type Batch,
  type InboundInput,
  type InspectStatus,
  type Txn,
} from './lib/domain';
import { loadState, resetState, saveState, type AppState } from './lib/store';
import InventoryTable from './components/InventoryTable';
import InboundForm from './components/InboundForm';
import DistributePanel from './components/DistributePanel';
import TracePanel from './components/TracePanel';
import TxnLog from './components/TxnLog';

type Tab = 'inventory' | 'inbound' | 'distribute' | 'trace' | 'log';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inventory', label: '库存总览' },
  { key: 'inbound', label: '入库登记' },
  { key: 'distribute', label: '发放出库' },
  { key: 'trace', label: '批次追溯' },
  { key: 'log', label: '收发记录' },
];

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>('inventory');
  const [toast, setToast] = useState('');
  const today = todayStr();

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const nearCount = useMemo(
    () =>
      state.batches.filter((b) => {
        if (b.status !== 'available' || remainingOf(b, state.txns) <= 0) return false;
        if (!b.expiryDate) return false;
        const days = Math.round(
          (Date.parse(b.expiryDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000,
        );
        return days <= 30;
      }).length,
    [state, today],
  );

  function addTxn(partial: Omit<Txn, 'id' | 'at'>): Txn {
    return { ...partial, id: genId(), at: nowIso() };
  }

  function handleInbound(input: InboundInput, operator: string): string | null {
    const error = validateInbound(input);
    if (error) return error;
    const batch: Batch = {
      id: genId(),
      batchNo: makeBatchNo(state.batches, today),
      receivedAt: nowIso(),
      ...input,
    };
    const txn = addTxn({
      type: 'inbound',
      batchId: batch.id,
      batchNo: batch.batchNo,
      name: batch.name,
      quantity: batch.quantity,
      operator,
      note: `入库登记，质检状态：${input.status === 'pending' ? '待检查' : input.status === 'available' ? '可发放' : '不合格'}`,
    });
    setState((s) => ({ batches: [...s.batches, batch], txns: [...s.txns, txn] }));
    setToast(`入库成功，批次号 ${batch.batchNo}`);
    setTab('inventory');
    return null;
  }

  function handleDistribute(batchId: string, qty: number, operator: string, note: string): string | null {
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return '批次不存在';
    const check = checkDistribute(batch, state.txns, qty);
    if (!check.ok) return check.reason ?? '校验失败';
    const txn = addTxn({
      type: 'outbound',
      batchId: batch.id,
      batchNo: batch.batchNo,
      name: batch.name,
      quantity: qty,
      operator,
      note,
    });
    setState((s) => ({ ...s, txns: [...s.txns, txn] }));
    setToast(`已发放 ${batch.name} × ${qty}（批次 ${batch.batchNo}）`);
    return null;
  }

  function handleInspect(batchId: string, to: InspectStatus, operator: string): string | null {
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return '批次不存在';
    if (!canTransition(batch.status, to)) return '当前状态不允许该操作';
    const txn = addTxn({
      type: 'inspect',
      batchId: batch.id,
      batchNo: batch.batchNo,
      name: batch.name,
      quantity: 0,
      operator,
      note: `质检：待检查 → ${to === 'available' ? '可发放' : '不合格'}`,
    });
    setState((s) => ({
      batches: s.batches.map((b) => (b.id === batchId ? { ...b, status: to } : b)),
      txns: [...s.txns, txn],
    }));
    setToast(`批次 ${batch.batchNo} 已标记为${to === 'available' ? '可发放' : '不合格'}`);
    return null;
  }

  function handleReset() {
    if (!window.confirm('确定清空全部数据并恢复演示数据吗？')) return;
    setState(resetState());
    setToast('已恢复演示数据');
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>捐赠物资分拣台</h1>
          <p className="subtitle">公益仓库物资登记 · 质检 · 发放 · 追溯</p>
        </div>
        <button className="btn btn-ghost" onClick={handleReset}>
          恢复演示数据
        </button>
      </header>

      {nearCount > 0 && (
        <div className="alert alert-warn">
          ⚠️ 有 {nearCount} 个可发放批次已过期或 30 天内到期，请优先处理。详见「库存总览」与「发放出库」。
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'inventory' && (
          <InventoryTable
            batches={state.batches}
            txns={state.txns}
            today={today}
            onInspect={handleInspect}
          />
        )}
        {tab === 'inbound' && <InboundForm onSubmit={handleInbound} />}
        {tab === 'distribute' && (
          <DistributePanel
            batches={state.batches}
            txns={state.txns}
            today={today}
            onDistribute={handleDistribute}
          />
        )}
        {tab === 'trace' && <TracePanel batches={state.batches} txns={state.txns} today={today} />}
        {tab === 'log' && <TxnLog batches={state.batches} txns={state.txns} today={today} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
