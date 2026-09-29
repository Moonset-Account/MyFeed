import { useEffect, useState } from 'react';
import type { Ingredient, OvenSlot, Recipe } from '../../../shared/types';
import { api } from '../api';
import { todayStr } from '../App';

export default function SettingsView({
  recipes,
  ingredients,
  onChanged,
  refreshKey,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onChanged: () => void;
  refreshKey: number;
}) {
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<OvenSlot[]>([]);
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({});
  const [slotLabel, setSlotLabel] = useState('');
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [recipeDraft, setRecipeDraft] = useState<Record<string, { batchSize: number; bakeMinutes: number }>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get<OvenSlot[]>(`/api/oven-slots?date=${date}`).then(setSlots).catch(() => setSlots([]));
  }, [date, refreshKey]);

  useEffect(() => {
    setRecipeDraft(
      Object.fromEntries(recipes.map((r) => [r.id, { batchSize: r.batchSize, bakeMinutes: r.bakeMinutes }])),
    );
  }, [recipes]);

  async function saveStock(ingredientId: string) {
    const qty = Number(stockDraft[ingredientId]);
    if (!(qty >= 0)) return;
    await api.post('/api/stock', { date, ingredientId, qty });
    setMessage(`已更新 ${date} 的库存`);
    onChanged();
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotLabel.trim() || !(slotMinutes > 0)) return;
    await api.post('/api/oven-slots', { date, label: slotLabel.trim(), minutes: slotMinutes });
    setSlotLabel('');
    onChanged();
  }

  async function removeSlot(id: string) {
    await api.del(`/api/oven-slots/${id}`);
    onChanged();
  }

  async function saveRecipe(id: string) {
    await api.put(`/api/recipes/${id}`, recipeDraft[id]);
    setMessage('配方已更新');
    onChanged();
  }

  return (
    <section>
      <h2>配方与每日备货</h2>
      {message && <p className="ok">{message}</p>}

      <div className="card">
        <h3>商品配方（每炉数量 / 烘烤分钟）</h3>
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>每炉数量</th>
              <th>每炉分钟</th>
              <th>单位用量</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={recipeDraft[r.id]?.batchSize ?? r.batchSize}
                    onChange={(e) =>
                      setRecipeDraft((d) => ({
                        ...d,
                        [r.id]: { ...(d[r.id] ?? { bakeMinutes: r.bakeMinutes, batchSize: r.batchSize }), batchSize: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={recipeDraft[r.id]?.bakeMinutes ?? r.bakeMinutes}
                    onChange={(e) =>
                      setRecipeDraft((d) => ({
                        ...d,
                        [r.id]: { ...(d[r.id] ?? { batchSize: r.batchSize, bakeMinutes: r.bakeMinutes }), bakeMinutes: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td className="muted">
                  {r.ingredients
                    .map((ri) => {
                      const ing = ingredients.find((i) => i.id === ri.ingredientId);
                      return ing ? `${ing.name} ${ri.qty}${ing.unit}` : '';
                    })
                    .join('，')}
                </td>
                <td>
                  <button className="ghost" onClick={() => saveRecipe(r.id)}>
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>每日原料备货</h3>
        <label>
          日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <table>
          <thead>
            <tr>
              <th>原料</th>
              <th>当日可用量</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id}>
                <td>
                  {ing.name}（{ing.unit}）
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    placeholder="输入数量"
                    value={stockDraft[ing.id] ?? ''}
                    onChange={(e) => setStockDraft((d) => ({ ...d, [ing.id]: e.target.value }))}
                  />
                </td>
                <td>
                  <button className="ghost" onClick={() => saveStock(ing.id)}>
                    保存
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>{date} 烤箱时段</h3>
        <ul>
          {slots.map((s) => (
            <li key={s.id}>
              {s.label} — {s.minutes} 分钟{' '}
              <button className="danger" onClick={() => removeSlot(s.id)}>
                删除
              </button>
            </li>
          ))}
          {slots.length === 0 && <li className="muted">当天还没有安排烤箱时段</li>}
        </ul>
        <form onSubmit={addSlot} className="row">
          <input
            placeholder="如：晚炉 17:00-19:00"
            value={slotLabel}
            onChange={(e) => setSlotLabel(e.target.value)}
          />
          <input
            type="number"
            min={1}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
          />
          <button type="submit">添加时段</button>
        </form>
      </div>
    </section>
  );
}
