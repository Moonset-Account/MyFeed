import { describe, expect, it } from 'vitest';
import type { AppData, Plant } from './types';
import {
  activePostponements,
  addCareEvent,
  buildTodos,
  cancelPostponement,
  createEmptyData,
  deletePlant,
  getTodo,
  postponeWatering,
  recordsForPlant,
  upsertPlant
} from './care';

const plant: Plant = {
  id: 'p1',
  name: '薄荷',
  species: '薄荷',
  lightLocation: '东向阳台',
  waterIntervalDays: 5,
  fertilizeIntervalDays: 30,
  repotIntervalDays: 365,
  createdAt: '2026-01-01'
};

function withPlant(): AppData {
  return upsertPlant(createEmptyData(), plant);
}

describe('养护待办计算', () => {
  it('按建档日期和间隔生成首个待办', () => {
    const todo = getTodo(plant, [], 'water', '2026-01-06');
    expect(todo?.dueDate).toBe('2026-01-06');
    expect(todo?.status).toBe('today');
    expect(todo?.lastCareDate).toBeUndefined();
  });

  it('优先使用上次实际养护日期，逾期天数按本地日期计算', () => {
    const data = addCareEvent(withPlant(), {
      plantId: 'p1',
      taskType: 'water',
      date: '2026-01-10'
    });

    const todo = getTodo(plant, data.records, 'water', '2026-01-17');
    expect(todo?.dueDate).toBe('2026-01-15');
    expect(todo?.status).toBe('overdue');
    expect(todo?.daysFromToday).toBe(2);
  });

  it('阴雨顺延移动浇水日期但不产生实际浇水记录', () => {
    let data = withPlant();
    data = postponeWatering(data, { plantId: 'p1', days: 2, date: '2026-01-06' });

    const todo = getTodo(plant, data.records, 'water', '2026-01-08');
    expect(todo?.dueDate).toBe('2026-01-08');
    expect(todo?.postponedDays).toBe(2);
    expect(todo?.lastCareDate).toBeUndefined();
    expect(activePostponements(data.records, 'p1')).toHaveLength(1);
  });

  it('多次顺延可以叠加，实际浇水后结清顺延并开启下一周期', () => {
    let data = withPlant();
    data = postponeWatering(data, { plantId: 'p1', days: 2, date: '2026-01-06' });
    data = postponeWatering(data, { plantId: 'p1', days: 1, date: '2026-01-07' });

    expect(getTodo(plant, data.records, 'water', '2026-01-08')?.dueDate).toBe('2026-01-09');

    data = addCareEvent(data, { plantId: 'p1', taskType: 'water', date: '2026-01-09' });
    expect(activePostponements(data.records, 'p1')).toHaveLength(0);

    const nextTodo = getTodo(plant, data.records, 'water', '2026-01-09');
    expect(nextTodo?.dueDate).toBe('2026-01-14');
    expect(nextTodo?.lastCareDate).toBe('2026-01-09');
  });

  it('补录早于顺延发生日的浇水不会结清未来顺延', () => {
    let data = withPlant();
    data = postponeWatering(data, { plantId: 'p1', days: 2, date: '2026-01-08' });
    data = addCareEvent(data, { plantId: 'p1', taskType: 'water', date: '2026-01-05' });

    expect(activePostponements(data.records, 'p1')).toHaveLength(1);
  });

  it('为设置了周期的施肥和换盆分别生成待办', () => {
    let data = withPlant();
    data = addCareEvent(data, { plantId: 'p1', taskType: 'fertilize', date: '2026-01-01' });
    data = addCareEvent(data, { plantId: 'p1', taskType: 'repot', date: '2025-01-01' });

    const todos = buildTodos(data, '2026-01-02');
    expect(todos.map((todo) => todo.taskType)).toEqual(['repot', 'water', 'fertilize']);
    expect(todos.find((todo) => todo.taskType === 'repot')?.dueDate).toBe('2026-01-01');
    expect(todos.find((todo) => todo.taskType === 'fertilize')?.dueDate).toBe('2026-01-31');
  });

  it('撤销顺延和删除植物会移除相应记录', () => {
    let data = postponeWatering(withPlant(), { plantId: 'p1', days: 2 });
    const recordId = data.records[0]?.id ?? '';
    data = cancelPostponement(data, recordId);
    expect(data.records).toHaveLength(0);

    data = addCareEvent(data, { plantId: 'p1', taskType: 'water' });
    data = deletePlant(data, 'p1');
    expect(data.plants).toHaveLength(0);
    expect(data.records).toHaveLength(0);
  });

  it('按日期倒序返回单盆植物历史', () => {
    let data = withPlant();
    data = addCareEvent(data, { plantId: 'p1', taskType: 'water', date: '2026-01-01' });
    data = addCareEvent(data, { plantId: 'p1', taskType: 'fertilize', date: '2026-01-03' });
    data = postponeWatering(data, { plantId: 'p1', days: 1, date: '2026-01-02' });

    expect(recordsForPlant(data.records, 'p1').map((record) => record.date)).toEqual([
      '2026-01-03',
      '2026-01-02',
      '2026-01-01'
    ]);
  });
});
