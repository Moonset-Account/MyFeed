import type { Item } from '../types';

/** 待生成的物品草稿（id 由调用方补齐） */
export type ItemDraft = Omit<Item, 'id'>;

function draft(
  name: string,
  category: string,
  quantity: number,
  weightGrams: number,
  shared = false,
): ItemDraft {
  return { name, category, quantity, weightGrams, shared, assigneeId: null, packed: false };
}

/** 任何行程都需要的基础物品 */
function baseItems(): ItemDraft[] {
  return [
    draft('证件与银行卡', '证件资金', 1, 100),
    draft('手机与充电器', '电子产品', 1, 300),
    draft('充电宝', '电子产品', 1, 250),
    draft('洗漱包', '个护', 1, 500),
    draft('常用药与急救包', '健康', 1, 400, true),
    draft('水杯', '杂物', 1, 200),
  ];
}

/** 随行程天数增加的物品 */
function dayItems(days: number): ItemDraft[] {
  const items = [
    draft('换洗衣物', '衣物', days, 350),
    draft('内衣裤', '衣物', days, 80),
    draft('袜子', '衣物', days, 60),
  ];
  if (days >= 4) items.push(draft('睡衣', '衣物', 1, 300));
  if (days >= 5) items.push(draft('便携洗衣液', '个护', 1, 150, true));
  if (days >= 7) items.push(draft('折叠衣架', '杂物', 3, 50));
  return items;
}

interface DestinationRule {
  /** 目的地关键词（任一命中即生效） */
  keywords: string[];
  items: ItemDraft[];
}

const DESTINATION_RULES: DestinationRule[] = [
  {
    keywords: ['海', '沙滩', '岛', '三亚', '海南', '普吉', '巴厘', '马尔代夫', '厦门', '青岛'],
    items: [
      draft('泳衣泳裤', '衣物', 1, 200),
      draft('防晒霜', '个护', 1, 150, true),
      draft('墨镜', '杂物', 1, 50),
      draft('人字拖', '衣物', 1, 300),
    ],
  },
  {
    keywords: ['雪', '滑雪', '哈尔滨', '长白山', '北海道', '冬', '寒冷'],
    items: [
      draft('羽绒服', '衣物', 1, 800),
      draft('保暖内衣', '衣物', 2, 250),
      draft('手套与围巾', '衣物', 1, 200),
      draft('暖宝宝', '健康', 5, 40, true),
    ],
  },
  {
    keywords: ['山', '徒步', '登山', '露营', '武功山', '黄山', '泰山'],
    items: [
      draft('登山鞋', '衣物', 1, 900),
      draft('冲锋衣', '衣物', 1, 500),
      draft('登山杖', '装备', 1, 400, true),
      draft('头灯', '装备', 1, 100),
    ],
  },
  {
    keywords: ['露营'],
    items: [
      draft('帐篷', '装备', 1, 2500, true),
      draft('睡袋', '装备', 1, 1200),
    ],
  },
  {
    keywords: ['雨', '梅'],
    items: [
      draft('折叠雨伞', '杂物', 1, 300),
      draft('轻便雨衣', '衣物', 1, 150),
    ],
  },
  {
    keywords: ['商务', '会议', '出差'],
    items: [
      draft('正装', '衣物', 1, 800),
      draft('皮鞋', '衣物', 1, 800),
      draft('笔记本电脑', '电子产品', 1, 1500),
    ],
  },
  {
    keywords: ['亲子', '宝宝', '婴儿', '儿童', '带娃'],
    items: [
      draft('儿童换洗衣物', '衣物', 2, 200),
      draft('奶粉与奶瓶', '健康', 1, 600),
      draft('儿童常用药', '健康', 1, 300, true),
    ],
  },
];

/**
 * 按目的地与行程天数生成建议物品清单。
 * 天数向下取整且至少为 1；同名物品会去重（先出现的规则优先）。
 */
export function suggestItems(destination: string, days: number): ItemDraft[] {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  const items: ItemDraft[] = [...baseItems(), ...dayItems(safeDays)];
  for (const rule of DESTINATION_RULES) {
    if (rule.keywords.some((keyword) => destination.includes(keyword))) {
      items.push(...rule.items);
    }
  }
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}
