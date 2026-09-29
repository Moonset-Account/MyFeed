import { useState } from 'react';
import type { InventoryState } from '../lib/types';
import { STATUS_LABEL } from '../lib/types';
import { expiringBatches, inspectBatch, summarizeStock } from '../lib/inventory';
import type { ApplyResult } from '../App';

interface Props {
  state: InventoryState;
  apply: (fn: (s: InventoryState) => InventoryState, okMessage: string) => ApplyResult;
}

export default function StockView({ state, apply }: Props) {
  const [msg, setMsg] = useState<ApplyResult | null>(null);
  const expiring = expiringBatches(state.batches);
  const expired = expiring.filter((e) => e.daysLeft < 0);
  const soon = expiring.filter((e) => e.daysLeft >= 0);
  const summary = summarizeStock(state.batches);
  const pending = state.batches.filter((b) => b.status === 'pending');

  function inspect(batchId: string, pass: boolean) {
    setMsg(apply((s) => inspectBatch(s, batchId, pass), pass ? '已标记为可发放' : '已标记为不合格'));
  }

  return (
    <>
      {msg && <div className={`message ${msg.ok ? 'ok' : 'error'}`}>{msg.message}</div>}

      {expired.length > 0 && (
        <div className="alert expired">
          <h3>已过期 {expired.length} 批，请尽快下架处理</h3>
          <table>
            <tbody>
              {expired.map((e) => (
                <tr key={e.batch.id}>
                  <td>{e.batch.id}</td>
                  <td>{e.batch.itemName}</td>
                  <td>剩余 {e.batch.remaining} {e.batch.unit}</td>
                  <td>{e.batch.location}</td>
                  <td><span className="tag expired">已过期 {-e.daysLeft} 天</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {soon.length > 0 && (
        <div className="alert">
          <h3>临期物资 {soon.length} 批（30 天内到期），发放时将优先出库</h3>
          <table>
            <tbody>
              {soon.map((e) => (
                <tr key={e.batch.id}>
                  <td>{e.batch.id}</td>
                  <td>{e.batch.itemName}</td>
                  <td>剩余 {e.batch.remaining} {e.batch.unit}</td>
                  <td>{e.batch.location}</td>
                  <td>
                    <span className="tag soon">
                      {e.daysLeft === 0 ? '今天到期' : `${e.daysLeft} 天后到期`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>库存总览（按物资汇总）</h2>
        {summary.length === 0 ? (
          <p className="muted">暂无库存。</p>
        ) : (
          <table>
            <thead>
              <tr><th>物资</th><th>类别</th><th>可发放</th><th>待检查</th><th>不合格</th></tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.itemName}>
                  <td>{s.itemName}</td>
                  <td>{s.category}</td>
                  <td><strong>{s.available}</strong> {s.unit}</td>
                  <td>{s.pending} {s.unit}</td>
                  <td>{s.rejected} {s.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>待检查批次（{pending.length}）</h2>
        {pending.length === 0 ? (
          <p className="muted">没有待检查的批次。</p>
        ) : (
          <table>
            <thead>
              <tr><th>批次号</th><th>物资</th><th>数量</th><th>有效期</th><th>位置</th><th>质检操作</th></tr>
            </thead>
            <tbody>
              {pending.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.itemName}</td>
                  <td>{b.remaining} {b.unit}</td>
                  <td>{b.expiryDate || '无'}</td>
                  <td>{b.location}</td>
                  <td>
                    <div className="row">
                      <button className="btn small ok" onClick={() => inspect(b.id, true)}>合格</button>
                      <button className="btn small bad" onClick={() => inspect(b.id, false)}>不合格</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>全部批次</h2>
        <table>
          <thead>
            <tr><th>批次号</th><th>物资</th><th>剩余/入库</th><th>有效期</th><th>位置</th><th>状态</th></tr>
          </thead>
          <tbody>
            {state.batches.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.itemName}</td>
                <td>{b.remaining} / {b.quantity} {b.unit}</td>
                <td>{b.expiryDate || '无'}</td>
                <td>{b.location}</td>
                <td><span className={`tag ${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
