import type { CareTask, CompletionRecord, Pet, TaskCategory } from './types';

export const CATEGORY_META: Record<TaskCategory, { label: string; icon: string }> = {
  feeding: { label: '喂食', icon: '🍚' },
  walking: { label: '遛狗', icon: '🦮' },
  cleaning: { label: '清洁', icon: '🧹' },
  medication: { label: '用药', icon: '💊' },
};

export const CATEGORY_ORDER: TaskCategory[] = ['feeding', 'walking', 'cleaning', 'medication'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> 本地日期串 YYYY-MM-DD */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** 在 YYYY-MM-DD 基础上平移天数，正确处理跨月/跨年 */
export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** ISO 时间串 -> 本地 "YYYY-MM-DD HH:mm"，用于展示与导出 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isTaskCompleted(taskId: string, records: CompletionRecord[]): boolean {
  return records.some((r) => r.taskId === taskId);
}

/** 某事项的全部确认记录，按完成时间升序 */
export function completionsFor(taskId: string, records: CompletionRecord[]): CompletionRecord[] {
  return records
    .filter((r) => r.taskId === taskId)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export interface CompleteResult {
  record: CompletionRecord;
  /** 本次确认是否为重复确认 */
  duplicate: boolean;
}

/**
 * 生成一条完成记录。若该事项此前已被确认过，新记录会标记 duplicate，
 * 由调用方决定是否提示用户。
 */
export function completeTask(
  task: CareTask,
  records: CompletionRecord[],
  completedBy: string,
  note: string,
  now: Date = new Date(),
): CompleteResult {
  const duplicate = isTaskCompleted(task.id, records);
  const record: CompletionRecord = {
    id: `rec-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: task.id,
    completedAt: now.toISOString(),
    completedBy,
    note: note.trim(),
    duplicate,
  };
  return { record, duplicate };
}

/** 当日全部事项，按计划时间排序 */
export function tasksForDate(tasks: CareTask[], date: string): CareTask[] {
  return tasks
    .filter((t) => t.date === date)
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

/** 当日尚未完成的事项 */
export function incompleteTasksForDate(
  tasks: CareTask[],
  records: CompletionRecord[],
  date: string,
): CareTask[] {
  return tasksForDate(tasks, date).filter((t) => !isTaskCompleted(t.id, records));
}

/** 当日事项对应的交接记录，按完成时间倒序 */
export function recordsForDate(
  records: CompletionRecord[],
  tasks: CareTask[],
  date: string,
): CompletionRecord[] {
  const ids = new Set(tasks.filter((t) => t.date === date).map((t) => t.id));
  return records
    .filter((r) => ids.has(r.taskId))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export interface ExportRow {
  completedAt: string;
  planDate: string;
  planTime: string;
  pet: string;
  category: string;
  title: string;
  completedBy: string;
  note: string;
  duplicate: string;
}

/** 把交接记录关联上事项与宠物信息，展开为可导出的行 */
export function buildExportRows(
  records: CompletionRecord[],
  tasks: CareTask[],
  pets: Pet[],
): ExportRow[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const petById = new Map(pets.map((p) => [p.id, p]));
  return records.map((r) => {
    const task = taskById.get(r.taskId);
    const pet = task ? petById.get(task.petId) : undefined;
    return {
      completedAt: formatDateTime(r.completedAt),
      planDate: task?.date ?? '',
      planTime: task?.time ?? '',
      pet: pet?.name ?? '',
      category: task ? CATEGORY_META[task.category].label : '',
      title: task?.title ?? '（事项已删除）',
      completedBy: r.completedBy,
      note: r.note,
      duplicate: r.duplicate ? '是' : '',
    };
  });
}

export const CSV_HEADER = ['完成时间', '计划日期', '计划时间', '宠物', '类别', '事项', '执行人', '备注', '重复确认'];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rowsToCsv(rows: ExportRow[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.completedAt, r.planDate, r.planTime, r.pet, r.category, r.title, r.completedBy, r.note, r.duplicate]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
