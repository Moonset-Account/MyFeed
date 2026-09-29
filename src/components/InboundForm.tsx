import { useState } from 'react';
import type { FormEvent } from 'react';
import type { InventoryState } from '../lib/types';
import { STATUS_LABEL } from '../lib/types';
import { addInbound } from '../lib/inventory';
import { formatTime } from '../lib/csv';
import type { ApplyResult } from '../App';

interface Props {
  state: InventoryState;
  apply: (fn: (s: InventoryState) => InventoryState, okMessage: string) => ApplyResult;
}

const CATEGORIES = ['食品', '饮品', '粮油', '生活用品', '衣物', '药品', '学习用品', '其他'];

export default function InboundForm({ state, apply }: Props) {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [unit, setUnit] = useState('件');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<ApplyResult | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = apply(
      (s) =>
        addInbound(s, {
          itemName,
          category,
          unit,
          quantity: Number(quantity),
          expiryDate,
          location,
          note,
        }),
      `已入库，新批次标记为「待检查」，请前往「库存总览」完成质检`,
    );
    setMsg(result);
    if (result.ok) {
      setItemName('');
      setQuantity('');
      setExpiryDate('');
      setLocation('');
      setNote('');
    }
  }

  const recent = [...state.batches].slice(-5).reverse();

  return (
    <>
      <div className="card">
        <h2>入库登记</h2>
        {msg && <div className={`message ${msg.ok ? 'ok' : 'error'}`}>{msg.message}</div>}
        <form className="grid" onSubmit={onSubmit}>
          <label className="field">
            物资名称 *
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="如：矿泉水" required />
          </label>
          <label className="field">
            类别
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            数量 *
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </label>
          <label className="field">
            单位
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="件 / 箱 / 袋" />
          </label>
          <label className="field">
            有效期至（可留空）
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
          <label className="field">
            存放位置 *
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="如：A区-1架" required />
          </label>
          <label className="field">
            备注
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="捐赠人、批次说明等" />
          </label>
          <div>
            <button className="btn" type="submit">登记入库</button>
          </div>
        </form>
        <p className="muted">新批次入库后默认为「待检查」，质检合格后才能发放。</p>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2>最近入库</h2>
          <table>
            <thead>
              <tr>
                <th>批次号</th><th>物资</th><th>数量</th><th>有效期</th><th>位置</th><th>状态</th><th>入库时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.itemName}</td>
                  <td>{b.quantity} {b.unit}</td>
                  <td>{b.expiryDate || '无'}</td>
                  <td>{b.location}</td>
                  <td><span className={`tag ${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                  <td>{formatTime(b.inboundAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
