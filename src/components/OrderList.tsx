import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Order, Product } from '../../shared/types';
import { STATUS_LABEL } from '../lib/format';

interface Props {
  products: Product[];
  refreshKey: number;
  onChanged: () => void;
}

export default function OrderList({ products, refreshKey, onChanged }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.orders().then(setOrders).catch((e: Error) => setError(e.message));
  }, [refreshKey]);

  function productName(id: string): string {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  async function act(id: string, action: 'cancel' | 'complete') {
    setError('');
    try {
      if (action === 'cancel') await api.cancelOrder(id);
      else await api.completeOrder(id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (orders.length === 0) return <p>暂无订单。</p>;

  return (
    <section>
      <h2>订单</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>单号</th>
            <th>取货人</th>
            <th>取货日期</th>
            <th>商品</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={`status-${o.status}`}>
              <td>{o.id}</td>
              <td>
                {o.customerName}
                {o.phone && <div className="muted">{o.phone}</div>}
              </td>
              <td>{o.pickupDate}</td>
              <td>
                {o.items.map((i) => (
                  <div key={i.productId}>
                    {productName(i.productId)} × {i.qty}
                  </div>
                ))}
              </td>
              <td>{STATUS_LABEL[o.status]}</td>
              <td>
                {o.status === 'confirmed' && (
                  <>
                    <button onClick={() => act(o.id, 'complete')}>取货完成</button>
                    <button className="danger" onClick={() => act(o.id, 'cancel')}>
                      取消
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
