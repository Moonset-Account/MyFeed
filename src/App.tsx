import { useEffect, useMemo, useState } from 'react';
import type { Bill, ExpenseState, MonthlySettlement, Payment, Person } from './types';
import { loadState, saveState } from './core/storage';
import {
  formatCurrency,
  monthOf,
  settlementSuggestions,
  summarizeMonth,
} from './core/finance';
import { billsToCsv, downloadCsv, paymentsToCsv } from './core/csv';
import { createSampleState } from './core/sampleData';
import { createId } from './core/id';
import { BillForm } from './components/BillForm';
import { BillList } from './components/BillList';
import { PaymentForm } from './components/PaymentForm';
import { PaymentList } from './components/PaymentList';
import './styles.css';
import { currentLocalMonth } from './core/date';

const currentMonth = currentLocalMonth();

export default function App() {
  const [state, setState] = useState<ExpenseState>(() => loadState());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingBillId, setEditingBillId] = useState<string>();
  const [editingPaymentId, setEditingPaymentId] = useState<string>();
  const [newPersonName, setNewPersonName] = useState('');
  const [settlementNote, setSettlementNote] = useState('');

  useEffect(() => saveState(state), [state]);

  const months = useMemo(() => {
    const values = [...state.bills.map((bill) => monthOf(bill.date)), ...state.payments.map((payment) => monthOf(payment.date)), currentMonth];
    return Array.from(new Set(values)).sort().reverse();
  }, [state.bills, state.payments]);

  const monthBills = useMemo(
    () => state.bills.filter((bill) => monthOf(bill.date) === selectedMonth).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [state.bills, selectedMonth],
  );
  const monthPayments = useMemo(
    () => state.payments.filter((payment) => monthOf(payment.date) === selectedMonth).sort((a, b) => b.date.localeCompare(a.date)),
    [state.payments, selectedMonth],
  );
  const summaries = useMemo(() => summarizeMonth(selectedMonth, state.people, state.bills, state.payments), [selectedMonth, state.people, state.bills, state.payments]);
  const suggestions = useMemo(() => settlementSuggestions(summaries), [summaries]);
  const totals = useMemo(() => summaries.reduce((acc, item) => ({
    shouldPay: acc.shouldPay + item.shouldPay,
    paid: acc.paid + item.paid,
    paymentVolume: acc.paymentVolume + item.settlementOut,
  }), { shouldPay: 0, paid: 0, paymentVolume: 0 }), [summaries]);
  const settlement = state.settlements.find((item) => item.month === selectedMonth);
  const isStaleSettlement = Boolean(settlement && (settlement.invalidated || [...monthBills, ...monthPayments].some((item) => item.updatedAt > settlement.settledAt)));

  const editingBill = state.bills.find((bill) => bill.id === editingBillId);
  const editingPayment = state.payments.find((payment) => payment.id === editingPaymentId);

  function invalidateSettlement(current: ExpenseState, month: string): ExpenseState {
    return {
      ...current,
      settlements: current.settlements.map((item) => item.month === month ? { ...item, invalidated: true } : item),
    };
  }

  function upsertBill(bill: Bill) {
    setState((current) => {
      const previousMonth = current.bills.find((item) => item.id === bill.id)?.date.slice(0, 7);
      const exists = current.bills.some((item) => item.id === bill.id);
      const next: ExpenseState = {
        ...current,
        bills: exists
          ? current.bills.map((item) => (item.id === bill.id ? bill : item))
          : [bill, ...current.bills],
      };
      return previousMonth && previousMonth !== monthOf(bill.date) ? invalidateSettlement(next, previousMonth) : next;
    });
    setSelectedMonth(monthOf(bill.date));
    setEditingBillId(undefined);
  }

  function deleteBill(bill: Bill) {
    if (!window.confirm(`确定删除「${bill.title}」吗？删除后月汇总会立即重算。`)) return;
    setState((current) => invalidateSettlement({ ...current, bills: current.bills.filter((item) => item.id !== bill.id) }, monthOf(bill.date)));
    setEditingBillId((current) => (current === bill.id ? undefined : current));
  }

  function upsertPayment(payment: Payment) {
    setState((current) => {
      const previousMonth = current.payments.find((item) => item.id === payment.id)?.date.slice(0, 7);
      const exists = current.payments.some((item) => item.id === payment.id);
      const next: ExpenseState = {
        ...current,
        payments: exists
          ? current.payments.map((item) => (item.id === payment.id ? payment : item))
          : [payment, ...current.payments],
      };
      return previousMonth && previousMonth !== monthOf(payment.date) ? invalidateSettlement(next, previousMonth) : next;
    });
    setSelectedMonth(monthOf(payment.date));
    setEditingPaymentId(undefined);
  }

  function deletePayment(payment: Payment) {
    if (!window.confirm('确定删除这条付款记录吗？')) return;
    setState((current) => invalidateSettlement({ ...current, payments: current.payments.filter((item) => item.id !== payment.id) }, monthOf(payment.date)));
    setEditingPaymentId((current) => (current === payment.id ? undefined : current));
  }

  function addPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    if (state.people.some((person) => person.name === name)) {
      window.alert('成员名称不能重复。');
      return;
    }
    const person: Person = { id: createId('person'), name };
    setState((current) => ({ ...current, people: [...current.people, person] }));
    setNewPersonName('');
  }

  function deletePerson(person: Person) {
    const used = state.bills.some((bill) => bill.participantIds.includes(person.id) || bill.paid[person.id] != null)
      || state.payments.some((payment) => payment.payerId === person.id || payment.payeeId === person.id);
    if (used) {
      window.alert(`${person.name} 已参与账单或付款记录。请先修改相关记录后再删除。`);
      return;
    }
    setState((current) => ({ ...current, people: current.people.filter((item) => item.id !== person.id) }));
  }

  function markSettled() {
    const record: MonthlySettlement = {
      month: selectedMonth,
      settledAt: new Date().toISOString(),
      note: settlementNote.trim() || '已完成本月核对，后续改动将提示重新月结。',
      invalidated: false,
    };
    setState((current) => ({
      ...current,
      settlements: [record, ...current.settlements.filter((item) => item.month !== selectedMonth)],
    }));
    setSettlementNote('');
  }

  function resetDemo() {
    if (!window.confirm('将清空当前浏览器中的数据并恢复示例，确定继续吗？')) return;
    setState(createSampleState());
    setSelectedMonth(currentMonth);
    setEditingBillId(undefined);
    setEditingPaymentId(undefined);
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <p className="eyebrow">离线本地记录 · 不接入支付</p>
          <h1>合住费用分摊本</h1>
          <p>记录房租、水电和采购，按人均、比例或指定金额分摊，修改后自动重算每个人的差额。</p>
        </div>
        <div className="header-actions">
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {months.map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
          <button className="button subtle" onClick={resetDemo}>恢复示例</button>
        </div>
      </header>

      <section className="metrics" aria-label="月度汇总">
        <div className="card metric-card"><span>本月账单</span><strong>{formatCurrency(totals.shouldPay)}</strong></div>
        <div className="card metric-card"><span>实际已付</span><strong>{formatCurrency(totals.paid)}</strong></div>
        <div className="card metric-card"><span>已记录付款</span><strong>{formatCurrency(totals.paymentVolume)}</strong></div>
        <div className={`card metric-card status ${settlement ? (isStaleSettlement ? 'warn' : 'done') : 'pending'}`}>
          <span>月结状态</span>
          <strong>{!settlement ? '未月结' : isStaleSettlement ? '需重新月结' : '已月结'}</strong>
          {settlement && <small>{new Date(settlement.settledAt).toLocaleString('zh-CN')}</small>}
        </div>
      </section>

      <section className="layout two-column">
        <div className="primary-column">
          {editingBill ? (
            <BillForm people={state.people} initialBill={editingBill} onSubmit={upsertBill} onCancel={() => setEditingBillId(undefined)} />
          ) : (
            <BillForm people={state.people} onSubmit={upsertBill} onCancel={() => undefined} />
          )}
          <div className="section-title">
            <h2>{selectedMonth} 账单</h2>
            <button className="button subtle" disabled={monthBills.length === 0} onClick={() => downloadCsv(`bills-${selectedMonth}.csv`, billsToCsv(monthBills, state.people))}>导出账单 CSV</button>
          </div>
          <BillList bills={monthBills} people={state.people} editingId={editingBillId} onEdit={(bill) => { setEditingBillId(bill.id); setEditingPaymentId(undefined); setSelectedMonth(monthOf(bill.date)); }} onDelete={deleteBill} />
        </div>

        <aside className="side-column">
          <section className="card people-card">
            <h2>成员</h2>
            <div className="people-list">
              {state.people.map((person) => (
                <span className="person-chip" key={person.id}>
                  {person.name}
                  <button type="button" aria-label={`删除 ${person.name}`} onClick={() => deletePerson(person)}>×</button>
                </span>
              ))}
            </div>
            <div className="add-person">
              <input value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} placeholder="新增成员姓名" onKeyDown={(event) => event.key === 'Enter' && addPerson()} />
              <button className="button subtle" type="button" onClick={addPerson}>添加</button>
            </div>
          </section>

          <section className="card summary-card">
            <div className="card-titlebar"><h2>每人差额</h2></div>
            <table>
              <thead><tr><th>成员</th><th>应付</th><th>已付</th><th>净差额</th></tr></thead>
              <tbody>
                {summaries.map((item) => (
                  <tr key={item.personId}>
                    <td>{item.name}</td>
                    <td>{formatCurrency(item.shouldPay)}</td>
                    <td>{formatCurrency(item.paid)}</td>
                    <td className={item.netBalance === 0 ? 'zero' : item.netBalance > 0 ? 'positive' : 'negative'}>
                      {item.netBalance > 0 ? '待收回 ' : item.netBalance < 0 ? '待支付 ' : '已平账 '}{formatCurrency(Math.abs(item.netBalance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="form-hint">净差额 = 账单已付 − 本人应付 − 月结转出 + 月结转入。</p>
          </section>

          <section className="card suggestions-card">
            <h2>建议付款路径</h2>
            {suggestions.length === 0 ? <p className="muted">本月账单差额已经平账。</p> : (
              <ol className="suggestions">
                {suggestions.map((item) => <li key={`${item.fromId}-${item.toId}`}><strong>{item.fromName}</strong> 付给 <strong>{item.toName}</strong> <b>{formatCurrency(item.amount)}</b></li>)}
              </ol>
            )}
          </section>

          {editingPayment ? (
            <PaymentForm people={state.people} initialPayment={editingPayment} onSubmit={upsertPayment} onCancel={() => setEditingPaymentId(undefined)} />
          ) : (
            <PaymentForm people={state.people} onSubmit={upsertPayment} />
          )}

          <section className="card settlement-card">
            <h2>月结</h2>
            {settlement && (
              <div className={`settlement-banner ${isStaleSettlement ? 'warn' : 'ok'}`}>
                <strong>{isStaleSettlement ? '月结后有改动' : '本月已完成核对'}</strong>
                <p>{settlement.note}</p>
              </div>
            )}
            <textarea value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} placeholder="填写月结备注，例如：所有人已核对账单并完成转账。" rows={2} />
            <button className="button primary" type="button" onClick={markSettled}>{settlement ? '重新确认月结' : '标记本月已结'}</button>
          </section>

          <section className="card payments-card">
            <div className="card-titlebar">
              <h2>付款备注</h2>
              <button className="button subtle" disabled={monthPayments.length === 0} onClick={() => downloadCsv(`payments-${selectedMonth}.csv`, paymentsToCsv(monthPayments, state.people))}>导出付款 CSV</button>
            </div>
            <PaymentList payments={monthPayments} people={state.people} editingId={editingPaymentId} onEdit={(payment) => { setEditingPaymentId(payment.id); setEditingBillId(undefined); setSelectedMonth(monthOf(payment.date)); }} onDelete={deletePayment} />
          </section>
        </aside>
      </section>
    </main>
  );
}
