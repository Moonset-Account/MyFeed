import { useMemo, useState } from 'react';
import {
  EXPIRY_LABEL,
  STATUS_LABEL,
  TXN_LABEL,
  expiryLevel,
  remainingOf,
  type Batch,
  type Txn,
} from '../lib/domain';

interface Props {
  batches: Batch[];
  txns: Txn[];
  today: string;
}

export default function TracePanel({ batches, txns, today }: Props) {
  const [keyword, setKeyword] = useState('');

  const matched = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return [];
    return batches.filter((b) => b.batchNo.includes(kw) || b.name.includes(kw));
  }, [batches, keyword]);

  const [selectedId, setSelectedId] = useState('');
  const selected = matched.find((b) => b.id === selectedId) ?? matched[0];

  const history = useMemo(() => {
    if (!selected) return [];
    return txns
      .filter((t) => t.batchId === selected.id)
      .sort((a, b) => a.at.localeCompare(b.at));
  }, [txns, selected]);

  return (
    <section className="card">
      <h2>批次追溯</h2>
      <p className="hint">输入批次号或物资名称，查看该批次的入库、质检与发放全流程记录。</p>

      <div className="toolbar">
        <input
          placeholder="输入批次号（如 PC20260930-01）或物资名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setSelectedId('');
          }}
        />
      </div>

      {keyword.trim() && matched.length === 0 && <div className="alert">未找到匹配的批次。</div>}

      {matched.length > 1 && (
        <div className="trace-list">
          {matched.map((b) => (
            <button
              key={b.id}
              className={selected?.id === b.id ? 'chip active' : 'chip'}
              onClick={() => setSelectedId(b.id)}
            >
              {b.batchNo} · {b.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="batch-summary detail">
            <span>
              批次号：<strong className="mono">{selected.batchNo}</strong>
            </span>
            <span>
              物资：{selected.name}（{selected.category}）
            </span>
            <span>
              库存：{remainingOf(selected, txns)} / {selected.quantity} {selected.unit}
            </span>
            <span>有效期：{selected.expiryDate || '无'}</span>
            <span>
              临期状态：
              <span className={`tag tag-${expiryLevel(selected, today)}`}>
                {EXPIRY_LABEL[expiryLevel(selected, today)]}
              </span>
            </span>
            <span>存放位置：{selected.location}</span>
            <span>
              质检状态：
              <span className={`tag status-${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
            </span>
            <span>捐赠方：{selected.donor || '—'}</span>
            {selected.note && <span>备注：{selected.note}</span>}
          </div>

          <h3>流转记录</h3>
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>数量</th>
                <th>经手人</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{new Date(t.at).toLocaleString('zh-CN')}</td>
                  <td>{TXN_LABEL[t.type]}</td>
                  <td>{t.type === 'inspect' ? '—' : t.quantity}</td>
                  <td>{t.operator}</td>
                  <td>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
