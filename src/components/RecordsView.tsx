import { useMemo, useState } from 'react';
import type { InventoryState, TxnType } from '../lib/types';
import { TXN_LABEL } from '../lib/types';
import { batchesToCsv, formatTime, txnsToCsv } from '../lib/csv';
import { downloadText, todayStamp } from '../download';

type Filter = 'all' | TxnType;

export default function RecordsView({ state }: { state: InventoryState }) {
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const sorted = [...state.txns].sort((a, b) => (a.at > b.at ? -1 : 1));
    return filter === 'all' ? sorted : sorted.filter((t) => t.type === filter);
  }, [state.txns, filter]);

  function exportTxns(type: Filter) {
    const data = type === 'all' ? state.txns : state.txns.filter((t) => t.type === type);
    const name = type === 'all' ? '收发记录' : `${TXN_LABEL[type]}记录`;
    downloadText(`${name}-${todayStamp()}.csv`, txnsToCsv(data));
  }

  return (
    <>
      <div className="card">
        <h2>导出</h2>
        <div className="row">
          <button className="btn" onClick={() => exportTxns('all')}>导出全部收发记录</button>
          <button className="btn secondary" onClick={() => exportTxns('in')}>入库记录</button>
          <button className="btn secondary" onClick={() => exportTxns('out')}>发放记录</button>
          <button className="btn secondary" onClick={() => exportTxns('inspect')}>质检记录</button>
          <button className="btn secondary" onClick={() => downloadText(`批次库存-${todayStamp()}.csv`, batchesToCsv(state.batches))}>
            批次库存
          </button>
        </div>
        <p className="muted">导出为 CSV 文件（带 BOM，Excel 可直接打开），按时间升序排列。</p>
      </div>

      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>收发记录（{rows.length}）</h2>
          <div className="spacer" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">全部类型</option>
            <option value="in">入库</option>
            <option value="out">发放</option>
            <option value="inspect">质检</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <p className="muted">暂无记录。</p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>时间</th><th>类型</th><th>批次号</th><th>物资</th><th>数量</th><th>说明</th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{formatTime(t.at)}</td>
                  <td>{TXN_LABEL[t.type]}</td>
                  <td>{t.batchId}</td>
                  <td>{t.itemName}</td>
                  <td>{t.quantity}</td>
                  <td>{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
