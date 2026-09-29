import { useMemo, useState } from 'react';
import type { LedgerState } from '../types';
import { computeMonthBalances, suggestTransfers } from '../lib/settlement';
import { billsToCsv, downloadCsv, paymentsToCsv, settlementToCsv } from '../lib/csv';
import { formatYuan } from '../lib/money';

interface Props {
  state: LedgerState;
  setState: React.Dispatch<React.SetStateAction<LedgerState>>;
  month: string;
}

export function Settlement({ state, setState, month }: Props) {
  const [settleNote, setSettleNote] = useState('');
  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name ?? '（已删除成员）';

  const balances = useMemo(
    () => computeMonthBalances(state.members, state.bills, state.payments, month),
    [state.members, state.bills, state.payments, month],
  );
  const transfers = useMemo(() => suggestTransfers(balances), [balances]);
  const settled = state.settlements.find((s) => s.month === month);
  const allZero = balances.every((b) => b.balance === 0);

  const monthBills = state.bills.filter((b) => b.date.startsWith(month));
  const monthPayments = state.payments.filter((p) => p.date.startsWith(month));

  const markSettled = () => {
    setState((s) => ({
      ...s,
      settlements: [
        ...s.settlements.filter((x) => x.month !== month),
        { month, settledAt: Date.now(), note: settleNote.trim() },
      ],
    }));
    setSettleNote('');
  };
  const unsettle = () => {
    setState((s) => ({ ...s, settlements: s.settlements.filter((x) => x.month !== month) }));
  };

  return (
    <section className="card">
      <h2>
        {month} 月结{' '}
        {settled && (
          <span className="badge">
            已结清 {settled.note && `（${settled.note}）`}
            <button className="link" onClick={unsettle}>
              取消结清
            </button>
          </span>
        )}
      </h2>
      <table>
        <thead>
          <tr>
            <th>成员</th>
            <th>应付</th>
            <th>已付</th>
            <th>转出还款</th>
            <th>收到还款</th>
            <th>差额</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.memberId}>
              <td>{nameOf(b.memberId)}</td>
              <td className="num">{formatYuan(b.owed)}</td>
              <td className="num">{formatYuan(b.paid)}</td>
              <td className="num">{formatYuan(b.transferredOut)}</td>
              <td className="num">{formatYuan(b.transferredIn)}</td>
              <td className={`num ${b.balance > 0 ? 'pos' : b.balance < 0 ? 'neg' : ''}`}>
                {b.balance > 0 ? `应收 ${formatYuan(b.balance)}` : b.balance < 0 ? `应付 ${formatYuan(-b.balance)}` : '已平'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>结清建议</h3>
      {transfers.length === 0 ? (
        <p className="muted">{allZero ? '本月账目已平衡，无需转账。' : '暂无数据。'}</p>
      ) : (
        <ul>
          {transfers.map((t, i) => (
            <li key={i}>
              {nameOf(t.fromId)} 应付给 {nameOf(t.toId)} <strong>{formatYuan(t.amount)} 元</strong>
            </li>
          ))}
        </ul>
      )}

      <div className="row">
        <input
          value={settleNote}
          onChange={(e) => setSettleNote(e.target.value)}
          placeholder="月结备注（可选）"
        />
        <button onClick={markSettled} disabled={!allZero} title={allZero ? '' : '差额全部为零才能标记结清'}>
          标记本月已结清
        </button>
      </div>

      <h3>导出 CSV</h3>
      <div className="row">
        <button className="secondary" onClick={() => downloadCsv(`账单-${month}.csv`, billsToCsv(monthBills, state.members))}>
          导出账单
        </button>
        <button className="secondary" onClick={() => downloadCsv(`付款记录-${month}.csv`, paymentsToCsv(monthPayments, state.members))}>
          导出付款记录
        </button>
        <button className="secondary" onClick={() => downloadCsv(`月结-${month}.csv`, settlementToCsv(month, balances, state.members))}>
          导出月结
        </button>
      </div>
    </section>
  );
}
