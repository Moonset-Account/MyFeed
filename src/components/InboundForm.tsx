import { useState } from 'react';
import { CATEGORIES, type Category, type InboundInput, type InspectStatus } from '../lib/domain';

interface Props {
  onSubmit: (input: InboundInput, operator: string) => string | null;
}

export default function InboundForm({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('食品');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('件');
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<InspectStatus>('pending');
  const [donor, setDonor] = useState('');
  const [operator, setOperator] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!operator.trim()) {
      setError('请填写经手人');
      return;
    }
    const err = onSubmit(
      {
        name: name.trim(),
        category,
        quantity: Number(quantity),
        unit: unit.trim(),
        expiryDate,
        location: location.trim(),
        status,
        donor: donor.trim(),
        note: note.trim(),
      },
      operator.trim(),
    );
    if (err) {
      setError(err);
      return;
    }
    setName('');
    setQuantity('');
    setExpiryDate('');
    setLocation('');
    setDonor('');
    setNote('');
    setError('');
  }

  return (
    <section className="card">
      <h2>入库登记</h2>
      <p className="hint">登记物资类别、数量、有效期与存放位置，并标记质检状态（待检查 / 可发放 / 不合格）。</p>
      <form onSubmit={submit} className="form-grid">
        <label>
          物资名称 *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：矿泉水 550ml" />
        </label>
        <label>
          类别 *
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          数量 *
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="正整数"
          />
        </label>
        <label>
          计量单位 *
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="件 / 箱 / 瓶…" />
        </label>
        <label>
          有效期（可留空）
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </label>
        <label>
          存放位置 *
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="如：A区-01架" />
        </label>
        <label>
          捐赠方
          <input value={donor} onChange={(e) => setDonor(e.target.value)} placeholder="捐赠单位或个人" />
        </label>
        <label>
          经手人 *
          <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="登记人姓名" />
        </label>
        <fieldset className="status-picker">
          <legend>质检状态 *</legend>
          {(
            [
              ['pending', '待检查'],
              ['available', '可发放'],
              ['rejected', '不合格'],
            ] as [InspectStatus, string][]
          ).map(([value, label]) => (
            <label key={value} className="radio">
              <input
                type="radio"
                name="status"
                checked={status === value}
                onChange={() => setStatus(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="span-2">
          备注
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填" />
        </label>
        {error && <div className="alert alert-error span-2">{error}</div>}
        <div className="span-2">
          <button type="submit" className="btn btn-primary">
            登记入库
          </button>
        </div>
      </form>
    </section>
  );
}
