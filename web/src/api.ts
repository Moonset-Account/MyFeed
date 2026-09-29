import type { Order, OrderStatus, OrderSummary, ServiceItem, TransitionAction } from '../../shared/domain';

export type OrderView = Order & { overdue: boolean };

// 按启动清单注入的 VITE_API_BASE_URL 动态连接 API;未设置时走开发代理(相对路径)
const BASE: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `请求失败(${res.status})`);
  }
  return body as T;
}

export interface ListParams {
  status?: OrderStatus | '';
  overdueOnly?: boolean;
  q?: string;
}

export const api = {
  services: () => request<{ services: ServiceItem[] }>('/api/services'),
  listOrders: (params: ListParams) => {
    const sp = new URLSearchParams();
    if (params.status) sp.set('status', params.status);
    if (params.overdueOnly) sp.set('overdue', '1');
    if (params.q?.trim()) sp.set('q', params.q.trim());
    const qs = sp.toString();
    return request<{ orders: OrderView[]; today: string }>(`/api/orders${qs ? `?${qs}` : ''}`);
  },
  createOrder: (input: {
    customerName: string;
    phone: string;
    itemCount: number;
    serviceIds: string[];
    pickupDate: string;
    stainNotes: string;
  }) =>
    request<{ order: OrderView }>('/api/orders', { method: 'POST', body: JSON.stringify(input) }),
  transition: (id: string, action: TransitionAction, note?: string) =>
    request<{ order: OrderView }>(`/api/orders/${id}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    }),
  summary: () => request<{ summary: OrderSummary; today: string }>('/api/summary'),
};
