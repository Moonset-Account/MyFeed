import { useEffect, useState } from 'react';
import type { Order, Recipe } from '../../../shared/types';
import { api } from '../api';

const STATUS_LABEL: Record<Order['status'], string> = {
  reserved: '待取货',
  cancelled: '已取消',
  completed: '已完成',
};

export default function OrderList({
  recipes,
  onChanged,
  refreshKey,
}: {
  recipes: Recipe[];
  onChanged: () => void;
  refreshKey: number;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState('');

  useEffect(() => {
    api
      .get<Order[]>(`/api/orders${date ? `?date=${date}` : ''}`)
      .then((list) => setOrders(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setOrders([]));
  }, [date, refreshKey]);

  const recipeName = (id: string) => recipes.find((r) => r.id === id)?.name ?? id;

  async function act(id: string, action: 'cancel' | 'complete') {
    await api.post(`/api/orders/${id}/${action}`);
    onChanged();
  }

  return (
    <section>
      <h2>订单状态</h2>
      <div className="card">
        <label>
          按取货日期筛选（留空显示全部）
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {orders.length === 0 ? (
        <p>暂无订单</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>顾客</th>
              <th>取货日期</th>
              <th>商品</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={o.status === 'cancelled' ? 'muted' : ''}>
                <td>{o.customerName}</td>
                <td>{o.pickupDate}</td>
                <td>
                  {o.items.map((it) => `${recipeName(it.recipeId)} × ${it.qty}`).join('，')}
                </td>
                <td>
                  <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </td>
                <td>
                  {o.status === 'reserved' && (
                    <>
                      <button className="ghost" onClick={() => act(o.id, 'complete')}>
                        标记完成
                      </button>{' '}
                      <button className="danger" onClick={() => act(o.id, 'cancel')}>
                        取消并释放占用
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
