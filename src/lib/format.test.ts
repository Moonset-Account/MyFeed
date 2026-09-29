import { describe, expect, it } from 'vitest';
import { addDays, formatAmount, STATUS_LABEL } from './format';

describe('前端格式化工具', () => {
  it('addDays 跨月计算正确', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formatAmount 处理小数与单位', () => {
    expect(formatAmount(55.5, 'g')).toBe('55.5g');
    expect(formatAmount(3, 'pcs')).toBe('3个');
  });

  it('订单状态有中文标签', () => {
    expect(STATUS_LABEL.confirmed).toBe('待取货');
    expect(STATUS_LABEL.cancelled).toBe('已取消');
    expect(STATUS_LABEL.completed).toBe('已完成');
  });
});
