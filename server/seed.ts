import type { Database } from '../shared/types.js';

function datePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 首次启动时的演示数据：配方、未来三天的原料与烤箱时段 */
export function seedDatabase(): Database {
  const days = [0, 1, 2, 3].map(datePlus);
  return {
    ingredients: [
      { id: 'flour', name: '高筋面粉', unit: 'g' },
      { id: 'butter', name: '黄油', unit: 'g' },
      { id: 'egg', name: '鸡蛋', unit: '个' },
      { id: 'sugar', name: '细砂糖', unit: 'g' },
      { id: 'milk', name: '牛奶', unit: 'ml' },
      { id: 'yeast', name: '干酵母', unit: 'g' },
    ],
    recipes: [
      {
        id: 'croissant',
        name: '可颂',
        batchSize: 12,
        bakeMinutes: 20,
        ingredients: [
          { ingredientId: 'flour', qty: 55 },
          { ingredientId: 'butter', qty: 30 },
          { ingredientId: 'sugar', qty: 6 },
          { ingredientId: 'milk', qty: 15 },
          { ingredientId: 'yeast', qty: 1 },
        ],
      },
      {
        id: 'baguette',
        name: '法棍',
        batchSize: 8,
        bakeMinutes: 25,
        ingredients: [
          { ingredientId: 'flour', qty: 120 },
          { ingredientId: 'yeast', qty: 1 },
        ],
      },
      {
        id: 'cinnamon-roll',
        name: '肉桂卷',
        batchSize: 9,
        bakeMinutes: 18,
        ingredients: [
          { ingredientId: 'flour', qty: 60 },
          { ingredientId: 'butter', qty: 15 },
          { ingredientId: 'sugar', qty: 20 },
          { ingredientId: 'egg', qty: 0.3 },
          { ingredientId: 'milk', qty: 25 },
          { ingredientId: 'yeast', qty: 1 },
        ],
      },
      {
        id: 'egg-tart',
        name: '蛋挞',
        batchSize: 16,
        bakeMinutes: 22,
        ingredients: [
          { ingredientId: 'flour', qty: 20 },
          { ingredientId: 'butter', qty: 10 },
          { ingredientId: 'sugar', qty: 12 },
          { ingredientId: 'egg', qty: 0.5 },
          { ingredientId: 'milk', qty: 30 },
        ],
      },
    ],
    dailyStock: days.flatMap((date) => [
      { date, ingredientId: 'flour', qty: 8000 },
      { date, ingredientId: 'butter', qty: 2500 },
      { date, ingredientId: 'egg', qty: 60 },
      { date, ingredientId: 'sugar', qty: 2000 },
      { date, ingredientId: 'milk', qty: 3000 },
      { date, ingredientId: 'yeast', qty: 100 },
    ]),
    ovenSlots: days.flatMap((date, i) => [
      { id: `slot-${date}-am`, date, label: '早炉 07:00-10:00', minutes: 180 },
      { id: `slot-${date}-pm`, date, label: '午炉 13:00-15:30', minutes: 150 },
    ]),
    orders: [],
  };
}
