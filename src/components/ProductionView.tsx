import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ProductionPlan } from '../../shared/types';
import { formatAmount, todayStr } from '../lib/format';

export default function ProductionView({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(todayStr());
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .production(date)
      .then(setPlan)
      .catch((e: Error) => setError(e.message));
  }, [date, refreshKey]);

  return (
    <section>
      <h2>每日制作清单</h2>
      <label>
        日期
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      {plan && (
        <>
          {plan.lines.length === 0 ? (
            <p>当天暂无制作任务。</p>
          ) : (
            <>
              <h3>商品（共 {plan.totalBatches} 炉）</h3>
              <table>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>数量</th>
                    <th>炉数</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>{l.productName}</td>
                      <td>{l.qty}</td>
                      <td>{l.batches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>原料需求</h3>
              <table>
                <thead>
                  <tr>
                    <th>原料</th>
                    <th>用量</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.ingredientNeeds.map((n) => (
                    <tr key={n.ingredientId}>
                      <td>{n.name}</td>
                      <td>{formatAmount(n.amount, n.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
