import { useMemo, useState } from 'react';
import {
  CATEGORIES,
  EXPIRY_LABEL,
  STATUS_LABEL,
  daysToExpiry,
  expiryLevel,
  remainingOf,
  type Batch,
  type InspectStatus,
  type Txn,
} from '../lib/domain';

interface Props {
  batches: Batch[];
  txns: Txn[];
  today: string;
  onInspect: (batchId: string, to: InspectStatus, operator: string) => string | null;
}

export default function InventoryTable({ batches, txns, today, onInspect }: Props) {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');

  const rows = useMemo(() => {
    return batches
      .map((b) => ({ batch: b, remaining: remainingOf(b, txns), level: expiryLevel(b, today) }))
      .filter((r) => !category || r.batch.category === category)
      .filter((r) => !status || r.batch.status === status)
      .filter(
        (r) =>
          !keyword ||
          r.batch.name.includes(keyword) ||
          r.batch.batchNo.includes(keyword) ||
          r.batch.location.includes(keyword),
      );
  }, [batches, txns, today, category, status, keyword]);

  function inspect(batchId: string, to: InspectStatus) {
    const operator = window.prompt('请输入经手人姓名：', '值班员') ?? '';
    if (!operator.trim()) return;
    const err = onInspect(batchId, to, operator.trim());
    setError(err ?? '');
  }

  return (
    <section>
      <div className="toolbar">
        <input
          placeholder="搜索名称 / 批次号 / 位置"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">全部类别</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待检查</option>
          <option value="available">可发放</option>
          <option value="rejected">不合格</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>批次号</th>
            <th>物资</th>
            <th>类别</th>
            <th>库存</th>
            <th>有效期</th>
            <th>存放位置</th>
            <th>质检状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                暂无符合条件的批次
              </td>
            </tr>
          )}
          {rows.map(({ batch, remaining, level }) => {
            const days = daysToExpiry(batch, today);
            return (
              <tr key={batch.id} className={level === 'expired' ? 'row-expired' : level === 'near' ? 'row-near' : ''}>
                <td className="mono">{batch.batchNo}</td>
                <td>{batch.name}</td>
                <td>{batch.category}</td>
                <td>
                  {remaining} / {batch.quantity} {batch.unit}
                </td>
                <td>
                  {batch.expiryDate || '无'}
                  {days !== null && (
                    <span className={`tag tag-${level}`}>
                      {EXPIRY_LABEL[level]}
                      {days >= 0 ? ` ${days}天` : ''}
                    </span>
                  )}
                </td>
                <td>{batch.location}</td>
                <td>
                  <span className={`tag status-${batch.status}`}>{STATUS_LABEL[batch.status]}</span>
                </td>
                <td>
                  {batch.status === 'pending' && (
                    <span className="actions">
                      <button className="btn btn-sm" onClick={() => inspect(batch.id, 'available')}>
                        通过
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => inspect(batch.id, 'rejected')}>
                        不合格
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
