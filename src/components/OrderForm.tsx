import { useState } from 'react';
import { api } from '../api';
import type { Product } from '../../shared/types';

interface Props {
  products: Product[];
  defaultDate: string;
  onCreated: () => void;
}

export default function OrderForm({ products, defaultDate, onCreated }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupDate, setPickupDate] = useState(defaultDate);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDetails([]);
    const items = Object.entries(qtys)
      .filter(([, q]) => q > 0)
      .map(([productId, qty]) => ({ productId, qty }));
    setSubmitting(true);
    try {
      await api.createOrder({ customerName, phone, pickupDate, items });
      setCustomerName('');
      setPhone('');
      setQtys({});
      onCreated();
    } catch (err) {
      const e2 = err as Error & { details?: string[] };
      setError(e2.message);
      setDetails(e2.details ?? []);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>新预订</h2>
      <form onSubmit={submit} className="card form">
        <label>
          取货人
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="姓名"
            required
          />
        </label>
        <label>
          联系电话
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="选填"
          />
        </label>
        <label>
          取货日期
          <input
            type="date"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            required
          />
        </label>
        <fieldset>
          <legend>商品与数量</legend>
          {products.map((p) => (
            <div key={p.id} className="product-row">
              <span>
                {p.name}（¥{p.price} / 个，每炉 {p.unitsPerBatch} 个）
              </span>
              <input
                type="number"
                min={0}
                value={qtys[p.id] ?? 0}
                onChange={(e) =>
                  setQtys((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </fieldset>
        {error && (
          <div className="error">
            <p>{error}</p>
            <ul>
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? '提交中…' : '提交预订'}
        </button>
      </form>
    </section>
  );
}
