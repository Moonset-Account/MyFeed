import { useState } from 'react';
import type { LedgerState } from '../types';
import { newId } from '../store';

interface Props {
  state: LedgerState;
  setState: React.Dispatch<React.SetStateAction<LedgerState>>;
}

export function MemberManager({ state, setState }: Props) {
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (state.members.some((m) => m.name === trimmed)) {
      alert('已存在同名成员');
      return;
    }
    setState((s) => ({ ...s, members: [...s.members, { id: newId(), name: trimmed }] }));
    setName('');
  };

  const remove = (id: string) => {
    const used =
      state.bills.some((b) => b.payerId === id || b.shares.some((s) => s.memberId === id)) ||
      state.payments.some((p) => p.fromId === id || p.toId === id);
    if (used) {
      alert('该成员已有账单或付款记录，不能删除（会影响历史账目）');
      return;
    }
    setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
  };

  return (
    <section className="card">
      <h2>成员</h2>
      <div className="row">
        <input
          value={name}
          placeholder="成员姓名"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add}>添加</button>
      </div>
      <ul className="chips">
        {state.members.map((m) => (
          <li key={m.id} className="chip">
            {m.name}
            <button className="link" onClick={() => remove(m.id)} title="删除成员">
              ×
            </button>
          </li>
        ))}
        {state.members.length === 0 && <li className="muted">先添加合住成员，再开始记账</li>}
      </ul>
    </section>
  );
}
