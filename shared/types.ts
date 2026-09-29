// 前后端共享的领域类型

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // 如 g / ml / 个
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number; // 每 1 个成品所需用量
}

export interface Recipe {
  id: string;
  name: string;
  batchSize: number; // 一炉可烤数量
  bakeMinutes: number; // 一炉占用烤箱分钟数
  ingredients: RecipeIngredient[];
}

export interface DailyStock {
  date: string; // YYYY-MM-DD
  ingredientId: string;
  qty: number;
}

export interface OvenSlot {
  id: string;
  date: string;
  label: string; // 如 “08:00-10:00”
  minutes: number; // 该时段可用烤箱分钟数
}

export interface OrderItem {
  recipeId: string;
  qty: number;
}

export type OrderStatus = 'reserved' | 'cancelled' | 'completed';

export interface Order {
  id: string;
  customerName: string;
  pickupDate: string; // YYYY-MM-DD
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string; // ISO 时间
}

export interface Database {
  ingredients: Ingredient[];
  recipes: Recipe[];
  dailyStock: DailyStock[];
  ovenSlots: OvenSlot[];
  orders: Order[];
}

export interface IngredientAvailability {
  ingredientId: string;
  stock: number;
  reserved: number;
  remaining: number;
}

export interface OvenAvailability {
  capacity: number; // 分钟
  reserved: number;
  remaining: number;
}

export interface DayAvailability {
  date: string;
  ingredients: IngredientAvailability[];
  oven: OvenAvailability;
}

export interface Shortage {
  kind: 'ingredient' | 'oven';
  ingredientId?: string;
  needed: number;
  remaining: number;
}

export interface ProductionLine {
  recipeId: string;
  qty: number;
  batches: number;
  ovenMinutes: number;
}

export interface ProductionPlan {
  date: string;
  lines: ProductionLine[];
  ingredientTotals: { ingredientId: string; qty: number }[];
  totalOvenMinutes: number;
}
