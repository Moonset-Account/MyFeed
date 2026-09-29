import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { InventoryState } from '../lib/types';
import { applyDistribution, availableStock, planDistribution, summarizeStock } from '../lib/inventory';
import type { ApplyResult } from '../App';

interface Props {
  state: InventoryState;
  apply: (fn: (s: InventoryState) => InventoryState, okMessage: string) => ApplyResult;
}

export default function DistributeForm({ state, apply }: Props) {
  const items = useMemo(
    () => summarizeStock(state.batches).filter((s) => s.available > 0),
    [state.batches],
  );
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [receiver, setReceiver] = useState('');
  const [msg, setMsg] = useState<ApplyResult | null>(null);

  const selected = itemName || items[0]?.itemName || '';
  const stock = selected ? availableStock(state.batches, selected) : 0;
  const qty = Number(quantity);

  // FEFO 预演：输入合法时展示将从哪些批次出库
  const preview = useMemo(() => {
    if (!selected || !Number.isInteger(qty) || qty <= 0 || qty > stock) return null;
    try {
      return planDistribution(state.batches, selected, qty);
    } catch {
      return null;
    }
  }, [state.batches, selected, qty, stock]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = apply(
      (s) => applyDistribution(s, selected, qty, receiver),
      `已发放 ${qty}，按临期优先自动出库`,
    );
    setMsg(result);
    if (result.ok) {
      setQuantity('');
      setReceiver('');
    }
  }

  const batchOf = (id: string) => state.batches.find((b) => b.id === id);

  return (
    <div className="card">
      <h2>物资发放</h2>
      {msg && <div className={`message ${msg.ok ? 'ok' : 'error'}`}>{msg.message}</div>}
      {items.length === 0 ? (
        <p className="muted">暂无可发放库存。请先入库并完成质检。</p>
      ) : (
        <form className="grid" onSubmit={onSubmit}>
          <label className="field">
            物资（可用库存）
            <select value={selected} onChange={(e) => setItemName(e.target.value)}>
              {items.map((s) => (
                <option key={s.itemName} value={s.itemName}>
                  {s.itemName}（可发放 {s.available} {s.unit}）
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            发放数量（库存 {stock}）
            <input
              type="number"
              min="1"
              max={stock}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label className="field">
            领取人 / 单位
            <input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="如：阳光社区" />
          </label>
          <div>
            <button className="btn" type="submit" disabled={!preview}>确认发放</button>
          </div>
        </form>
      )}

      {Number.isInteger(qty) && qty > stock && selected && (
        <p className="message error">发放数量 {qty} 超过可用库存 {stock}，无法发放。</p>
      )}

      {preview && (
        <>
          <h3>出库预演（临期优先）</h3>
          <table>
            <thead>
              <tr><th>批次号</th><th>有效期</th><th>位置</th><th>本次出库</th></tr>
            </thead>
            <tbody>
              {preview.map((p) => {
                const b = batchOf(p.batchId)!;
                return (
                  <tr key={p.batchId}>
                    <td>{p.batchId}</td>
                    <td>{b.expiryDate || '无'}</td>
                    <td>{b.location}</td>
                    <td>{p.take} {b.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
