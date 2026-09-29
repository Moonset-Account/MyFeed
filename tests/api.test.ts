import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { OrderStore } from '../server/store.js';
import { todayString } from '../shared/domain.js';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'laundry-test-'));
  app = createApp(new OrderStore(join(dir, 'orders.json')));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayString(d);
})();

const validOrder = {
  customerName: '张阿姨',
  phone: '13800000000',
  itemCount: 2,
  serviceIds: ['wash', 'iron'],
  pickupDate: '2099-01-01',
  stainNotes: '领口油渍',
};

async function createOrder(body: Record<string, unknown> = validOrder) {
  const res = await request(app).post('/api/orders').send(body);
  expect(res.status).toBe(201);
  return res.body.order;
}

describe('健康检查', () => {
  it('GET /health 返回 JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('接单', () => {
  it('创建订单后进入清洗中,金额由服务端计算', async () => {
    const order = await createOrder();
    expect(order.code).toBe('L-0001');
    expect(order.status).toBe('washing');
    // (水洗 12 + 熨烫 8) x 2 件 = 40 元
    expect(order.amountCents).toBe(4000);
    expect(order.history).toHaveLength(1);
    expect(order.history[0].action).toBe('create');
  });

  it('缺服务项目或件数非法时返回 400', async () => {
    const r1 = await request(app).post('/api/orders').send({ ...validOrder, serviceIds: [] });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/api/orders').send({ ...validOrder, itemCount: 0 });
    expect(r2.status).toBe(400);
  });
});

describe('订单流转', () => {
  it('完整流程:清洗 -> 质检 -> 待领取 -> 已取件', async () => {
    const order = await createOrder();
    const step = async (action: string, expectStatus: string) => {
      const res = await request(app)
        .post(`/api/orders/${order.id}/transitions`)
        .send({ action });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(expectStatus);
    };
    await step('finish_wash', 'inspecting');
    await step('pass_qc', 'ready');
    await step('pickup', 'picked_up');
  });

  it('质检不通过退回重洗并留痕,且必须填写原因', async () => {
    const order = await createOrder();
    await request(app).post(`/api/orders/${order.id}/transitions`).send({ action: 'finish_wash' });

    const noNote = await request(app)
      .post(`/api/orders/${order.id}/transitions`)
      .send({ action: 'fail_qc' });
    expect(noNote.status).toBe(400);

    const res = await request(app)
      .post(`/api/orders/${order.id}/transitions`)
      .send({ action: 'fail_qc', note: '袖口油渍未洗净' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('washing');
    const last = res.body.order.history.at(-1);
    expect(last.action).toBe('fail_qc');
    expect(last.note).toBe('袖口油渍未洗净');
    expect(last.from).toBe('inspecting');
    expect(last.to).toBe('washing');
  });

  it('非法流转返回 409', async () => {
    const order = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${order.id}/transitions`)
      .send({ action: 'pickup' });
    expect(res.status).toBe(409);
  });
});

describe('逾期筛选与金额汇总', () => {
  it('overdue=1 只返回逾期未取订单', async () => {
    await createOrder({ ...validOrder, pickupDate: yesterday, customerName: '逾期王' });
    await createOrder(); // 2099 年取件,不逾期

    const res = await request(app).get('/api/orders?overdue=1');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].customerName).toBe('逾期王');
    expect(res.body.orders[0].overdue).toBe(true);
  });

  it('汇总接口统计单数与金额', async () => {
    await createOrder({ ...validOrder, pickupDate: yesterday }); // 逾期在途 40 元
    const o2 = await createOrder(); // 40 元,走完流程
    for (const action of ['finish_wash', 'pass_qc', 'pickup']) {
      await request(app).post(`/api/orders/${o2.id}/transitions`).send({ action });
    }

    const res = await request(app).get('/api/summary');
    expect(res.status).toBe(200);
    const s = res.body.summary;
    expect(s.totalOrders).toBe(2);
    expect(s.activeOrders).toBe(1);
    expect(s.activeAmountCents).toBe(4000);
    expect(s.pickedUpAmountCents).toBe(4000);
    expect(s.overdueCount).toBe(1);
    expect(s.overdueAmountCents).toBe(4000);
  });
});

describe('本机持久化', () => {
  it('数据写入 JSON 文件,重新加载后仍在', async () => {
    const file = join(dir, 'orders.json');
    await createOrder();
    const reloaded = new OrderStore(file);
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0].code).toBe('L-0001');
  });
});
