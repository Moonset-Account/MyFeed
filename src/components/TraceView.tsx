import { useMemo, useState } from 'react';
import type { InventoryState } from '../lib/types';
import { STATUS_LABEL, TXN_LABEL } from '../lib/types';
import { batchTrace } from '../lib/inventory';
import { formatTime } from '../lib/csv';

export default function TraceView({ state }: { state: InventoryState }) {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const matches = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return state.batches;
    return state.batches.filter(
      (b) => b.id.toLowerCase().includes(k) || b.itemName.toLowerCase().includes(k),
    );
  }, [state.batches, keyword]);

  const selected = state.batches.find((b) => b.id === selectedId) ?? matches[0];
  const trace = selected ? batchTrace(state.txns, selected.id) : [];

  return (
    <>
      <div className="card">
        <h2>批次追溯</h2>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按批次号或物资名称搜索，如 B2026 或 牛奶"
          />
        </div>
        {matches.length === 0 ? (
          <p className="muted">没有匹配的批次。</p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>批次号</th><th>物资</th><th>剩余/入库</th><th>有效期</th><th>位置</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              {matches.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.itemName}</td>
                  <td>{b.remaining} / {b.quantity} {b.unit}</td>
                  <td>{b.expiryDate || '无'}</td>
                  <td>{b.location}</td>
                  <td><span className={`tag ${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                  <td>
                    <button className="btn small secondary" onClick={() => setSelectedId(b.id)}>
                      追溯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="card">
          <h2>批次 {selected.id} 流转记录</h2>
          <p className="muted">
            {selected.itemName} · {selected.category} · 入库 {selected.quantity} {selected.unit} ·
            剩余 {selected.remaining} {selected.unit} · {STATUS_LABEL[selected.status]}
            {selected.note && ` · 备注：${selected.note}`}
          </p>
          {trace.length === 0 ? (
            <p className="muted">暂无流转记录。</p>
          ) : (
            <table>
              <thead>
                <tr><th>时间</th><th>类型</th><th>数量</th><th>说明</th></tr>
              </thead>
              <tbody>
                {trace.map((t) => (
                  <tr key={t.id}>
                    <td>{formatTime(t.at)}</td>
                    <td>{TXN_LABEL[t.type]}</td>
                    <td>{t.quantity}</td>
                    <td>{t.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
