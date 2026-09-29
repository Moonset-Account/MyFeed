import { useMemo, useState } from 'react';
import {
  TXN_LABEL,
  batchesToCsv,
  txnsToCsv,
  type Batch,
  type Txn,
  type TxnType,
} from '../lib/domain';

interface Props {
  batches: Batch[];
  txns: Txn[];
  today: string;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TxnLog({ batches, txns, today }: Props) {
  const [type, setType] = useState<TxnType | ''>('');
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    return txns
      .filter((t) => !type || t.type === type)
      .filter((t) => !keyword || t.batchNo.includes(keyword) || t.name.includes(keyword))
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [txns, type, keyword]);

  return (
    <section className="card">
      <h2>收发记录</h2>
      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value as TxnType | '')}>
          <option value="">全部类型</option>
          <option value="inbound">入库</option>
          <option value="outbound">发放</option>
          <option value="inspect">质检</option>
        </select>
        <input
          placeholder="按批次号 / 物资名称筛选"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <span className="spacer" />
        <button
          className="btn"
          onClick={() => downloadCsv(`收发记录-${today}.csv`, txnsToCsv(rows))}
        >
          导出收发记录 CSV
        </button>
        <button
          className="btn"
          onClick={() => downloadCsv(`库存台账-${today}.csv`, batchesToCsv(batches, txns, today))}
        >
          导出库存台账 CSV
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>类型</th>
            <th>批次号</th>
            <th>物资名称</th>
            <th>数量</th>
            <th>经手人</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                暂无记录
              </td>
            </tr>
          )}
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="mono">{new Date(t.at).toLocaleString('zh-CN')}</td>
              <td>
                <span className={`tag txn-${t.type}`}>{TXN_LABEL[t.type]}</span>
              </td>
              <td className="mono">{t.batchNo}</td>
              <td>{t.name}</td>
              <td>{t.type === 'inspect' ? '—' : t.quantity}</td>
              <td>{t.operator}</td>
              <td>{t.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
