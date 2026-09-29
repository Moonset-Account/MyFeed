import type { Chapter, Course, DayPlan } from './types';

/** 把 Date 格式化为本地 YYYY-MM-DD（避免时区偏移）。 */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now);
}

/** 解析 YYYY-MM-DD 为本地日期。 */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

/** start 到 end（含两端）的日期列表；start > end 时为空。 */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    out.push(cur);
    if (out.length > 3700) break; // 防御异常输入
  }
  return out;
}

export function diffDays(from: string, to: string): number {
  const ms = parseDate(to).getTime() - parseDate(from).getTime();
  return Math.round(ms / 86400000);
}

/** 章节权重：越不熟练权重越高（1-5 熟练度 → 5-1 权重）。 */
export function chapterWeight(ch: Chapter): number {
  const p = Math.min(5, Math.max(1, Math.round(ch.proficiency)));
  return 6 - p;
}

/**
 * 为单门课程生成每日计划。
 * - 可安排日：today 到考试日（含），剔除缺席日。
 * - 已完成章节（completedAt 非空）不参与排期，完成记录保留。
 * - 未完成的章节按熟练度从低到高排序，按权重尽量均匀地摊到各天。
 */
export function planCourse(
  course: Course,
  today: string,
  absentDates: ReadonlySet<string>,
): DayPlan[] {
  const days = datesBetween(today, course.examDate).filter((d) => !absentDates.has(d));
  const pending = course.chapters
    .filter((c) => c.completedAt === null)
    .slice()
    .sort((a, b) => a.proficiency - b.proficiency);
  if (days.length === 0 || pending.length === 0) return [];

  const totalWeight = pending.reduce((s, c) => s + chapterWeight(c), 0);
  const target = totalWeight / days.length;

  const plans: DayPlan[] = days.map((date) => ({ date, items: [] }));
  const loads: number[] = days.map(() => 0);
  let dayIdx = 0;
  for (const ch of pending) {
    // 当天负荷已达均值且非最后一天时，顺延到下一天
    while (dayIdx < days.length - 1 && plans[dayIdx].items.length > 0 && loads[dayIdx] >= target) {
      dayIdx++;
    }
    plans[dayIdx].items.push({ courseId: course.id, chapterId: ch.id });
    loads[dayIdx] += chapterWeight(ch);
  }
  return plans.filter((p) => p.items.length > 0);
}

/** 汇总所有课程的每日计划，按日期升序。 */
export function buildSchedule(
  courses: Course[],
  today: string,
  absentDates: readonly string[],
): DayPlan[] {
  const absent = new Set(absentDates);
  const byDate = new Map<string, DayPlan>();
  for (const course of courses) {
    for (const day of planCourse(course, today, absent)) {
      const existing = byDate.get(day.date);
      if (existing) existing.items.push(...day.items);
      else byDate.set(day.date, { date: day.date, items: [...day.items] });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface CourseProgress {
  totalChapters: number;
  doneChapters: number;
  totalWeight: number;
  doneWeight: number;
  /** 0-100，按权重计算；无章节时为 0 */
  percent: number;
}

export function courseProgress(course: Course): CourseProgress {
  const totalWeight = course.chapters.reduce((s, c) => s + chapterWeight(c), 0);
  const doneWeight = course.chapters
    .filter((c) => c.completedAt !== null)
    .reduce((s, c) => s + chapterWeight(c), 0);
  const doneChapters = course.chapters.filter((c) => c.completedAt !== null).length;
  return {
    totalChapters: course.chapters.length,
    doneChapters,
    totalWeight,
    doneWeight,
    percent: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
  };
}
