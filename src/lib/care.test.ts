import { describe, expect, it } from 'vitest';
import {
  activePostponedDays,
  addDays,
  computeTodos,
  diffDays,
  lastCareDate,
  waterDueDate
} from './care';
import type { CareEvent, Plant, Postponement } from './types';

const plant: Plant = {
  id: 'p1',
  name: '龟背竹',
  species: '',
  icon: '🪴',
  light: 'bright-indirect',
  waterIntervalDays: 7,
  fertilizeIntervalDays: 30,
  createdAt: '2026-09-01'
};

function ev(type: CareEvent['type'], date: string, id = Math.random().toString()): CareEvent {
  return { id, plantId: 'p1', type, date, note: '' };
}

function pp(days: number, createdAt: string): Postponement {
  return { id: Math.random().toString(), plantId: 'p1', days, reason: '连续阴雨', createdAt };
}

describe('日期工具', () => {
  it('addDays 跨月计算', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('diffDays 计算差值', () => {
    expect(diffDays('2026-09-10', '2026-09-01')).toBe(9);
    expect(diffDays('2026-09-01', '2026-09-10')).toBe(-9);
  });
});

describe('上次养护日期', () => {
  it('无记录时回退到建档日期', () => {
    expect(lastCareDate(plant, [], 'water')).toBe('2026-09-01');
  });
  it('取最近一次实际浇水日期', () => {
    const events = [ev('water', '2026-09-05'), ev('water', '2026-09-12'), ev('fertilize', '2026-09-20')];
    expect(lastCareDate(plant, events, 'water')).toBe('2026-09-12');
  });
});

describe('浇水到期日', () => {
  it('到期日 = 上次浇水 + 间隔', () => {
    expect(waterDueDate(plant, [ev('water', '2026-09-10')], [])).toBe('2026-09-17');
  });

  it('阴雨顺延只推迟到期日，不视为完成', () => {
    const events = [ev('water', '2026-09-10')];
    const postponements = [pp(2, '2026-09-16')];
    expect(waterDueDate(plant, events, postponements)).toBe('2026-09-19');
    // 顺延不产生浇水事件，上次实际浇水日期不变
    expect(lastCareDate(plant, events, 'water')).toBe('2026-09-10');
  });

  it('浇水完成后，上一周期的顺延不再生效', () => {
    const events = [ev('water', '2026-09-10'), ev('water', '2026-09-20')];
    const postponements = [pp(3, '2026-09-15')];
    expect(activePostponedDays(plant, events, postponements)).toBe(0);
    expect(waterDueDate(plant, events, postponements)).toBe('2026-09-27');
  });

  it('同一周期内多次顺延累加', () => {
    const events = [ev('water', '2026-09-10')];
    const postponements = [pp(1, '2026-09-16'), pp(2, '2026-09-17')];
    expect(activePostponedDays(plant, events, postponements)).toBe(3);
    expect(waterDueDate(plant, events, postponements)).toBe('2026-09-20');
  });
});

describe('待办生成', () => {
  it('按上次实际养护日期生成浇水与施肥待办', () => {
    const events = [ev('water', '2026-09-24'), ev('fertilize', '2026-09-01')];
    const todos = computeTodos([plant], events, [], '2026-09-30');
    const water = todos.find((t) => t.type === 'water')!;
    const fert = todos.find((t) => t.type === 'fertilize')!;
    expect(water.dueDate).toBe('2026-10-01');
    expect(water.status).toBe('upcoming');
    expect(fert.dueDate).toBe('2026-10-01');
  });

  it('逾期与当天状态判定', () => {
    const events = [ev('water', '2026-09-20')]; // 到期 09-27
    const todos = computeTodos([plant], events, [], '2026-09-30');
    expect(todos.find((t) => t.type === 'water')!.status).toBe('overdue');
    const todos2 = computeTodos([plant], events, [], '2026-09-27');
    expect(todos2.find((t) => t.type === 'water')!.status).toBe('today');
  });

  it('顺延后的待办仍挂起且标注顺延天数', () => {
    const events = [ev('water', '2026-09-20')];
    const postponements = [pp(2, '2026-09-26')];
    const todos = computeTodos([plant], events, postponements, '2026-09-28');
    const water = todos.find((t) => t.type === 'water')!;
    expect(water.dueDate).toBe('2026-09-29');
    expect(water.postponedDays).toBe(2);
    expect(water.status).toBe('upcoming');
  });

  it('不跟踪施肥周期的植物不生成施肥待办', () => {
    const noFert: Plant = { ...plant, fertilizeIntervalDays: null };
    const todos = computeTodos([noFert], [], [], '2026-09-30');
    expect(todos.every((t) => t.type === 'water')).toBe(true);
  });

  it('换盆记录不影响浇水周期', () => {
    const events = [ev('water', '2026-09-24'), ev('repot', '2026-09-28')];
    expect(waterDueDate(plant, events, [])).toBe('2026-10-01');
  });
});
