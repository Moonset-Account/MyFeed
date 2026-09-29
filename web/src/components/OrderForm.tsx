import { useEffect, useState } from 'react';
import type { DayAvailability, Ingredient, Recipe, Shortage } from '../../../shared/types';
import { api } from '../api';
import { todayStr } from '../App';

interface Line {
  recipeId: string;
  qty: number;
}

export default function OrderForm({
  recipes,
  ingredients,
  onCreated,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onCreated: () => void;
}) {
  const [date, setDate] = useState(todayStr(1));
  const [customer, setCustomer] = useState('');
  const [lines, setLines] = useState<Line[]>([{ recipeId: '', qty: 1 }]);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [message, setMessage] = useState('');
  const [shortages, setShortages] = useState<Shortage[]>([]);

  useEffect(() => {
    setAvailability(null);
    api
      .get<DayAvailability>(`/api/availability?date=${date}`)
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, [date]);

  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;
  const ingUnit = (id: string) => ingredients.find((i) => i.id === id)?.unit ?? '';

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setShortages([]);
    const items = lines.filter((l) => l.recipeId && l.qty > 0);
    if (!customer.trim() || items.length === 0) {
      setMessage('请填写顾客姓名并至少选择一种商品');
      return;
    }
    try {
      await api.post('/api/orders', { customerName: customer.trim(), pickupDate: date, items });
      setMessage('✅ 预订成功，已占用相应原料与烤箱时段');
      setCustomer('');
      setLines([{ recipeId: '', qty: 1 }]);
      onCreated();
      const avail = await api.get<DayAvailability>(`/api/availability?date=${date}`);
      setAvailability(avail);
    } catch (err) {
      const e = err as Error & { shortages?: Shortage[] };
      setMessage(`❌ ${e.message}`);
      if (e.shortages) setShortages(e.shortages);
    }
  }

  return (
    <section>
      <h2>接受预订</h2>
      <form onSubmit={submit} className="card">
        <label>
          取货日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          顾客姓名
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="张女士" />
        </label>
        {lines.map((line, idx) => (
          <div className="line" key={idx}>
            <select
              value={line.recipeId}
              onChange={(e) => setLine(idx, { recipeId: e.target.value })}
            >
              <option value="">选择商品…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}（每炉 {r.batchSize} 个 / {r.bakeMinutes} 分钟）
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={line.qty}
              onChange={(e) => setLine(idx, { qty: Number(e.target.value) })}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
              disabled={lines.length === 1}
            >
              移除
            </button>
          </div>
        ))}
        <div className="row">
          <button
            type="button"
            className="ghost"
            onClick={() => setLines((ls) => [...ls, { recipeId: '', qty: 1 }])}
          >
            + 添加商品
          </button>
          <button type="submit">提交预订</button>
        </div>
        {message && <p className={message.startsWith('✅') ? 'ok' : 'error'}>{message}</p>}
        {shortages.length > 0 && (
          <ul className="error">
            {shortages.map((s, i) => (
              <li key={i}>
                {s.kind === 'oven'
                  ? `烤箱产能不足：需要 ${s.needed} 分钟，仅剩 ${s.remaining} 分钟`
                  : `${ingName(s.ingredientId!)}不足：需要 ${s.needed}${ingUnit(
                      s.ingredientId!,
                    )}，仅剩 ${s.remaining}${ingUnit(s.ingredientId!)}`}
              </li>
            ))}
          </ul>
        )}
      </form>

      {availability && (
        <div className="card">
          <h3>{date} 剩余可订</h3>
          <p>
            烤箱：剩余 {availability.oven.remaining} / {availability.oven.capacity} 分钟
          </p>
          <table>
            <thead>
              <tr>
                <th>原料</th>
                <th>当日备货</th>
                <th>已占用</th>
                <th>剩余</th>
              </tr>
            </thead>
            <tbody>
              {availability.ingredients.map((a) => (
                <tr key={a.ingredientId}>
                  <td>{ingName(a.ingredientId)}</td>
                  <td>
                    {a.stock}
                    {ingUnit(a.ingredientId)}
                  </td>
                  <td>
                    {a.reserved}
                    {ingUnit(a.ingredientId)}
                  </td>
                  <td className={a.remaining <= 0 ? 'error' : ''}>
                    {a.remaining}
                    {ingUnit(a.ingredientId)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
