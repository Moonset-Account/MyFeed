import type { CareEvent, Plant, Postponement } from './types';

export interface BackupData {
  plants: Plant[];
  events: CareEvent[];
  postponements: Postponement[];
}

export interface BackupFile extends BackupData {
  app: 'balcony-plant-calendar';
  version: 1;
  exportedAt: string;
}

export function serializeBackup(data: BackupData, now: Date = new Date()): string {
  const file: BackupFile = {
    app: 'balcony-plant-calendar',
    version: 1,
    exportedAt: now.toISOString(),
    plants: data.plants,
    events: data.events,
    postponements: data.postponements
  };
  return JSON.stringify(file, null, 2);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIGHTS = ['full-sun', 'half-sun', 'bright-indirect', 'shade'];
const CARE_TYPES = ['water', 'fertilize', 'repot'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validPlant(p: unknown): p is Plant {
  if (!isRecord(p)) return false;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.species === 'string' &&
    typeof p.icon === 'string' &&
    typeof p.light === 'string' &&
    LIGHTS.includes(p.light) &&
    typeof p.waterIntervalDays === 'number' &&
    p.waterIntervalDays > 0 &&
    (p.fertilizeIntervalDays === null || typeof p.fertilizeIntervalDays === 'number') &&
    typeof p.createdAt === 'string' &&
    DATE_RE.test(p.createdAt)
  );
}

function validEvent(e: unknown): e is CareEvent {
  if (!isRecord(e)) return false;
  return (
    typeof e.id === 'string' &&
    typeof e.plantId === 'string' &&
    typeof e.type === 'string' &&
    CARE_TYPES.includes(e.type) &&
    typeof e.date === 'string' &&
    DATE_RE.test(e.date) &&
    typeof e.note === 'string'
  );
}

function validPostponement(p: unknown): p is Postponement {
  if (!isRecord(p)) return false;
  return (
    typeof p.id === 'string' &&
    typeof p.plantId === 'string' &&
    typeof p.days === 'number' &&
    p.days > 0 &&
    typeof p.reason === 'string' &&
    typeof p.createdAt === 'string' &&
    DATE_RE.test(p.createdAt)
  );
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: '文件不是有效的 JSON' };
  }
  if (!isRecord(raw) || raw.app !== 'balcony-plant-calendar' || raw.version !== 1) {
    return { ok: false, error: '不是本应用导出的备份文件' };
  }
  const { plants, events, postponements } = raw;
  if (!Array.isArray(plants) || !plants.every(validPlant)) {
    return { ok: false, error: '备份中的植物数据格式不正确' };
  }
  if (!Array.isArray(events) || !events.every(validEvent)) {
    return { ok: false, error: '备份中的养护记录格式不正确' };
  }
  if (!Array.isArray(postponements) || !postponements.every(validPostponement)) {
    return { ok: false, error: '备份中的顺延记录格式不正确' };
  }
  const plantIds = new Set(plants.map((p) => p.id));
  if (events.some((e) => !plantIds.has(e.plantId)) || postponements.some((p) => !plantIds.has(p.plantId))) {
    return { ok: false, error: '备份中存在指向未知植物的记录' };
  }
  return { ok: true, data: { plants, events, postponements } };
}
