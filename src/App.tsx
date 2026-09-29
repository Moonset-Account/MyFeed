import { useEffect, useMemo, useState } from 'react';
import type { InventoryState } from './lib/types';
import { expiringBatches } from './lib/inventory';
import { loadState, saveState } from './lib/storage';
import { seedState } from './seed';
import InboundForm from './components/InboundForm';
import StockView from './components/StockView';
import DistributeForm from './components/DistributeForm';
import TraceView from './components/TraceView';
import RecordsView from './components/RecordsView';

type Tab = 'inbound' | 'stock' | 'distribute' | 'trace' | 'records';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inbound', label: '入库登记' },
  { key: 'stock', label: '库存总览' },
  { key: 'distribute', label: '物资发放' },
  { key: 'trace', label: '批次追溯' },
  { key: 'records', label: '收发记录' },
];

export interface ApplyResult {
  ok: boolean;
  message: string;
}

export default function App() {
  const [state, setState] = useState<InventoryState>(loadState);
  const [tab, setTab] = useState<Tab>('inbound');

  useEffect(() => {
    saveState(state);
  }, [state]);

  const expiring = useMemo(() => expiringBatches(state.batches), [state.batches]);

  /** 执行一次状态变更；核心逻辑抛错时转为错误提示 */
  function apply(fn: (s: InventoryState) => InventoryState, okMessage: string): ApplyResult {
    try {
      setState((prev) => fn(prev));
      return { ok: true, message: okMessage };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  return (
    <>
      <header className="app-header">
        <h1>捐赠物资分拣台</h1>
        <p>登记 · 质检 · 发放 · 追溯 —— 数据保存在本机浏览器，离线可用</p>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'stock' && expiring.length > 0 && (
              <span className="badge">{expiring.length}</span>
            )}
          </button>
        ))}
      </nav>
      <main>
        {state.batches.length === 0 && (
          <div className="card">
            <p className="muted">当前仓库为空。可以在「入库登记」录入物资，或载入一批示例数据快速体验。</p>
            <button className="btn secondary" onClick={() => setState(seedState())}>
              载入示例数据
            </button>
          </div>
        )}
        {tab === 'inbound' && <InboundForm state={state} apply={apply} />}
        {tab === 'stock' && <StockView state={state} apply={apply} />}
        {tab === 'distribute' && <DistributeForm state={state} apply={apply} />}
        {tab === 'trace' && <TraceView state={state} />}
        {tab === 'records' && <RecordsView state={state} />}
      </main>
    </>
  );
}
