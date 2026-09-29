import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isValidISODate } from './dates';

describe('日期工具', () => {
  it('按自然日跨月加减', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -2)).toBe('2026-02-27');
  });

  it('计算两个日期之间的天数', () => {
    expect(diffDays('2026-01-01', '2026-01-11')).toBe(10);
    expect(diffDays('2026-01-11', '2026-01-01')).toBe(-10);
  });

  it('拒绝不存在或格式错误的日期', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026/01/01')).toBe(false);
  });
});
