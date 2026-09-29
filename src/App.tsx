import { useCallback, useEffect, useState } from 'react';
import { api, type Bootstrap } from './api';
import OrderForm from './components/OrderForm';
import OrderList from './components/OrderList';
import ProductionView from './components/ProductionView';
import AvailabilityView from './components/AvailabilityView';
import { todayStr } from './lib/format';

type Tab = 'order' | 'orders' | 'production' | 'availability';

const TABS: { key: Tab; label: string }[] = [
  { key: 'order', label: '预订下单' },
  { key: 'orders', label: '订单管理' },
  { key: 'production', label: '每日制作清单' },
  { key: 'availability', label: '原料与烤箱' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('order');
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    api
      .bootstrap()
      .then(setBootstrap)
      .catch((e: Error) => setLoadError(e.message));
  }, [refreshKey]);

  if (loadError) {
    return (
      <main className="page">
        <h1>烘焙店预订出炉安排</h1>
        <p className="error">无法连接后端服务：{loadError}</p>
        <p>请先运行 <code>npm run dev:api</code> 启动 API 服务。</p>
      </main>
    );
  }
  if (!bootstrap) {
    return (
      <main className="page">
        <h1>烘焙店预订出炉安排</h1>
        <p>加载中…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>烘焙店预订出炉安排</h1>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'order' && (
        <OrderForm
          products={bootstrap.products}
          defaultDate={todayStr()}
          onCreated={() => {
            reload();
            setTab('orders');
          }}
        />
      )}
      {tab === 'orders' && (
        <OrderList products={bootstrap.products} refreshKey={refreshKey} onChanged={reload} />
      )}
      {tab === 'production' && <ProductionView refreshKey={refreshKey} />}
      {tab === 'availability' && <AvailabilityView refreshKey={refreshKey} />}
    </main>
  );
}
