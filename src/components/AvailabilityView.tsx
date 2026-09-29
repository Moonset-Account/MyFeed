import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DayAvailability } from '../../shared/types';
import { formatAmount, todayStr } from '../lib/format';

export default function AvailabilityView({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<DayAvailability | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .availability(date)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [date, refreshKey]);

  return (
    <section>
      <h2>原料与烤箱时段</h2>
      <label>
        日期
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <h3>原料库存</h3>
          <table>
            <thead>
              <tr>
                <th>原料</th>
                <th>当日可用</th>
                <th>已占用</th>
                <th>剩余</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{formatAmount(i.total, i.unit)}</td>
                  <td>{formatAmount(i.used, i.unit)}</td>
                  <td className={i.remaining <= 0 ? 'error' : ''}>
                    {formatAmount(i.remaining, i.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>烤箱时段</h3>
          {data.slots.length === 0 ? (
            <p>当天没有排烤箱时段。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>时段</th>
                  <th>容量（炉）</th>
                  <th>已占用</th>
                  <th>剩余</th>
                </tr>
              </thead>
              <tbody>
                {data.slots.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.start} - {s.end}
                    </td>
                    <td>{s.capacity}</td>
                    <td>{s.used}</td>
                    <td className={s.remaining <= 0 ? 'error' : ''}>{s.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
