import type { AppData, CareEvent, CareTaskType, LightLocation, Plant, PlantRecord, Postponement } from './types';
import { createEmptyData } from './care';
import { isValidISODate } from './dates';

const lightLocations: readonly LightLocation[] = [
  '东向阳台',
  '南向阳台',
  '西向阳台',
  '北向阳台',
  '半阴处',
  '室内窗台'
];

const taskTypes: readonly CareTaskType[] = ['water', 'fertilize', 'repot'];

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3650) {
    return value;
  }
  return undefined;
}

function parsePlant(value: unknown, index: number): Plant {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`第 ${index + 1} 盆植物不是有效对象。`);
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : '';
  const species = optionalString(item.species) ?? '';
  const lightLocation = item.lightLocation;
  const waterIntervalDays = positiveInteger(item.waterIntervalDays);
  const photoDataUrl = optionalString(item.photoDataUrl);

  if (!id) throw new Error(`第 ${index + 1} 盆植物缺少编号。`);
  if (!name) throw new Error(`第 ${index + 1} 盆植物缺少名称。`);
  if (!isValidISODate(createdAt)) throw new Error(`植物“${name}”的创建日期无效。`);
  if (!lightLocations.includes(lightLocation as LightLocation)) {
    throw new Error(`植物“${name}”的光照位置无效。`);
  }
  if (!waterIntervalDays) throw new Error(`植物“${name}”的浇水间隔无效。`);
  if (photoDataUrl && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(photoDataUrl)) {
    throw new Error(`植物“${name}”的照片格式不受支持。`);
  }

  const fertilizeIntervalDays = positiveInteger(item.fertilizeIntervalDays);
  const repotIntervalDays = positiveInteger(item.repotIntervalDays);

  return {
    id,
    name,
    species,
    lightLocation: lightLocation as LightLocation,
    waterIntervalDays,
    fertilizeIntervalDays,
    repotIntervalDays,
    photoDataUrl,
    notes: optionalString(item.notes),
    createdAt
  };
}

function parseRecord(value: unknown, index: number, plantIds: Set<string>): PlantRecord {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`第 ${index + 1} 条养护记录不是有效对象。`);
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const plantId = typeof item.plantId === 'string' ? item.plantId.trim() : '';
  const date = typeof item.date === 'string' ? item.date : '';
  const taskType = item.taskType;

  if (!id) throw new Error(`第 ${index + 1} 条记录缺少编号。`);
  if (!plantIds.has(plantId)) throw new Error(`第 ${index + 1} 条记录引用了不存在的植物。`);
  if (!taskTypes.includes(taskType as CareTaskType)) throw new Error(`第 ${index + 1} 条记录类型无效。`);
  if (!isValidISODate(date)) throw new Error(`第 ${index + 1} 条记录日期无效。`);

  const note = optionalString(item.note);
  if (item.kind === 'care') {
    const event: CareEvent = {
      id,
      plantId,
      kind: 'care',
      taskType: taskType as CareTaskType,
      date
    };
    if (note) event.note = note;
    return event;
  }

  if (item.kind === 'postponement') {
    if (taskType !== 'water') throw new Error(`第 ${index + 1} 条顺延记录只能用于浇水。`);
    const days = positiveInteger(item.days);
    if (!days || days > 30) throw new Error(`第 ${index + 1} 条顺延天数无效。`);

    const resolvedByEventId = optionalString(item.resolvedByEventId);
    const record: Postponement = {
      id,
      plantId,
      kind: 'postponement',
      taskType: 'water',
      date,
      days,
      reason: optionalString(item.reason) ?? '连续阴雨'
    };
    if (resolvedByEventId) record.resolvedByEventId = resolvedByEventId;
    return record;
  }

  throw new Error(`第 ${index + 1} 条记录种类无效。`);
}

export function parseBackup(input: unknown): AppData {
  if (typeof input !== 'object' || input === null) throw new Error('备份文件不是有效的 JSON 对象。');
  const root = input as Record<string, unknown>;
  if (root.version !== 1) throw new Error('备份版本不受支持。');
  if (!Array.isArray(root.plants) || !Array.isArray(root.records)) {
    throw new Error('备份中缺少植物或养护记录列表。');
  }

  const plants = root.plants.map(parsePlant);
  const ids = new Set(plants.map((plant) => plant.id));
  if (ids.size !== plants.length) throw new Error('备份中的植物编号重复。');

  const records = root.records.map((record, index) => parseRecord(record, index, ids));
  const recordIds = new Set(records.map((record) => record.id));
  if (recordIds.size !== records.length) throw new Error('备份中的养护记录编号重复。');

  const recordMap = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    if (record.kind !== 'postponement' || !record.resolvedByEventId) continue;
    const resolvedBy = recordMap.get(record.resolvedByEventId);
    if (!resolvedBy) {
      throw new Error('有顺延记录引用了不存在的浇水完成记录。');
    }
    if (
      resolvedBy.kind !== 'care' ||
      resolvedBy.taskType !== 'water' ||
      resolvedBy.plantId !== record.plantId
    ) {
      throw new Error('有顺延记录没有引用同一盆植物的实际浇水记录。');
    }
    if (resolvedBy.date < record.date) {
      throw new Error('有顺延记录被早于顺延日期的浇水记录结清。');
    }
  }

  return { version: 1, plants, records };
}

export function backupToJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function createBackupFileName(date = new Date()): string {
  const value = date.toISOString().slice(0, 10);
  return `plant-care-backup-${value}.json`;
}

export function emptyBackup(): AppData {
  return createEmptyData();
}

export function isProbablyBackup(value: unknown): boolean {
  try {
    parseBackup(value);
    return true;
  } catch {
    return false;
  }
}
