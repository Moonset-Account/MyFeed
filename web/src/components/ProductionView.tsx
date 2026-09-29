import { useEffect, useState } from 'react';
import type { DayAvailability, ProductionPlan, Recipe } from '../../../shared/types';
import { api } from '../api';
import { todayStr } from '../App';

export default function ProductionView({
  recipes,
  ingredientName,
  refreshKey,
}: {
  recipes: Recipe[];
  ingredientName: (id: string) => string;
  refreshKey: number;
}) {
  const [date, setDate] = useState(todayStr());
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ProductionPlan>(`/api/production?date=${date}`),
      api.get<DayAvailability>(`/api/availability?date=${date}`),
    ])
      .then(([p, a]) => {
        setPlan(p);
        setAvailability(a);
      })
      .catch(() => {
        setPlan(null);
        setAvailability(null);
      });
  }, [date, refreshKey]);

  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name ?? id;

  return (
    <section>
      <h2>每日制作清单</h2>
      <div className="card">
        <label>
          日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {availability && (
          <p>
            烤箱排产 {availability.oven.reserved} / {availability.oven.capacity} 分钟
          </p>
        )}
      </div>
      {plan && plan.lines.length === 0 && <p>当天暂无制作任务</p>}
      {plan && plan.lines.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>制作数量</th>
                <th>炉数</th>
                <th>烤箱分钟</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((l) => (
                <tr key={l.recipeId}>
                  <td>{recipeName(l.recipeId)}</td>
                  <td>{l.qty}</td>
                  <td>{l.batches}</td>
                  <td>{l.ovenMinutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>原料合计</h3>
          <table>
            <thead>
              <tr>
                <th>原料</th>
                <th>需要用量</th>
              </tr>
            </thead>
            <tbody>
              {plan.ingredientTotals.map((t) => (
                <tr key={t.ingredientId}>
                  <td>{ingredientName(t.ingredientId)}</td>
                  <td>{Math.round(t.qty * 100) / 100}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
