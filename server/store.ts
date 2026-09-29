import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  computeAmountCents,
  isOverdue,
  serviceById,
  summarize,
  TRANSITIONS,
  todayString,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type TransitionAction,
} from '../shared/domain.js';

export class StoreError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export interface CreateOrderInput {
  customerName: string;
  phone: string;
  itemCount: number;
  serviceIds: string[];
  pickupDate: string;
  stainNotes?: string;
}

export interface ListFilter {
  status?: OrderStatus;
  overdueOnly?: boolean;
  q?: string;
}

const STATUS_VALUES: OrderStatus[] = ['washing', 'inspecting', 'ready', 'picked_up'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PersistShape {
  seq: number;
  orders: Order[];
}

/** 基于 JSON 文件的本机持久化订单存储(原子写入,避免中途断电损坏数据) */
export class OrderStore {
  private orders: Order[] = [];
  private seq = 1;

  constructor(private filePath: string) {
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw) as PersistShape;
      this.orders = Array.isArray(data.orders) ? data.orders : [];
      this.seq = typeof data.seq === 'number' && data.seq > 0 ? data.seq : this.orders.length + 1;
    } catch (err) {
      throw new Error(`无法读取数据文件 ${this.filePath}: ${(err as Error).message}`);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    const payload: PersistShape = { seq: this.seq, orders: this.orders };
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmp, this.filePath);
  }

  list(filter: ListFilter = {}, today: string = todayString()): Order[] {
    const q = filter.q?.trim().toLowerCase();
    return this.orders
      .filter((o) => (filter.status ? o.status === filter.status : true))
      .filter((o) => (filter.overdueOnly ? isOverdue(o, today) : true))
      .filter((o) =>
        q
          ? o.code.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.phone.includes(q)
          : true,
      )
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Order {
    const order = this.orders.find((o) => o.id === id);
    if (!order) throw new StoreError(404, `订单不存在: ${id}`);
    return order;
  }

  create(input: CreateOrderInput, now: Date = new Date()): Order {
    const customerName = input.customerName?.trim();
    if (!customerName) throw new StoreError(400, '请填写顾客姓名');
    const phone = input.phone?.trim();
    if (!/^1?\d{6,14}$/.test(phone ?? '')) throw new StoreError(400, '请填写有效的联系电话');
    const itemCount = Number(input.itemCount);
    if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 999) {
      throw new StoreError(400, '衣物件数需为 1-999 的整数');
    }
    const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
    if (serviceIds.length === 0) throw new StoreError(400, '请至少选择一项服务');
    for (const id of serviceIds) {
      if (!serviceById(id)) throw new StoreError(400, `未知服务项目: ${id}`);
    }
    if (!DATE_RE.test(input.pickupDate ?? '')) {
      throw new StoreError(400, '取件日期格式应为 YYYY-MM-DD');
    }

    const at = now.toISOString();
    const order: Order = {
      id: randomUUID(),
      code: `L-${String(this.seq).padStart(4, '0')}`,
      customerName,
      phone,
      itemCount,
      serviceIds: [...new Set(serviceIds)],
      pickupDate: input.pickupDate,
      stainNotes: input.stainNotes?.trim() ?? '',
      amountCents: computeAmountCents(serviceIds, itemCount),
      status: 'washing',
      createdAt: at,
      updatedAt: at,
      history: [
        { at, action: 'create', label: '接单,开始清洗', from: null, to: 'washing' },
      ],
    };
    this.seq += 1;
    this.orders.push(order);
    this.save();
    return order;
  }

  transition(id: string, action: TransitionAction, note?: string, now: Date = new Date()): Order {
    const def = TRANSITIONS[action];
    if (!def) throw new StoreError(400, `未知操作: ${action}`);
    const order = this.get(id);
    if (order.status !== def.from) {
      throw new StoreError(
        409,
        `当前状态不允许该操作(需要「${def.from}」,实际「${order.status}」)`,
      );
    }
    const trimmed = note?.trim();
    if (def.requiresNote && !trimmed) {
      throw new StoreError(400, '质检不通过时必须填写退回原因');
    }
    const at = now.toISOString();
    order.status = def.to;
    order.updatedAt = at;
    order.history.push({
      at,
      action,
      label: def.label,
      from: def.from,
      to: def.to,
      ...(trimmed ? { note: trimmed } : {}),
    });
    this.save();
    return order;
  }

  summary(today: string = todayString()): OrderSummary {
    return summarize(this.orders, today);
  }
}
