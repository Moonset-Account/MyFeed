import express from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from './store';
import {
  OrderError,
  availabilityFor,
  cancelOrder,
  completeOrder,
  createOrder,
  productionPlanFor,
} from './domain';
import type { NewOrderInput } from '../shared/types';

function parseArgs(argv: string[]): { host: string; port: number } {
  let host = '127.0.0.1';
  let port = 3001;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--host' && argv[i + 1]) host = argv[++i];
    else if (argv[i] === '--port' && argv[i + 1]) port = Number(argv[++i]);
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`无效端口: ${port}`);
    process.exit(1);
  }
  return { host, port };
}

const { host, port } = parseArgs(process.argv.slice(2));
const dataFile = process.env.BAKERY_DATA_FILE ?? resolve('data/store.json');
const store = new Store(dataFile);

const app = express();
app.use(express.json());

// 仅允许本机来源跨域（开发演示用）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json({ products: store.state.products, ingredients: store.state.ingredients });
});

app.get('/api/availability', (req, res) => {
  const date = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date 参数应为 YYYY-MM-DD' });
  }
  res.json(availabilityFor(date, store.state));
});

app.get('/api/production', (req, res) => {
  const date = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date 参数应为 YYYY-MM-DD' });
  }
  res.json(productionPlanFor(date, store.state));
});

app.get('/api/orders', (_req, res) => {
  const orders = [...store.state.orders].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  try {
    const order = createOrder(
      req.body as NewOrderInput,
      store.state,
      new Date().toISOString(),
      randomUUID().slice(0, 8),
    );
    store.save();
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    throw err;
  }
});

app.post('/api/orders/:id/cancel', (req, res) => {
  try {
    const order = cancelOrder(req.params.id, store.state);
    store.save();
    res.json(order);
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

app.post('/api/orders/:id/complete', (req, res) => {
  try {
    const order = completeOrder(req.params.id, store.state);
    store.save();
    res.json(order);
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

app.listen(port, host, () => {
  console.log(`bakery api listening on http://${host}:${port}`);
});
