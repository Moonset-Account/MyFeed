import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import {
  isOverdue,
  SERVICE_CATALOG,
  todayString,
  type Order,
  type OrderStatus,
  type TransitionAction,
} from '../shared/domain.js';
import { OrderStore, StoreError } from './store.js';

const STATUS_VALUES: OrderStatus[] = ['washing', 'inspecting', 'ready', 'picked_up'];

/** 带逾期标记的订单视图 */
function toView(order: Order, today: string) {
  return { ...order, overdue: isOverdue(order, today) };
}

export function createApp(store: OrderStore): Express {
  const app = express();
  app.use(express.json());
  // 仅允许本机来源(离线演示,不对外开放)
  app.use(
    cors({
      origin: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/services', (_req, res) => {
    res.json({ services: SERVICE_CATALOG });
  });

  app.get('/api/orders', (req, res) => {
    const today = todayString();
    const status = req.query.status as string | undefined;
    if (status && !STATUS_VALUES.includes(status as OrderStatus)) {
      res.status(400).json({ error: `未知状态: ${status}` });
      return;
    }
    const orders = store.list(
      {
        status: status as OrderStatus | undefined,
        overdueOnly: req.query.overdue === '1' || req.query.overdue === 'true',
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      },
      today,
    );
    res.json({ orders: orders.map((o) => toView(o, today)), today });
  });

  app.post('/api/orders', (req, res, next) => {
    try {
      const order = store.create(req.body ?? {});
      res.status(201).json({ order: toView(order, todayString()) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/orders/:id/transitions', (req, res, next) => {
    try {
      const { action, note } = req.body ?? {};
      const order = store.transition(req.params.id, action as TransitionAction, note);
      res.json({ order: toView(order, todayString()) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/summary', (_req, res) => {
    const today = todayString();
    res.json({ summary: store.summary(today), today });
  });

  // 统一错误处理:业务错误按状态码返回,其余 500
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof StoreError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: '请求体不是合法 JSON' });
      return;
    }
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
