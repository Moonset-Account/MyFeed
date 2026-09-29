import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import type { DayAvailability, Order } from '../shared/types.js';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp(new Store(null)); // 内存存储，不写磁盘
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('API', () => {
  it('GET /health 返回 JSON', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('下单占用库存，取消后释放', async () => {
    const recipes = (await (await fetch(`${base}/api/recipes`)).json()) as { id: string }[];
    const dateRes = await fetch(`${base}/api/oven-slots`);
    const date = (await dateRes.json())[0].date as string;

    const before = (await (
      await fetch(`${base}/api/availability?date=${date}`)
    ).json()) as DayAvailability;

    const created = await post('/api/orders', {
      customerName: '李女士',
      pickupDate: date,
      items: [{ recipeId: recipes[0].id, qty: 5 }],
    });
    expect(created.status).toBe(201);
    const order = created.body as Order;

    const during = (await (
      await fetch(`${base}/api/availability?date=${date}`)
    ).json()) as DayAvailability;
    expect(during.oven.reserved).toBeGreaterThan(before.oven.reserved);

    const cancelled = await post(`/api/orders/${order.id}/cancel`, {});
    expect(cancelled.status).toBe(200);

    const after = (await (
      await fetch(`${base}/api/availability?date=${date}`)
    ).json()) as DayAvailability;
    expect(after.oven).toEqual(before.oven);
    expect(after.ingredients).toEqual(before.ingredients);
  });

  it('超出产能的订单被拒绝并返回缺口', async () => {
    const slots = (await (await fetch(`${base}/api/oven-slots`)).json()) as { date: string }[];
    const res = await post('/api/orders', {
      customerName: '王先生',
      pickupDate: slots[0].date,
      items: [{ recipeId: 'baguette', qty: 8 * 100 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.shortages.length).toBeGreaterThan(0);
  });

  it('重复取消返回 409', async () => {
    const slots = (await (await fetch(`${base}/api/oven-slots`)).json()) as { date: string }[];
    const created = await post('/api/orders', {
      customerName: '赵女士',
      pickupDate: slots[0].date,
      items: [{ recipeId: 'egg-tart', qty: 2 }],
    });
    const order = created.body as Order;
    expect((await post(`/api/orders/${order.id}/cancel`, {})).status).toBe(200);
    expect((await post(`/api/orders/${order.id}/cancel`, {})).status).toBe(409);
  });
});
