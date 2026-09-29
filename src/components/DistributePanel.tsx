import { useMemo, useState } from 'react';
import {
  EXPIRY_LABEL,
  daysToExpiry,
  expiryLevel,
  remainingOf,
  sortByExpiryPriority,
  type Batch,
  type Txn,
} from '../lib/domain';

interface Props {
  batches: Batch[];
  txns: Txn[];
  today: string;
  onDistribute: (batchId: string, qty: number, operator: string, note: string) => string | null;
}

export default function DistributePanel({ batches, txns, today, onDistribute }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('');
  const [operator, setOperator] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // 可发放且有库存的批次，按临期优先排序
  const candidates = useMemo(() => {
    const usable = batches.filter((b) => b.status === 'available' && remainingOf(b, txns) > 0);
    return sortByExpiryPriority(usable, today);
  }, [batches, txns, today]);

  const selected = candidates.find((b) => b.id === selectedId);
  const selectedRemaining = selected ? remainingOf(selected, txns) : 0;
  const selectedDays = selected ? daysToExpiry(selected, today) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('请选择要发放的批次');
      return;
    }
    if (!operator.trim()) {
      setError('请填写经手人');
      return;
    }
    const err = onDistribute(selected.id, Number(qty), operator.trim(), note.trim());
    if (err) {
      setError(err);
      return;
    }
    setQty('');
    setNote('');
    setError('');
  }

  return (
    <section className="card">
      <h2>发放出库</h2>
      <p className="hint">按临期优先排序展示可发放批次；发放数量不得超过该批次剩余库存。</p>

      {candidates.length === 0 && <div className="alert">当前没有可发放的库存批次。</div>}

      {candidates.length > 0 && (
        <form onSubmit={submit} className="form-grid">
          <label className="span-2">
            选择批次（临期优先）*
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">请选择</option>
              {candidates.map((b) => {
                const days = daysToExpiry(b, today);
                const level = expiryLevel(b, today);
                const expiry =
                  days === null ? '无有效期' : `${b.expiryDate}（${EXPIRY_LABEL[level]}${days >= 0 ? ` ${days}天` : ''}）`;
                return (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} · {b.name} · 剩余 {remainingOf(b, txns)} {b.unit} · {expiry}
                  </option>
                );
              })}
            </select>
          </label>

          {selected && (
            <div className="span-2 batch-summary">
              <span>
                存放位置：<strong>{selected.location}</strong>
              </span>
              <span>
                剩余库存：
                <strong>
                  {selectedRemaining} {selected.unit}
                </strong>
              </span>
              {selectedDays !== null && selectedDays <= 30 && (
                <span className={`tag tag-${selectedDays < 0 ? 'expired' : 'near'}`}>
                  {selectedDays < 0 ? '已过期，请谨慎发放' : `临期 ${selectedDays} 天，建议优先发放`}
                </span>
              )}
            </div>
          )}

          <label>
            发放数量 *
            <input
              type="number"
              min={1}
              step={1}
              max={selectedRemaining || undefined}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={selected ? `最多 ${selectedRemaining}` : '先选择批次'}
            />
          </label>
          <label>
            经手人 *
            <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="发放人姓名" />
          </label>
          <label className="span-2">
            去向 / 备注
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：发放给某社区服务站" />
          </label>
          {error && <div className="alert alert-error span-2">{error}</div>}
          <div className="span-2">
            <button type="submit" className="btn btn-primary">
              确认发放
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
