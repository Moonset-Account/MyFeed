import { describe, expect, it } from 'vitest';
import { splitEqual, splitByRatio, splitFixed, sharesSumTo } from './split';

describe('splitEqual 人均分摊', () => {
  it('整除时每人相等', () => {
    const shares = splitEqual(30000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amount)).toEqual([10000, 10000, 10000]);
  });

  it('不能整除时余数按顺序补 1 分，且总额不变', () => {
    const shares = splitEqual(10000, ['a', 'b', 'c']); // 100 元 / 3 人
    expect(shares.map((s) => s.amount)).toEqual([3334, 3333, 3333]);
    expect(sharesSumTo(shares, 10000)).toBe(true);
  });

  it('1 分钱分给多人也不丢总额', () => {
    const shares = splitEqual(1, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amount)).toEqual([1, 0, 0]);
    expect(sharesSumTo(shares, 1)).toBe(true);
  });

  it('拒绝空成员列表', () => {
    expect(() => splitEqual(100, [])).toThrow();
  });
});

describe('splitByRatio 固定比例分摊', () => {
  it('按比例分配且总额一致', () => {
    const shares = splitByRatio(10000, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 1 },
    ]);
    expect(shares.map((s) => s.amount)).toEqual([5000, 5000]);
  });

  it('2:1:1 分 100.01 元，最大余数法补齐零头', () => {
    const shares = splitByRatio(10001, [
      { memberId: 'a', weight: 2 },
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
    ]);
    // 精确值 5000.5 / 2500.25 / 2500.25 → 5001 / 2500 / 2500
    expect(shares.map((s) => s.amount)).toEqual([5001, 2500, 2500]);
    expect(sharesSumTo(shares, 10001)).toBe(true);
  });

  it('任意金额与比例下总额始终守恒', () => {
    for (const total of [1, 7, 99, 12345, 999999]) {
      const shares = splitByRatio(total, [
        { memberId: 'a', weight: 3 },
        { memberId: 'b', weight: 7 },
        { memberId: 'c', weight: 13 },
        { memberId: 'd', weight: 29 },
      ]);
      expect(sharesSumTo(shares, total)).toBe(true);
    }
  });

  it('拒绝非正比例', () => {
    expect(() =>
      splitByRatio(100, [
        { memberId: 'a', weight: 1 },
        { memberId: 'b', weight: 0 },
      ]),
    ).toThrow();
  });
});

describe('splitFixed 指定金额分摊', () => {
  it('合计与账单一致时原样采用', () => {
    const shares = splitFixed(10000, [
      { memberId: 'a', amount: 6000 },
      { memberId: 'b', amount: 4000 },
    ]);
    expect(shares.map((s) => s.amount)).toEqual([6000, 4000]);
  });

  it('合计不一致时拒绝保存', () => {
    expect(() =>
      splitFixed(10000, [
        { memberId: 'a', amount: 6000 },
        { memberId: 'b', amount: 3000 },
      ]),
    ).toThrow(/不一致/);
  });

  it('拒绝负数金额', () => {
    expect(() => splitFixed(100, [{ memberId: 'a', amount: -1 }])).toThrow();
  });
});
