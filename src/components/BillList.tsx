import type { Bill, Person } from '../types';
import { allocateBill, categoryLabel, formatCurrency, methodLabel, monthOf } from '../core/finance';

interface BillListProps {
  bills: Bill[];
  people: Person[];
  editingId?: string;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
}

export function BillList({ bills, people, editingId, onEdit, onDelete }: BillListProps) {
  if (bills.length === 0) {
    return <div className="empty-state">这个月还没有账单。</div>;
  }

  return (
    <div className="bill-list">
      {bills.map((bill) => {
        const allocation = allocateBill(bill);
        const name = (id: string) => people.find((person) => person.id === id)?.name ?? id;
        return (
          <article className={`card bill-card ${editingId === bill.id ? 'editing' : ''}`} key={bill.id}>
            <div className="bill-head">
              <div>
                <span className="tag">{categoryLabel(bill.category)}</span>
                <h3>{bill.title}</h3>
                <p>{bill.date} · {monthOf(bill.date)} · {methodLabel(bill.method)}</p>
              </div>
              <strong>{formatCurrency(bill.amount)}</strong>
            </div>
            <div className="split-lines">
              <div>
                <span>每人应付</span>
                <p>{bill.participantIds.map((id) => `${name(id)} ${formatCurrency(allocation[id] ?? 0)}`).join('；')}</p>
              </div>
              <div>
                <span>实际已付</span>
                <p>{Object.entries(bill.paid).filter(([, value]) => value > 0).map(([id, value]) => `${name(id)} ${formatCurrency(value)}`).join('；')}</p>
              </div>
              {bill.note && <div><span>付款备注</span><p>{bill.note}</p></div>}
            </div>
            <div className="card-actions">
              <button className="button subtle small" onClick={() => onEdit(bill)}>修改并重算</button>
              <button className="button danger small" onClick={() => onDelete(bill)}>删除</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
