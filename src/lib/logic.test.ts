import { describe, expect, it } from 'vitest';
import {
  buildExportRows,
  completeTask,
  completionsFor,
  incompleteTasksForDate,
  isTaskCompleted,
  recordsForDate,
  rowsToCsv,
  shiftDate,
  tasksForDate,
  toDateKey,
} from './logic';
import { createSampleState } from './sampleData';
import type { CareTask } from './types';

const feedingTask: CareTask = {
  id: 't1',
  petId: 'p1',
  category: 'feeding',
  title: '早餐：猫粮 40g',
  date: '2026-09-30',
  time: '08:00',
};

describe('日期工具', () => {
  it('shiftDate 正确处理跨月与跨年', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('toDateKey 输出补零的本地日期', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('完成确认', () => {
  it('首次确认不是重复，再次确认被标记为重复', () => {
    const first = completeTask(feedingTask, [], '小林', '吃完了', new Date(2026, 8, 30, 8, 5));
    expect(first.duplicate).toBe(false);
    expect(first.record.duplicate).toBe(false);
    expect(isTaskCompleted(feedingTask.id, [first.record])).toBe(true);

    const second = completeTask(feedingTask, [first.record], '阿梅', '', new Date(2026, 8, 30, 9, 0));
    expect(second.duplicate).toBe(true);
    expect(second.record.duplicate).toBe(true);
  });

  it('备注会去除首尾空格', () => {
    const { record } = completeTask(feedingTask, [], '小林', '  一切正常  ');
    expect(record.note).toBe('一切正常');
  });

  it('completionsFor 按完成时间升序返回', () => {
    const a = completeTask(feedingTask, [], '小林', '', new Date(2026, 8, 30, 9, 0)).record;
    const b = completeTask(feedingTask, [a], '阿梅', '', new Date(2026, 8, 30, 8, 0)).record;
    const list = completionsFor(feedingTask.id, [a, b]);
    expect(list[0].completedBy).toBe('阿梅');
    expect(list[1].completedBy).toBe('小林');
  });
});

describe('按日期查看', () => {
  const state = createSampleState('2026-09-30');

  it('tasksForDate 只返回当日事项并按时间排序', () => {
    const list = tasksForDate(state.tasks, '2026-09-30');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.date === '2026-09-30')).toBe(true);
    const times = list.map((t) => t.time);
    expect([...times].sort()).toEqual(times);
  });

  it('incompleteTasksForDate 排除已完成事项', () => {
    const all = tasksForDate(state.tasks, '2026-09-30');
    const incomplete = incompleteTasksForDate(state.tasks, state.records, '2026-09-30');
    const doneIds = new Set(state.records.map((r) => r.taskId));
    expect(incomplete.every((t) => !doneIds.has(t.id))).toBe(true);
    expect(incomplete.length).toBeLessThan(all.length);
  });

  it('recordsForDate 只包含当日事项的记录，且倒序排列', () => {
    const recs = recordsForDate(state.records, state.tasks, '2026-09-29');
    const ids = new Set(state.tasks.filter((t) => t.date === '2026-09-29').map((t) => t.id));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => ids.has(r.taskId))).toBe(true);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].completedAt >= recs[i].completedAt).toBe(true);
    }
  });
});

describe('导出', () => {
  const state = createSampleState('2026-09-30');

  it('buildExportRows 关联宠物与事项信息，并标记重复确认', () => {
    const rows = buildExportRows(state.records, state.tasks, state.pets);
    expect(rows.length).toBe(state.records.length);

    const walk = rows.find((r) => r.title.includes('晨间遛狗') && r.planDate === '2026-09-29');
    expect(walk?.pet).toBe('豆豆');
    expect(walk?.category).toBe('遛狗');
    expect(walk?.completedBy).toBe('阿梅');

    const dup = rows.find((r) => r.duplicate === '是');
    expect(dup?.title).toContain('晚间遛狗');
    expect(dup?.completedBy).toBe('小林');
  });

  it('rowsToCsv 包含表头并正确转义逗号、引号与换行', () => {
    const rows = buildExportRows(state.records, state.tasks, state.pets);
    rows[0].note = '含有,逗号 和 "引号"\n以及换行';
    const csv = rowsToCsv(rows);
    expect(csv.split('\n')[0]).toBe('完成时间,计划日期,计划时间,宠物,类别,事项,执行人,备注,重复确认');
    expect(csv).toContain('"含有,逗号 和 ""引号""\n以及换行"');
  });

  it('事项被删除后导出仍可读', () => {
    const rows = buildExportRows(state.records, [], []);
    expect(rows[0].title).toBe('（事项已删除）');
    expect(rows[0].pet).toBe('');
  });
});

describe('示例数据', () => {
  it('使用虚构宠物并覆盖喂食/遛狗/清洁/用药四个类别', () => {
    const state = createSampleState('2026-09-30');
    expect(state.pets.map((p) => p.name)).toEqual(['布丁', '豆豆', '雪球']);
    const cats = new Set(state.tasks.map((t) => t.category));
    expect(cats).toEqual(new Set(['feeding', 'walking', 'cleaning', 'medication']));
  });

  it('示例中包含一条重复确认记录用于演示提示', () => {
    const state = createSampleState('2026-09-30');
    expect(state.records.some((r) => r.duplicate)).toBe(true);
  });

  it('示例记录都能关联到存在的事项', () => {
    const state = createSampleState('2026-09-30');
    const ids = new Set(state.tasks.map((t) => t.id));
    expect(state.records.every((r) => ids.has(r.taskId))).toBe(true);
  });
});
