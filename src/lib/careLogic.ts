import type { CompletionRecord, TaskInstance, TaskTemplate } from './types';

/** 把 Date 转成 YYYY-MM-DD（本地时区） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 日期加减天数，返回 YYYY-MM-DD */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  return toDateKey(date);
}

export function makeInstanceId(templateId: string, date: string): string {
  return `${templateId}@${date}`;
}

/** 由每日模板生成某一天的事项实例，按计划时间排序 */
export function instancesForDate(templates: TaskTemplate[], date: string): TaskInstance[] {
  return templates
    .map((t) => ({
      instanceId: makeInstanceId(t.id, date),
      templateId: t.id,
      date,
      petId: t.petId,
      type: t.type,
      title: t.title,
      time: t.time,
      instruction: t.instruction
    }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.instanceId.localeCompare(b.instanceId));
}

/** 某事项实例的所有完成记录，按完成时间升序 */
export function recordsForInstance(
  records: CompletionRecord[],
  instanceId: string
): CompletionRecord[] {
  return records
    .filter((r) => r.instanceId === instanceId)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function isCompleted(records: CompletionRecord[], instanceId: string): boolean {
  return records.some((r) => r.instanceId === instanceId);
}

/** 某日期下仍未完成的事项 */
export function incompleteInstances(
  instances: TaskInstance[],
  records: CompletionRecord[]
): TaskInstance[] {
  return instances.filter((inst) => !isCompleted(records, inst.instanceId));
}

let seq = 0;

/**
 * 生成一条完成记录。
 * 若该事项已有完成记录，则新记录标记 duplicate=true（重复确认）。
 */
export function buildCompletion(
  instance: TaskInstance,
  petName: string,
  completedBy: string,
  note: string,
  existing: CompletionRecord[],
  now: Date = new Date()
): CompletionRecord {
  return {
    id: `${now.getTime().toString(36)}-${(seq++).toString(36)}`,
    instanceId: instance.instanceId,
    date: instance.date,
    taskTitle: instance.title,
    petName,
    completedAt: now.toISOString(),
    completedBy,
    note: note.trim(),
    duplicate: existing.some((r) => r.instanceId === instance.instanceId)
  };
}

/** 交接记录按完成时间倒序 */
export function sortRecordsDesc(records: CompletionRecord[]): CompletionRecord[] {
  return [...records].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADER = ['日期', '事项', '宠物', '完成时间', '执行人', '备注', '重复确认'];

/** 导出交接记录为 CSV 文本（带 BOM，方便 Excel 打开） */
export function recordsToCSV(records: CompletionRecord[]): string {
  const rows = sortRecordsDesc(records).map((r) =>
    [
      r.date,
      r.taskTitle,
      r.petName,
      r.completedAt,
      r.completedBy,
      r.note,
      r.duplicate ? '是' : '否'
    ]
      .map(csvEscape)
      .join(',')
  );
  return '﻿' + [CSV_HEADER.join(','), ...rows].join('\n');
}

/** 导出交接记录为格式化 JSON 文本 */
export function recordsToJSON(records: CompletionRecord[]): string {
  return JSON.stringify(sortRecordsDesc(records), null, 2);
}
