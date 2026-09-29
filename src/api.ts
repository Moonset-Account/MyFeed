import type {
  DayAvailability,
  Ingredient,
  NewOrderInput,
  Order,
  Product,
  ProductionPlan,
} from '../shared/types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? `请求失败 (${res.status})`) as Error & {
      details?: string[];
    };
    err.details = body.details;
    throw err;
  }
  return body as T;
}

export interface Bootstrap {
  products: Product[];
  ingredients: Ingredient[];
}

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  availability: (date: string) =>
    request<DayAvailability>(`/api/availability?date=${date}`),
  production: (date: string) => request<ProductionPlan>(`/api/production?date=${date}`),
  orders: () => request<Order[]>('/api/orders'),
  createOrder: (input: NewOrderInput) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }),
  cancelOrder: (id: string) =>
    request<Order>(`/api/orders/${id}/cancel`, { method: 'POST' }),
  completeOrder: (id: string) =>
    request<Order>(`/api/orders/${id}/complete`, { method: 'POST' }),
};
