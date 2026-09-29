import express, { type Express, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Order, OrderItem } from '../shared/types.js';
import { Store } from './store.js';
import { availabilityFor, checkOrder, productionPlanFor } from './domain.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 仅允许本机来源的 CORS，供本地开发前端直连 */
function localCors(req: Request, res: Response, next: () => void): void {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

export function createApp(store: Store): Express {
  const app = express();
  app.use(express.json());
  app.use(localCors);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ingredients', (_req, res) => {
    res.json(store.data.ingredients);
  });

  app.get('/api/recipes', (_req, res) => {
    res.json(store.data.recipes);
  });

  app.put('/api/recipes/:id', (req, res) => {
    const recipe = store.data.recipes.find((r) => r.id === req.params.id);
    if (!recipe) {
      res.status(404).json({ error: '配方不存在' });
      return;
    }
    const { name, batchSize, bakeMinutes, ingredients } = req.body ?? {};
    if (name !== undefined) recipe.name = String(name);
    if (batchSize !== undefined) recipe.batchSize = Number(batchSize);
    if (bakeMinutes !== undefined) recipe.bakeMinutes = Number(bakeMinutes);
    if (Array.isArray(ingredients)) recipe.ingredients = ingredients;
    store.save();
    res.json(recipe);
  });

  // 每日原料库存（upsert）
  app.post('/api/stock', (req, res) => {
    const { date, ingredientId, qty } = req.body ?? {};
    if (!DATE_RE.test(date ?? '') || !ingredientId || !(Number(qty) >= 0)) {
      res.status(400).json({ error: '需要 date(YYYY-MM-DD)、ingredientId 与非负 qty' });
      return;
    }
    if (!store.data.ingredients.some((i) => i.id === ingredientId)) {
      res.status(404).json({ error: '原料不存在' });
      return;
    }
    const existing = store.data.dailyStock.find((s) => s.date === date && s.ingredientId === ingredientId);
    if (existing) existing.qty = Number(qty);
    else store.data.dailyStock.push({ date, ingredientId, qty: Number(qty) });
    store.save();
    res.json({ date, ingredientId, qty: Number(qty) });
  });

  app.get('/api/oven-slots', (req, res) => {
    const date = String(req.query.date ?? '');
    res.json(store.data.ovenSlots.filter((s) => !date || s.date === date));
  });

  app.post('/api/oven-slots', (req, res) => {
    const { date, label, minutes } = req.body ?? {};
    if (!DATE_RE.test(date ?? '') || !label || !(Number(minutes) > 0)) {
      res.status(400).json({ error: '需要 date(YYYY-MM-DD)、label 与正数 minutes' });
      return;
    }
    const slot = { id: randomUUID(), date, label: String(label), minutes: Number(minutes) };
    store.data.ovenSlots.push(slot);
    store.save();
    res.status(201).json(slot);
  });

  app.delete('/api/oven-slots/:id', (req, res) => {
    const idx = store.data.ovenSlots.findIndex((s) => s.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: '时段不存在' });
      return;
    }
    store.data.ovenSlots.splice(idx, 1);
    store.save();
    res.sendStatus(204);
  });

  app.get('/api/availability', (req, res) => {
    const date = String(req.query.date ?? '');
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: '需要 date=YYYY-MM-DD' });
      return;
    }
    res.json(availabilityFor(store.data, date));
  });

  app.get('/api/production', (req, res) => {
    const date = String(req.query.date ?? '');
    if (!DATE_RE.test(date)) {
      res.status(400).json({ error: '需要 date=YYYY-MM-DD' });
      return;
    }
    res.json(productionPlanFor(store.data, date));
  });

  app.get('/api/orders', (req, res) => {
    const date = String(req.query.date ?? '');
    const orders = store.data.orders.filter((o) => !date || o.pickupDate === date);
    res.json(orders);
  });

  app.post('/api/orders', (req, res) => {
    const { customerName, pickupDate, items } = req.body ?? {};
    if (!customerName || !DATE_RE.test(pickupDate ?? '') || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: '需要 customerName、pickupDate(YYYY-MM-DD) 与非空 items' });
      return;
    }
    for (const item of items as OrderItem[]) {
      if (!store.data.recipes.some((r) => r.id === item.recipeId)) {
        res.status(400).json({ error: `未知商品: ${item.recipeId}` });
        return;
      }
      if (!Number.isInteger(item.qty) || item.qty <= 0) {
        res.status(400).json({ error: '数量必须为正整数' });
        return;
      }
    }
    const shortages = checkOrder(store.data, pickupDate, items);
    if (shortages.length > 0) {
      res.status(409).json({ error: '原料或烤箱产能不足', shortages });
      return;
    }
    const order: Order = {
      id: randomUUID(),
      customerName: String(customerName),
      pickupDate,
      items,
      status: 'reserved',
      createdAt: new Date().toISOString(),
    };
    store.data.orders.push(order);
    store.save();
    res.status(201).json(order);
  });

  app.post('/api/orders/:id/cancel', (req, res) => {
    const order = store.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }
    if (order.status === 'cancelled') {
      res.status(409).json({ error: '订单已取消' });
      return;
    }
    order.status = 'cancelled';
    store.save();
    res.json(order);
  });

  app.post('/api/orders/:id/complete', (req, res) => {
    const order = store.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }
    if (order.status !== 'reserved') {
      res.status(409).json({ error: '只有待取货订单可以标记完成' });
      return;
    }
    order.status = 'completed';
    store.save();
    res.json(order);
  });

  return app;
}
