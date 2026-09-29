import { useCallback, useEffect, useState } from 'react';
import type { Ingredient, Recipe } from '../../shared/types';
import { api } from './api';
import OrderForm from './components/OrderForm';
import OrderList from './components/OrderList';
import ProductionView from './components/ProductionView';
import SettingsView from './components/SettingsView';

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Tab = 'order' | 'orders' | 'production' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'order', label: '预订下单' },
  { key: 'orders', label: '订单状态' },
  { key: 'production', label: '每日制作清单' },
  { key: 'settings', label: '配方与每日备货' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('order');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    Promise.all([api.get<Recipe[]>('/api/recipes'), api.get<Ingredient[]>('/api/ingredients')])
      .then(([r, i]) => {
        setRecipes(r);
        setIngredients(i);
      })
      .catch((e) => setError(`无法连接后端 API：${e.message}`));
  }, [refreshKey]);

  const ingredientName = useCallback(
    (id: string) => {
      const ing = ingredients.find((i) => i.id === id);
      return ing ? `${ing.name}(${ing.unit})` : id;
    },
    [ingredients],
  );

  return (
    <div className="app">
      <header>
        <h1>🍞 烘焙店预订出炉安排</h1>
        <nav>
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
      </header>
      {error && <p className="error">{error}</p>}
      <main>
        {tab === 'order' && (
          <OrderForm recipes={recipes} ingredients={ingredients} onCreated={reload} />
        )}
        {tab === 'orders' && (
          <OrderList recipes={recipes} onChanged={reload} refreshKey={refreshKey} />
        )}
        {tab === 'production' && (
          <ProductionView
            recipes={recipes}
            ingredientName={ingredientName}
            refreshKey={refreshKey}
          />
        )}
        {tab === 'settings' && (
          <SettingsView recipes={recipes} ingredients={ingredients} onChanged={reload} refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
