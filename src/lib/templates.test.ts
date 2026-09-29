import { describe, expect, it } from 'vitest';
import { suggestItems } from './templates';

describe('按目的地与天数生成建议物品', () => {
  it('换洗衣物数量随行程天数增加', () => {
    const short = suggestItems('北京', 2);
    const long = suggestItems('北京', 7);
    const shortClothes = short.find((i) => i.name === '换洗衣物');
    const longClothes = long.find((i) => i.name === '换洗衣物');
    expect(shortClothes?.quantity).toBe(2);
    expect(longClothes?.quantity).toBe(7);
    // 长行程才会出现洗衣用品
    expect(short.some((i) => i.name === '便携洗衣液')).toBe(false);
    expect(long.some((i) => i.name === '便携洗衣液')).toBe(true);
  });

  it('天数至少按 1 天计算', () => {
    const items = suggestItems('上海', 0);
    expect(items.find((i) => i.name === '换洗衣物')?.quantity).toBe(1);
  });

  it('海边目的地包含防晒与泳装，防晒为共享物品', () => {
    const items = suggestItems('三亚海边', 5);
    const sunscreen = items.find((i) => i.name === '防晒霜');
    expect(sunscreen).toBeDefined();
    expect(sunscreen?.shared).toBe(true);
    expect(items.some((i) => i.name === '泳衣泳裤')).toBe(true);
    expect(items.some((i) => i.name === '羽绒服')).toBe(false);
  });

  it('冰雪目的地包含保暖装备', () => {
    const items = suggestItems('哈尔滨滑雪', 4);
    expect(items.some((i) => i.name === '羽绒服')).toBe(true);
    expect(items.some((i) => i.name === '泳衣泳裤')).toBe(false);
  });

  it('徒步露营目的地包含共享装备', () => {
    const items = suggestItems('武功山徒步露营', 3);
    const tent = items.find((i) => i.name === '帐篷');
    expect(tent?.shared).toBe(true);
    expect(items.some((i) => i.name === '登山鞋')).toBe(true);
  });

  it('生成的物品没有重名，且默认未打包、未分配', () => {
    const items = suggestItems('三亚海边亲子游', 6);
    const names = items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(items.every((i) => !i.packed && i.assigneeId === null)).toBe(true);
    expect(items.every((i) => i.quantity >= 1 && i.weightGrams >= 0)).toBe(true);
  });

  it('任何行程都包含证件等基础物品', () => {
    const items = suggestItems('任意目的地', 1);
    expect(items.some((i) => i.name === '证件与银行卡')).toBe(true);
    expect(items.some((i) => i.name === '常用药与急救包')).toBe(true);
  });
});
