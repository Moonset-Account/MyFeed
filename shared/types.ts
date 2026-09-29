/** 前后端共享的领域类型 */

export type Unit = 'g' | 'ml' | 'pcs';

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
}

/** 配方项：每 1 个成品所需原料量 */
export interface RecipeItem {
  ingredientId: string;
  amount: number;
}

export interface Product {
  id: string;
  name: string;
  /** 单价（元），仅用于展示，不接支付 */
  price: number;
  /** 每炉可烤数量，用于换算占用烤箱的炉数 */
  unitsPerBatch: number;
  recipe: RecipeItem[];
}

/** 某日某原料的可用量 */
export interface StockEntry {
  date: string; // YYYY-MM-DD
  ingredientId: string;
  amount: number;
}

/** 烤箱时段：capacity 为该时段可容纳的炉数 */
export interface OvenSlot {
  id: string;
  date: string;
  start: string; // HH:mm
  end: string;
  capacity: number;
}

export interface OrderItem {
  productId: string;
  qty: number;
}

export type OrderStatus = 'confirmed' | 'cancelled' | 'completed';

export interface SlotAllocation {
  slotId: string;
  batches: number;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  pickupDate: string; // YYYY-MM-DD
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string;
  /** 下单时占用的烤箱时段（取消后不再计入占用） */
  allocations: SlotAllocation[];
}

export interface IngredientAvailability extends Ingredient {
  total: number;
  used: number;
  remaining: number;
}

export interface SlotAvailability extends OvenSlot {
  used: number;
  remaining: number;
}

export interface DayAvailability {
  date: string;
  ingredients: IngredientAvailability[];
  slots: SlotAvailability[];
}

export interface ProductionLine {
  productId: string;
  productName: string;
  qty: number;
  batches: number;
}

export interface IngredientNeed {
  ingredientId: string;
  name: string;
  unit: Unit;
  amount: number;
}

export interface ProductionPlan {
  date: string;
  lines: ProductionLine[];
  ingredientNeeds: IngredientNeed[];
  totalBatches: number;
}

export interface NewOrderInput {
  customerName: string;
  phone: string;
  pickupDate: string;
  items: OrderItem[];
}
