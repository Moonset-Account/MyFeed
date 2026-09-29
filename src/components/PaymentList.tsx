import type { Payment, Person } from '../types';
import { formatCurrency } from '../core/finance';

interface PaymentListProps {
  payments: Payment[];
  people: Person[];
  editingId?: string;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
}

export function PaymentList({ payments, people, editingId, onEdit, onDelete }: PaymentListProps) {
  const name = (id: string) => people.find((person) => person.id === id)?.name ?? id;
  if (payments.length === 0) return <p className="muted">暂无月结付款记录。</p>;

  return (
    <div className="payment-records">
      {payments.map((payment) => (
        <article key={payment.id} className={`payment-record ${editingId === payment.id ? 'editing' : ''}`}>
          <div>
            <strong>{name(payment.payerId)} → {name(payment.payeeId)} {formatCurrency(payment.amount)}</strong>
            <p>{payment.date}{payment.note ? ` · ${payment.note}` : ''}</p>
          </div>
          <div className="card-actions">
            <button className="button subtle small" onClick={() => onEdit(payment)}>修改</button>
            <button className="button danger small" onClick={() => onDelete(payment)}>删除</button>
          </div>
        </article>
      ))}
    </div>
  );
}
