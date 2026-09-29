import type { Bill, LedgerState } from '../types';
import { formatYuan } from '../lib/money';

interface Props {
  state: LedgerState;
  setState: React.Dispatch<React.SetStateAction<LedgerState>>;
  month: string;
  onEdit: (bill: Bill) => void;
}

const SPLIT_LABEL: Record<Bill['splitType'], string> = {
  equal: '人均',
  ratio: '固定比例',
  fixed: '指定金额',
};

export function BillList({ state, setState, month, onEdit }: Props) {
  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name ?? '（已删除成员）';
  const bills = state.bills
    .filter((b) => b.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  const remove = (id: string) => {
    if (!confirm('确定删除这条账单？月结差额会随之重新计算。')) return;
    setState((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) }));
  };

  return (
    <section className="card">
      <h2>{month} 账单（{bills.length} 笔）</h2>
      {bills.length === 0 ? (
        <p className="muted">本月还没有账单</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>标题</th>
              <th>分类</th>
              <th>金额</th>
              <th>付款人</th>
              <th>分摊</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td>
                <td>{b.title}</td>
                <td>{b.category}</td>
                <td className="num">{formatYuan(b.totalCents)}</td>
                <td>{nameOf(b.payerId)}</td>
                <td>
                  {SPLIT_LABEL[b.splitType]}：
                  {b.shares.map((s) => `${nameOf(s.memberId)} ${formatYuan(s.amount)}`).join('，')}
                </td>
                <td>{b.note}</td>
                <td className="actions">
                  <button className="link" onClick={() => onEdit(b)}>
                    修改
                  </button>
                  <button className="link danger" onClick={() => remove(b.id)}>
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
