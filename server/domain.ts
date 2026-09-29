import type {
  DayAvailability,
  IngredientNeed,
  NewOrderInput,
  Order,
  OrderItem,
  ProductionPlan,
  SlotAllocation,
} from '../shared/types';
import type { BakeryState } from './store';

export class OrderError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function batchesFor(productId: string, qty: number, state: BakeryState): number {
  const product = state.products.find((p) => p.id === productId);
  if (!product) throw new OrderError(`未知商品: ${productId}`);
  return Math.ceil(qty / product.unitsPerBatch);
}

/** 计算一批订单条目在某日期所需的原料汇总 */
export function ingredientNeedsFor(
  items: OrderItem[],
  state: BakeryState,
): Map<string, number> {
  const needs = new Map<string, number>();
  for (const item of items) {
    const product = state.products.find((p) => p.id === item.productId);
    if (!product) throw new OrderError(`未知商品: ${item.productId}`);
    for (const r of product.recipe) {
      needs.set(r.ingredientId, (needs.get(r.ingredientId) ?? 0) + r.amount * item.qty);
    }
  }
  return needs;
}

function activeOrders(state: BakeryState, date: string): Order[] {
  return state.orders.filter(
    (o) => o.pickupDate === date && o.status !== 'cancelled',
  );
}

/** 某日各原料剩余量与烤箱时段剩余炉数 */
export function availabilityFor(date: string, state: BakeryState): DayAvailability {
  const orders = activeOrders(state, date);

  const usedByIngredient = new Map<string, number>();
  for (const order of orders) {
    for (const [ingId, amount] of ingredientNeedsFor(order.items, state)) {
      usedByIngredient.set(ingId, (usedByIngredient.get(ingId) ?? 0) + amount);
    }
  }

  const ingredients = state.ingredients.map((ing) => {
    const total = state.stock
      .filter((s) => s.date === date && s.ingredientId === ing.id)
      .reduce((sum, s) => sum + s.amount, 0);
    const used = usedByIngredient.get(ing.id) ?? 0;
    return { ...ing, total, used, remaining: total - used };
  });

  const usedBySlot = new Map<string, number>();
  for (const order of orders) {
    for (const a of order.allocations) {
      usedBySlot.set(a.slotId, (usedBySlot.get(a.slotId) ?? 0) + a.batches);
    }
  }

  const slots = state.slots
    .filter((s) => s.date === date)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const used = usedBySlot.get(s.id) ?? 0;
      return { ...s, used, remaining: s.capacity - used };
    });

  return { date, ingredients, slots };
}

/** 把需要的炉数贪心分配到当日时段（按开始时间排序） */
function allocateSlots(
  date: string,
  batchesNeeded: number,
  state: BakeryState,
): SlotAllocation[] {
  const availability = availabilityFor(date, state);
  const allocations: SlotAllocation[] = [];
  let remaining = batchesNeeded;
  for (const slot of availability.slots) {
    if (remaining <= 0) break;
    const take = Math.min(slot.remaining, remaining);
    if (take > 0) {
      allocations.push({ slotId: slot.id, batches: take });
      remaining -= take;
    }
  }
  if (remaining > 0) {
    throw new OrderError('烤箱产能不足', [
      `该日期烤箱剩余炉数不足，还差 ${remaining} 炉`,
    ]);
  }
  return allocations;
}

/** 校验并创建订单：占用原料与烤箱时段 */
export function createOrder(
  input: NewOrderInput,
  state: BakeryState,
  now: string,
  id: string,
): Order {
  const customerName = input.customerName?.trim();
  if (!customerName) throw new OrderError('请填写取货人姓名');
  if (!DATE_RE.test(input.pickupDate ?? '')) {
    throw new OrderError('取货日期格式应为 YYYY-MM-DD');
  }
  const items = (input.items ?? []).filter((i) => i.qty > 0);
  if (items.length === 0) throw new OrderError('订单至少包含一件商品');
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new OrderError('商品数量必须为正整数');
    }
    if (!state.products.some((p) => p.id === item.productId)) {
      throw new OrderError(`未知商品: ${item.productId}`);
    }
  }

  // 原料检查
  const needs = ingredientNeedsFor(items, state);
  const availability = availabilityFor(input.pickupDate, state);
  const shortages: string[] = [];
  for (const [ingId, amount] of needs) {
    const entry = availability.ingredients.find((i) => i.id === ingId);
    const remaining = entry?.remaining ?? 0;
    if (amount > remaining) {
      const name = entry?.name ?? ingId;
      const unit = entry?.unit ?? '';
      shortages.push(`${name} 不足：需要 ${amount}${unit}，剩余 ${remaining}${unit}`);
    }
  }
  if (shortages.length > 0) throw new OrderError('原料不足', shortages);

  // 产能检查并分配时段
  const totalBatches = items.reduce(
    (sum, i) => sum + batchesFor(i.productId, i.qty, state),
    0,
  );
  const allocations = allocateSlots(input.pickupDate, totalBatches, state);

  const order: Order = {
    id,
    customerName,
    phone: input.phone?.trim() ?? '',
    pickupDate: input.pickupDate,
    items,
    status: 'confirmed',
    createdAt: now,
    allocations,
  };
  state.orders.push(order);
  return order;
}

/** 取消订单：状态变为 cancelled，占用随之释放（availability 只统计未取消订单） */
export function cancelOrder(id: string, state: BakeryState): Order {
  const order = state.orders.find((o) => o.id === id);
  if (!order) throw new OrderError('订单不存在');
  if (order.status === 'cancelled') throw new OrderError('订单已取消');
  order.status = 'cancelled';
  return order;
}

/** 标记取货完成 */
export function completeOrder(id: string, state: BakeryState): Order {
  const order = state.orders.find((o) => o.id === id);
  if (!order) throw new OrderError('订单不存在');
  if (order.status !== 'confirmed') throw new OrderError('只有待取货的订单可以标记完成');
  order.status = 'completed';
  return order;
}

/** 每日制作清单：按商品汇总数量与炉数，并汇总原料需求 */
export function productionPlanFor(date: string, state: BakeryState): ProductionPlan {
  const orders = activeOrders(state, date);
  const byProduct = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.qty);
    }
  }

  const lines = [...byProduct.entries()].map(([productId, qty]) => {
    const product = state.products.find((p) => p.id === productId);
    return {
      productId,
      productName: product?.name ?? productId,
      qty,
      batches: batchesFor(productId, qty, state),
    };
  });

  const needs = new Map<string, number>();
  for (const order of orders) {
    for (const [ingId, amount] of ingredientNeedsFor(order.items, state)) {
      needs.set(ingId, (needs.get(ingId) ?? 0) + amount);
    }
  }
  const ingredientNeeds: IngredientNeed[] = [...needs.entries()].map(([ingId, amount]) => {
    const ing = state.ingredients.find((i) => i.id === ingId);
    return { ingredientId: ingId, name: ing?.name ?? ingId, unit: ing?.unit ?? 'g', amount };
  });

  return {
    date,
    lines,
    ingredientNeeds,
    totalBatches: lines.reduce((s, l) => s + l.batches, 0),
  };
}
