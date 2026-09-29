import type { Share } from '../types';

/**
 * 分摊核心逻辑。所有函数都保证：返回的各成员金额之和 === totalCents。
 * 余数（分）按确定规则分配，保证结果可复现。
 */

/** 人均分摊：余数按成员顺序逐个 +1 分。 */
export function splitEqual(totalCents: number, memberIds: string[]): Share[] {
  if (memberIds.length === 0) throw new Error('至少需要一名参与成员');
  if (totalCents < 0) throw new Error('金额不能为负');
  const base = Math.floor(totalCents / memberIds.length);
  let remainder = totalCents - base * memberIds.length;
  return memberIds.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { memberId, amount: base + extra };
  });
}

/**
 * 固定比例分摊：按权重分配，使用最大余数法把零头补到总额。
 * 权重必须为正数；并列时按输入顺序优先。
 */
export function splitByRatio(
  totalCents: number,
  weights: { memberId: string; weight: number }[],
): Share[] {
  if (weights.length === 0) throw new Error('至少需要一名参与成员');
  if (totalCents < 0) throw new Error('金额不能为负');
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (!(totalWeight > 0)) throw new Error('比例之和必须大于 0');
  if (weights.some((w) => !(w.weight > 0))) throw new Error('比例必须为正数');

  const exact = weights.map((w) => ({
    memberId: w.memberId,
    raw: (totalCents * w.weight) / totalWeight,
  }));
  const floors = exact.map((e) => Math.floor(e.raw));
  let remainder = totalCents - floors.reduce((s, v) => s + v, 0);

  // 最大余数法：按小数部分从大到小补 1 分，并列时按下标（输入顺序）优先。
  const order = exact
    .map((e, i) => ({ i, frac: e.raw - Math.floor(e.raw) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    floors[order[k].i] += 1;
    remainder -= 1;
  }
  return weights.map((w, i) => ({ memberId: w.memberId, amount: floors[i] }));
}

/**
 * 指定金额分摊：直接采用给定金额，但校验总和必须与账单一致，
 * 否则抛出错误，由调用方提示用户修正。
 */
export function splitFixed(
  totalCents: number,
  amounts: { memberId: string; amount: number }[],
): Share[] {
  if (amounts.length === 0) throw new Error('至少需要一名参与成员');
  if (amounts.some((a) => !Number.isInteger(a.amount) || a.amount < 0)) {
    throw new Error('分摊金额必须是非负整数（分）');
  }
  const sum = amounts.reduce((s, a) => s + a.amount, 0);
  if (sum !== totalCents) {
    throw new Error(
      `指定金额合计 ${(sum / 100).toFixed(2)} 元，与账单总额 ${(totalCents / 100).toFixed(2)} 元不一致`,
    );
  }
  return amounts.map((a) => ({ memberId: a.memberId, amount: a.amount }));
}

/** 校验分摊结果与账单总额一致（防御性检查，也用于测试）。 */
export function sharesSumTo(shares: Share[], totalCents: number): boolean {
  return shares.reduce((s, sh) => s + sh.amount, 0) === totalCents;
}
