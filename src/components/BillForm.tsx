import { useMemo, useState } from 'react';
import type { Bill, Category, Person, SplitMethod } from '../types';
import {
  allocateByWeights,
  centsToYuan,
  formatCurrency,
  validateBill,
  yuanToCents,
} from '../core/finance';
import { createId } from '../core/id';
import { todayLocalDate } from '../core/date';

interface BillFormProps {
  people: Person[];
  initialBill?: Bill;
  onSubmit: (bill: Bill) => void;
  onCancel: () => void;
}

interface PayerRow {
  id: string;
  personId: string;
  amount: string;
}

const categories: Category[] = ['rent', 'utilities', 'groceries', 'other'];
const methods: { value: SplitMethod; label: string }[] = [
  { value: 'equal', label: '按人均' },
  { value: 'percent', label: '固定比例' },
  { value: 'fixed', label: '指定金额' },
];

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? yuanToCents(parsed) : NaN;
}

function formatInputCents(cents: number): string {
  return centsToYuan(cents).toFixed(2);
}

function equalPercent(count: number): number {
  return Math.round((100 / count) * 1000) / 1000;
}

export function BillForm({ people, initialBill, onSubmit, onCancel }: BillFormProps) {
  const [date, setDate] = useState(initialBill?.date ?? todayLocalDate());
  const [category, setCategory] = useState<Category>(initialBill?.category ?? 'rent');
  const [title, setTitle] = useState(initialBill?.title ?? '');
  const [amount, setAmount] = useState(initialBill ? centsToYuan(initialBill.amount).toFixed(2) : '');
  const [method, setMethod] = useState<SplitMethod>(initialBill?.method ?? 'equal');
  const [participantIds, setParticipantIds] = useState<string[]>(initialBill?.participantIds ?? people.map((person) => person.id));
  const [percents, setPercents] = useState<Record<string, string>>(
    () => Object.fromEntries(people.map((person) => [person.id, String(initialBill?.shares[person.id] ?? equalPercent(initialBill?.participantIds.length || people.length || 1))])),
  );
  const [fixedShares, setFixedShares] = useState<Record<string, string>>(() => {
    if (initialBill?.method === 'fixed') {
      return Object.fromEntries(people.map((person) => [person.id, formatInputCents(initialBill.shares[person.id] ?? 0)]));
    }
    return Object.fromEntries(people.map((person) => [person.id, '0.00']));
  });
  const [payers, setPayers] = useState<PayerRow[]>(() => {
    const initialPayers = Object.entries(initialBill?.paid ?? {}).filter(([, value]) => value > 0);
    return initialPayers.length
      ? initialPayers.map(([personId, value]) => ({ id: createId('payer'), personId, amount: formatInputCents(value) }))
      : [{ id: createId('payer'), personId: people[0]?.id ?? '', amount: '' }];
  });
  const [note, setNote] = useState(initialBill?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const amountCents = parseAmount(amount);
  const orderedParticipants = useMemo(() => people.filter((person) => participantIds.includes(person.id)), [people, participantIds]);
  const shareCents = useMemo(() => {
    if (!Number.isFinite(amountCents) || orderedParticipants.length === 0) return {};
    if (method === 'fixed') {
      return Object.fromEntries(orderedParticipants.map((person) => [person.id, parseAmount(fixedShares[person.id] ?? '0') || 0]));
    }
    if (method === 'percent') {
      const weights = Object.fromEntries(orderedParticipants.map((person) => [person.id, Number(percents[person.id] ?? 0)]));
      return allocateByWeights(amountCents, weights);
    }
    return allocateByWeights(amountCents, Object.fromEntries(orderedParticipants.map((person) => [person.id, 1])));
  }, [amountCents, fixedShares, method, orderedParticipants, percents]);

  const shareTotal = Object.values(shareCents).reduce((sum, value) => sum + value, 0);
  const effectivePayerRows = payers.length === 1 && payers[0].amount === '' && amount !== ''
    ? [{ ...payers[0], amount }]
    : payers;
  const paidCentsById = effectivePayerRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.personId] = (acc[row.personId] ?? 0) + (parseAmount(row.amount) || 0);
    return acc;
  }, {});
  const paidTotal = Object.values(paidCentsById).reduce((sum, value) => sum + value, 0);
  const shareDifference = Number.isFinite(amountCents) ? amountCents - shareTotal : 0;
  const paidDifference = Number.isFinite(amountCents) ? amountCents - paidTotal : 0;

  function initializeFixedShares(ids: string[], totalCents: number) {
    const allocation = allocateByWeights(
      Number.isFinite(totalCents) ? totalCents : 0,
      Object.fromEntries(ids.map((id) => [id, 1])),
    );
    setFixedShares((previous) => ({
      ...previous,
      ...Object.fromEntries(ids.map((id) => [id, formatInputCents(allocation[id] ?? 0)])),
    }));
  }

  function toggleParticipant(personId: string) {
    setParticipantIds((current) => {
      const exists = current.includes(personId);
      const next = exists ? current.filter((id) => id !== personId) : [...current, personId].sort();
      if (next.length > 0) {
        const equal = equalPercent(next.length);
        setPercents(Object.fromEntries(next.map((id) => [id, String(equal)])));
        if (method === 'fixed') initializeFixedShares(next, amountCents);
      }
      return next;
    });
  }

  function changeMethod(nextMethod: SplitMethod) {
    setMethod(nextMethod);
    if (nextMethod === 'percent' && participantIds.length > 0) {
      const equal = equalPercent(participantIds.length);
      setPercents(Object.fromEntries(participantIds.map((id) => [id, String(equal)])));
    }
    if (nextMethod === 'fixed' && participantIds.length > 0) {
      initializeFixedShares(participantIds, amountCents);
    }
  }

  function updatePayer(rowId: string, patch: Partial<PayerRow>) {
    setPayers((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const billPayload = {
      amount: amountCents,
      method,
      participantIds,
      shares: method === 'fixed'
        ? Object.fromEntries(orderedParticipants.map((person) => [person.id, parseAmount(fixedShares[person.id] ?? '0') || 0]))
        : Object.fromEntries(orderedParticipants.map((person) => [person.id, Number(percents[person.id] ?? 0)])),
      paid: paidCentsById,
    };
    const validation = validateBill(billPayload, people);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const now = new Date().toISOString();
    onSubmit({
      id: initialBill?.id ?? createId('bill'),
      date,
      category,
      title: title.trim() || categoryLabelFallback(category),
      amount: amountCents,
      method,
      participantIds,
      shares: billPayload.shares,
      paid: billPayload.paid,
      note: note.trim(),
      createdAt: initialBill?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <div className="card-titlebar">
        <h2>{initialBill ? '修改账单' : '新增账单'}</h2>
        {initialBill && <button type="button" className="button subtle" onClick={onCancel}>取消修改</button>}
      </div>

      <div className="form-grid">
        <label>日期
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>类别
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {categories.map((item) => <option key={item} value={item}>{categoryLabelFallback(item)}</option>)}
          </select>
        </label>
        <label className="span-2">账单名称
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：10 月房租" />
        </label>
        <label>账单金额（元）
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
        </label>
        <label>分摊方式
          <select value={method} onChange={(event) => changeMethod(event.target.value as SplitMethod)}>
            {methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>分摊成员</legend>
        <div className="checkbox-row">
          {people.map((person) => (
            <label key={person.id} className="check-pill">
              <input type="checkbox" checked={participantIds.includes(person.id)} onChange={() => toggleParticipant(person.id)} />
              {person.name}
            </label>
          ))}
        </div>

        {method !== 'equal' && orderedParticipants.length > 0 && (
          <div className="share-editor">
            {orderedParticipants.map((person) => (
              <label key={person.id}>
                {person.name}
                {method === 'percent' ? (
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={percents[person.id] ?? ''}
                    onChange={(event) => setPercents((current) => ({ ...current, [person.id]: event.target.value }))}
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fixedShares[person.id] ?? ''}
                    onChange={(event) => setFixedShares((current) => ({ ...current, [person.id]: event.target.value }))}
                  />
                )}
                <span>{method === 'percent' ? '%' : '元'}</span>
              </label>
            ))}
          </div>
        )}

        {method === 'equal' && orderedParticipants.length > 0 && (
          <p className="form-hint">人均 {formatCurrency(Math.floor(amountCents / orderedParticipants.length) || 0)} 起，尾差按最大余数法自动分配，合计仍为原账单金额。</p>
        )}
        <p className={shareDifference === 0 ? 'balance-ok' : 'balance-bad'}>分摊合计：{formatCurrency(shareTotal)}，差额 {formatCurrency(shareDifference)}</p>
      </fieldset>

      <fieldset>
        <legend>实际付款</legend>
        <div className="payer-list">
          {payers.map((row, index) => (
            <div className="payer-row" key={row.id}>
              <select value={row.personId} onChange={(event) => updatePayer(row.id, { personId: event.target.value })}>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={row.amount} onChange={(event) => updatePayer(row.id, { amount: event.target.value })} placeholder={payers.length === 1 ? '留空默认账单全额' : '0.00'} />
              <span>元</span>
              {payers.length > 1 && <button type="button" className="button subtle small" onClick={() => setPayers((current) => current.filter((item) => item.id !== row.id))}>移除</button>}
              {index === 0 && payers.length === 1 && <button type="button" className="button subtle small" onClick={() => setPayers((current) => [...current, { id: createId('payer'), personId: people.find((person) => person.id !== row.personId)?.id ?? people[0]?.id ?? '', amount: '' }])}>多人付款</button>}
            </div>
          ))}
          {payers.length > 1 && <button type="button" className="button subtle small" onClick={() => setPayers((current) => [...current, { id: createId('payer'), personId: people.find((person) => !current.some((row) => row.personId === person.id))?.id ?? people[0]?.id ?? '', amount: '' }])}>添加付款人</button>}
        </div>
        <p className={paidDifference === 0 ? 'balance-ok' : 'balance-bad'}>付款合计：{formatCurrency(paidTotal)}，差额 {formatCurrency(paidDifference)}</p>
      </fieldset>

      <label className="full-label">付款备注
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="付款方式、账单周期、凭证说明等（不接入支付服务）" rows={2} />
      </label>

      {errors.length > 0 && <ul className="error-list">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      <button className="button primary" type="submit" disabled={people.length === 0}>{initialBill ? '保存并重算' : '添加账单'}</button>
    </form>
  );
}

function categoryLabelFallback(category: Category): string {
  return category === 'rent' ? '房租' : category === 'utilities' ? '水电' : category === 'groceries' ? '采购' : '其他账单';
}

