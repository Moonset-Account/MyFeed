import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildSchedule,
  chapterWeight,
  courseProgress,
  datesBetween,
  diffDays,
  planCourse,
} from './scheduler';
import type { Chapter, Course } from './types';

function chapter(id: string, proficiency: number, completedAt: string | null = null): Chapter {
  return { id, name: `章节${id}`, proficiency, completedAt };
}

function course(chapters: Chapter[], examDate = '2026-10-10'): Course {
  return { id: 'c1', name: '数学', examDate, chapters };
}

describe('日期工具', () => {
  it('datesBetween 含首尾日期', () => {
    expect(datesBetween('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('addDays 跨月进位', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('diffDays 计算剩余天数', () => {
    expect(diffDays('2026-10-01', '2026-10-10')).toBe(9);
  });
});

describe('planCourse 每日分配', () => {
  it('按剩余天数摊开全部未完成章节', () => {
    const c = course([chapter('a', 2), chapter('b', 3), chapter('c', 4)], '2026-10-03');
    const plan = planCourse(c, '2026-10-01', new Set());
    const all = plan.flatMap((p) => p.items.map((i) => i.chapterId));
    expect(all.sort()).toEqual(['a', 'b', 'c']);
    expect(plan.every((p) => p.date >= '2026-10-01' && p.date <= '2026-10-03')).toBe(true);
  });

  it('熟练度低的章节排得更早、权重更高', () => {
    expect(chapterWeight(chapter('x', 1))).toBeGreaterThan(chapterWeight(chapter('y', 5)));
    const c = course([chapter('easy', 5), chapter('hard', 1)], '2026-10-02');
    const plan = planCourse(c, '2026-10-01', new Set());
    expect(plan[0].items[0].chapterId).toBe('hard');
  });

  it('已完成章节不参与排期', () => {
    const c = course([chapter('done', 1, '2026-09-28'), chapter('todo', 1)], '2026-10-02');
    const plan = planCourse(c, '2026-10-01', new Set());
    const all = plan.flatMap((p) => p.items.map((i) => i.chapterId));
    expect(all).toEqual(['todo']);
  });

  it('考试已过期时不产生计划', () => {
    const c = course([chapter('a', 3)], '2026-09-01');
    expect(planCourse(c, '2026-10-01', new Set())).toEqual([]);
  });

  it('考试当天仍安排一天', () => {
    const c = course([chapter('a', 3)], '2026-10-01');
    const plan = planCourse(c, '2026-10-01', new Set());
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe('2026-10-01');
  });
});

describe('缺席重排', () => {
  it('缺席日不安排，未完成章节顺延到后续日期', () => {
    const c = course([chapter('a', 1), chapter('b', 1), chapter('c', 1)], '2026-10-03');
    const before = planCourse(c, '2026-10-01', new Set());
    expect(before.some((p) => p.date === '2026-10-02')).toBe(true);

    const after = planCourse(c, '2026-10-01', new Set(['2026-10-02']));
    expect(after.some((p) => p.date === '2026-10-02')).toBe(false);
    const all = after.flatMap((p) => p.items.map((i) => i.chapterId));
    expect(all.sort()).toEqual(['a', 'b', 'c']);
  });

  it('重排后已完成记录保留且不再出现', () => {
    const c = course(
      [chapter('done', 2, '2026-10-01'), chapter('x', 2), chapter('y', 2)],
      '2026-10-03',
    );
    const plan = planCourse(c, '2026-10-02', new Set(['2026-10-02']));
    const all = plan.flatMap((p) => p.items.map((i) => i.chapterId));
    expect(all.sort()).toEqual(['x', 'y']);
    // 完成记录本身仍在课程数据里
    expect(c.chapters[0].completedAt).toBe('2026-10-01');
  });
});

describe('buildSchedule 多课程汇总', () => {
  it('合并同一天不同课程的章节并按日期排序', () => {
    const c1 = course([chapter('a', 3)], '2026-10-02');
    const c2: Course = { id: 'c2', name: '英语', examDate: '2026-10-02', chapters: [chapter('b', 3)] };
    const schedule = buildSchedule([c1, c2], '2026-10-01', []);
    expect(schedule.map((d) => d.date)).toEqual(['2026-10-01']);
    expect(schedule[0].items).toHaveLength(2);
  });
});

describe('courseProgress', () => {
  it('按权重计算完成百分比', () => {
    const c = course([chapter('a', 1, '2026-09-29'), chapter('b', 5)]);
    const p = courseProgress(c);
    expect(p.doneChapters).toBe(1);
    expect(p.percent).toBe(Math.round((5 / 6) * 100));
  });

  it('空课程进度为 0', () => {
    expect(courseProgress(course([])).percent).toBe(0);
  });
});
