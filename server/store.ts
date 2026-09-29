import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Ingredient, OvenSlot, Order, Product, StockEntry } from '../shared/types';

export interface BakeryState {
  ingredients: Ingredient[];
  products: Product[];
  stock: StockEntry[];
  slots: OvenSlot[];
  orders: Order[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 生成演示用种子数据：商品配方 + 未来 7 天原料与烤箱时段 */
export function seedState(today = new Date()): BakeryState {
  const ingredients: Ingredient[] = [
    { id: 'flour', name: '高筋面粉', unit: 'g' },
    { id: 'butter', name: '黄油', unit: 'g' },
    { id: 'egg', name: '鸡蛋', unit: 'pcs' },
    { id: 'milk', name: '牛奶', unit: 'ml' },
    { id: 'sugar', name: '细砂糖', unit: 'g' },
    { id: 'yeast', name: '干酵母', unit: 'g' },
    { id: 'cream', name: '淡奶油', unit: 'ml' },
  ];

  const products: Product[] = [
    {
      id: 'croissant',
      name: '原味可颂',
      price: 12,
      unitsPerBatch: 12,
      recipe: [
        { ingredientId: 'flour', amount: 55 },
        { ingredientId: 'butter', amount: 30 },
        { ingredientId: 'milk', amount: 25 },
        { ingredientId: 'sugar', amount: 6 },
        { ingredientId: 'yeast', amount: 1.2 },
      ],
    },
    {
      id: 'cinnamon-roll',
      name: '肉桂卷',
      price: 14,
      unitsPerBatch: 9,
      recipe: [
        { ingredientId: 'flour', amount: 60 },
        { ingredientId: 'butter', amount: 20 },
        { ingredientId: 'egg', amount: 0.5 },
        { ingredientId: 'milk', amount: 30 },
        { ingredientId: 'sugar', amount: 15 },
        { ingredientId: 'yeast', amount: 1.5 },
      ],
    },
    {
      id: 'whole-wheat-toast',
      name: '全麦吐司',
      price: 22,
      unitsPerBatch: 4,
      recipe: [
        { ingredientId: 'flour', amount: 280 },
        { ingredientId: 'egg', amount: 1 },
        { ingredientId: 'milk', amount: 150 },
        { ingredientId: 'butter', amount: 20 },
        { ingredientId: 'sugar', amount: 18 },
        { ingredientId: 'yeast', amount: 3.5 },
      ],
    },
    {
      id: 'egg-tart',
      name: '蛋挞',
      price: 6,
      unitsPerBatch: 16,
      recipe: [
        { ingredientId: 'egg', amount: 0.5 },
        { ingredientId: 'milk', amount: 30 },
        { ingredientId: 'cream', amount: 20 },
        { ingredientId: 'sugar', amount: 8 },
        { ingredientId: 'flour', amount: 20 },
        { ingredientId: 'butter', amount: 8 },
      ],
    },
  ];

  const stock: StockEntry[] = [];
  const slots: OvenSlot[] = [];
  const dailyStock: Record<string, number> = {
    flour: 8000,
    butter: 2500,
    egg: 90,
    milk: 5000,
    sugar: 2000,
    yeast: 120,
    cream: 1500,
  };
  const slotTemplate = [
    { start: '06:00', end: '08:00', capacity: 4 },
    { start: '08:00', end: '10:00', capacity: 4 },
    { start: '14:00', end: '16:00', capacity: 3 },
  ];

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = formatDate(date);
    for (const ing of ingredients) {
      stock.push({ date: dateStr, ingredientId: ing.id, amount: dailyStock[ing.id] });
    }
    slotTemplate.forEach((t, i) => {
      slots.push({ id: `slot-${dateStr}-${i + 1}`, date: dateStr, ...t });
    });
  }

  return { ingredients, products, stock, slots, orders: [] };
}

/** 本地 JSON 文件存储：首次启动写入种子数据，之后每次变更落盘 */
export class Store {
  state: BakeryState;

  constructor(private filePath: string | null) {
    if (filePath && existsSync(filePath)) {
      this.state = JSON.parse(readFileSync(filePath, 'utf-8')) as BakeryState;
    } else {
      this.state = seedState();
      this.save();
    }
  }

  save(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }
}
