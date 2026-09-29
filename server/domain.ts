// 纯领域逻辑：不依赖 Express / 文件系统，便于单元测试
import type {
  Database,
  DayAvailability,
  IngredientAvailability,
  Order,
  OrderItem,
  ProductionPlan,
  Recipe,
  Shortage,
} from '../shared/types.js';

export function batchesFor(recipe: Recipe, qty: number): number {
  return Math.ceil(qty / recipe.batchSize);
}

export function ovenMinutesFor(recipe: Recipe, qty: number): number {
  return batchesFor(recipe, qty) * recipe.bakeMinutes;
}

/** 某取货日所有有效（未取消）订单对原料的占用 */
export function reservedIngredients(db: Database, date: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const order of activeOrdersOn(db, date)) {
    for (const item of order.items) {
      const recipe = db.recipes.find((r) => r.id === item.recipeId);
      if (!recipe) continue;
      for (const ri of recipe.ingredients) {
        totals.set(ri.ingredientId, (totals.get(ri.ingredientId) ?? 0) + ri.qty * item.qty);
      }
    }
  }
  return totals;
}

/** 某取货日所有有效订单占用的烤箱分钟数 */
export function reservedOvenMinutes(db: Database, date: string): number {
  let total = 0;
  for (const order of activeOrdersOn(db, date)) {
    for (const item of order.items) {
      const recipe = db.recipes.find((r) => r.id === item.recipeId);
      if (recipe) total += ovenMinutesFor(recipe, item.qty);
    }
  }
  return total;
}

export function activeOrdersOn(db: Database, date: string): Order[] {
  return db.orders.filter((o) => o.pickupDate === date && o.status !== 'cancelled');
}

export function ovenCapacityOn(db: Database, date: string): number {
  return db.ovenSlots.filter((s) => s.date === date).reduce((sum, s) => sum + s.minutes, 0);
}

export function stockOn(db: Database, date: string, ingredientId: string): number {
  return db.dailyStock
    .filter((s) => s.date === date && s.ingredientId === ingredientId)
    .reduce((sum, s) => sum + s.qty, 0);
}

export function availabilityFor(db: Database, date: string): DayAvailability {
  const reserved = reservedIngredients(db, date);
  const ingredients: IngredientAvailability[] = db.ingredients.map((ing) => {
    const stock = stockOn(db, date, ing.id);
    const used = reserved.get(ing.id) ?? 0;
    return { ingredientId: ing.id, stock, reserved: used, remaining: stock - used };
  });
  const capacity = ovenCapacityOn(db, date);
  const ovenReserved = reservedOvenMinutes(db, date);
  return {
    date,
    ingredients,
    oven: { capacity, reserved: ovenReserved, remaining: capacity - ovenReserved },
  };
}

/** 校验一组订单项在给定日期是否有足够原料与烤箱产能 */
export function checkOrder(db: Database, date: string, items: OrderItem[]): Shortage[] {
  const availability = availabilityFor(db, date);
  const shortages: Shortage[] = [];

  const needed = new Map<string, number>();
  let ovenNeeded = 0;
  for (const item of items) {
    const recipe = db.recipes.find((r) => r.id === item.recipeId);
    if (!recipe) continue;
    ovenNeeded += ovenMinutesFor(recipe, item.qty);
    for (const ri of recipe.ingredients) {
      needed.set(ri.ingredientId, (needed.get(ri.ingredientId) ?? 0) + ri.qty * item.qty);
    }
  }

  for (const [ingredientId, qty] of needed) {
    const avail = availability.ingredients.find((a) => a.ingredientId === ingredientId);
    const remaining = avail?.remaining ?? 0;
    if (qty > remaining) {
      shortages.push({ kind: 'ingredient', ingredientId, needed: qty, remaining });
    }
  }
  if (ovenNeeded > availability.oven.remaining) {
    shortages.push({ kind: 'oven', needed: ovenNeeded, remaining: availability.oven.remaining });
  }
  return shortages;
}

/** 每日制作清单：按配方汇总数量、炉数、烤箱分钟与原料合计 */
export function productionPlanFor(db: Database, date: string): ProductionPlan {
  const lines = new Map<string, { qty: number; batches: number; ovenMinutes: number }>();
  const ingredientTotals = new Map<string, number>();

  for (const order of activeOrdersOn(db, date)) {
    for (const item of order.items) {
      const recipe = db.recipes.find((r) => r.id === item.recipeId);
      if (!recipe) continue;
      const line = lines.get(item.recipeId) ?? { qty: 0, batches: 0, ovenMinutes: 0 };
      line.qty += item.qty;
      line.batches += batchesFor(recipe, item.qty);
      line.ovenMinutes += ovenMinutesFor(recipe, item.qty);
      lines.set(item.recipeId, line);
      for (const ri of recipe.ingredients) {
        ingredientTotals.set(ri.ingredientId, (ingredientTotals.get(ri.ingredientId) ?? 0) + ri.qty * item.qty);
      }
    }
  }

  return {
    date,
    lines: [...lines.entries()].map(([recipeId, l]) => ({ recipeId, ...l })),
    ingredientTotals: [...ingredientTotals.entries()].map(([ingredientId, qty]) => ({ ingredientId, qty })),
    totalOvenMinutes: [...lines.values()].reduce((s, l) => s + l.ovenMinutes, 0),
  };
}
