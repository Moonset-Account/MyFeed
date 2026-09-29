import { useState } from 'react';
import type { Payment, Person } from '../types';
import { centsToYuan, validatePayment, yuanToCents } from '../core/finance';
import { createId } from '../core/id';
import { todayLocalDate } from '../core/date';

interface PaymentFormProps {
  people: Person[];
  initialPayment?: Payment;
  onSubmit: (payment: Payment) => void;
  onCancel?: () => void;
}

export function PaymentForm({ people, initialPayment, onSubmit, onCancel }: PaymentFormProps) {
  const [date, setDate] = useState(initialPayment?.date ?? todayLocalDate());
  const [payerId, setPayerId] = useState(initialPayment?.payerId ?? people[0]?.id ?? '');
  const [payeeId, setPayeeId] = useState(initialPayment?.payeeId ?? people.find((person) => person.id !== payerId)?.id ?? people[1]?.id ?? '');
  const [amount, setAmount] = useState(initialPayment ? centsToYuan(initialPayment.amount).toFixed(2) : '');
  const [note, setNote] = useState(initialPayment?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = yuanToCents(Number(amount));
    const validation = validatePayment({ payerId, payeeId, amount: amountCents }, people);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    const now = new Date().toISOString();
    onSubmit({
      id: initialPayment?.id ?? createId('payment'),
      date,
      payerId,
      payeeId,
      amount: amountCents,
      note: note.trim(),
      createdAt: initialPayment?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <form className="card compact-form" onSubmit={submit}>
      <h2>{initialPayment ? '修改付款备注' : '记录月结付款'}</h2>
      <div className="payment-grid">
        <label>日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>付款人
          <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label>收款人
          <select value={payeeId} onChange={(event) => setPayeeId(event.target.value)}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label>金额（元）<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
      </div>
      <label className="full-label">付款备注<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：微信转账，结清 9 月差额" /></label>
      {errors.length > 0 && <ul className="error-list">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      <div className="button-row">
        <button className="button primary" type="submit" disabled={people.length < 2}>{initialPayment ? '保存修改' : '添加付款记录'}</button>
        {initialPayment && onCancel && <button type="button" className="button subtle" onClick={onCancel}>取消</button>}
      </div>
    </form>
  );
}
