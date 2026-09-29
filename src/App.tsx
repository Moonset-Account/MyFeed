import { useMemo, useState } from 'react';
import type { Bill } from './types';
import { useLedger, currentMonth } from './store';
import { MemberManager } from './components/MemberManager';
import { BillForm } from './components/BillForm';
import { BillList } from './components/BillList';
import { Payments } from './components/Payments';
import { Settlement } from './components/Settlement';

export default function App() {
  const [state, setState] = useLedger();
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState<Bill | null>(null);

  // 可选月份：已有数据的月份 + 当前月
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth()]);
    for (const b of state.bills) set.add(b.date.slice(0, 7));
    for (const p of state.payments) set.add(p.date.slice(0, 7));
    return [...set].sort().reverse();
  }, [state.bills, state.payments]);

  return (
    <div className="page">
      <header>
        <h1>合住费用分摊本</h1>
        <p className="muted">数据仅保存在本机浏览器，不接入任何支付服务。</p>
        <label className="month-picker">
          月份
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} list="months" />
          <datalist id="months">
            {months.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
      </header>
      <main>
        <MemberManager state={state} setState={setState} />
        <BillForm state={state} setState={setState} editing={editing} onDone={() => setEditing(null)} />
        <BillList state={state} setState={setState} month={month} onEdit={setEditing} />
        <Payments state={state} setState={setState} month={month} />
        <Settlement state={state} setState={setState} month={month} />
      </main>
    </div>
  );
}
