import { useState } from 'react';
import type { LedgerState } from '../types';
import { newId, today } from '../store';
import { formatYuan, parseYuan } from '../lib/money';

interface Props {
  state: LedgerState;
  setState: React.Dispatch<React.SetStateAction<LedgerState>>;
  month: string;
}

/** 成员间付款记录（还款），带备注，计入月结差额。 */
export function Payments({ state, setState, month }: Props) {
  const [date, setDate] = useState(today());
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name ?? '（已删除成员）';
  const list = state.payments
    .filter((p) => p.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  const submit = () => {
    setError('');
    const cents = parseYuan(amount);
    if (!fromId || !toId) return setError('请选择付款人和收款人');
    if (fromId === toId) return setError('付款人和收款人不能是同一人');
    if (cents === null || cents <= 0) return setError('请输入正确的金额');
    if (!date) return setError('请选择日期');
    setState((s) => ({
      ...s,
      payments: [
        ...s.payments,
        { id: newId(), date, fromId, toId, amountCents: cents, note: note.trim(), createdAt: Date.now() },
      ],
    }));
    setAmount('');
    setNote('');
  };

  const remove = (id: string) => {
    setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
  };

  return (
    <section className="card">
      <h2>付款记录（成员间还款）</h2>
      <div className="grid">
        <label>
          日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          付款人
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">选择</option>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          收款人
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">选择</option>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          金额（元）
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
        </label>
        <label className="span2">
          付款备注
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：9月水电结清" />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button onClick={submit}>记录付款</button>

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>付款人</th>
              <th>收款人</th>
              <th>金额</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{nameOf(p.fromId)}</td>
                <td>{nameOf(p.toId)}</td>
                <td className="num">{formatYuan(p.amountCents)}</td>
                <td>{p.note}</td>
                <td className="actions">
                  <button className="link danger" onClick={() => remove(p.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
