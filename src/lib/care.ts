import type {
  AppData,
  CareEvent,
  CareTaskType,
  CareTodo,
  Plant,
  PlantRecord,
  Postponement,
  TodoStatus
} from './types';
import { addDays, diffDays, todayISODate } from './dates';

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    plants: [],
    records: []
  };
}

const taskLabels: Record<CareTaskType, string> = {
  water: '浇水',
  fertilize: '施肥',
  repot: '换盆'
};

export function taskLabel(taskType: CareTaskType): string {
  return taskLabels[taskType];
}

export function latestCareDate(
  records: PlantRecord[],
  plantId: string,
  taskType: CareTaskType
): string | undefined {
  return records
    .filter(
      (record): record is CareEvent =>
        record.kind === 'care' && record.plantId === plantId && record.taskType === taskType
    )
    .map((event) => event.date)
    .sort()
    .at(-1);
}

export function activePostponements(records: PlantRecord[], plantId: string): Postponement[] {
  return records.filter(
    (record): record is Postponement =>
      record.kind === 'postponement' &&
      record.plantId === plantId &&
      record.taskType === 'water' &&
      !record.resolvedByEventId
  );
}

function intervalFor(plant: Plant, taskType: CareTaskType): number | undefined {
  if (taskType === 'water') return plant.waterIntervalDays;
  if (taskType === 'fertilize') return plant.fertilizeIntervalDays;
  return plant.repotIntervalDays;
}

function todoStatus(daysFromToday: number): TodoStatus {
  if (daysFromToday > 0) return 'overdue';
  if (daysFromToday === 0) return 'today';
  return 'upcoming';
}

export function getTodo(plant: Plant, records: PlantRecord[], taskType: CareTaskType, today = todayISODate()): CareTodo | null {
  const interval = intervalFor(plant, taskType);
  if (!interval || interval <= 0) return null;

  const lastCareDate = latestCareDate(records, plant.id, taskType);
  const baseDate = lastCareDate ?? plant.createdAt;
  const postponedDays =
    taskType === 'water'
      ? activePostponements(records, plant.id).reduce((total, item) => total + item.days, 0)
      : 0;
  const scheduledDate = addDays(baseDate, interval);
  const dueDate = addDays(scheduledDate, postponedDays);
  const daysFromToday = diffDays(dueDate, today);

  return {
    id: `${plant.id}:${taskType}`,
    plantId: plant.id,
    plantName: plant.name,
    taskType,
    title: taskLabel(taskType),
    intervalDays: interval,
    lastCareDate,
    dueDate,
    daysFromToday,
    postponedDays,
    status: todoStatus(daysFromToday)
  };
}

export function buildTodos(data: AppData, today = todayISODate()): CareTodo[] {
  const taskTypes: CareTaskType[] = ['water', 'fertilize', 'repot'];
  return data.plants
    .flatMap((plant) => taskTypes.map((taskType) => getTodo(plant, data.records, taskType, today)))
    .filter((todo): todo is CareTodo => todo !== null)
    .sort((a, b) => {
      const statusRank = { overdue: 0, today: 1, upcoming: 2 };
      if (statusRank[a.status] !== statusRank[b.status]) {
        return statusRank[a.status] - statusRank[b.status];
      }
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.plantName !== b.plantName) return a.plantName.localeCompare(b.plantName, 'zh-Hans-CN');
      return a.taskType.localeCompare(b.taskType);
    });
}

export interface CareInput {
  plantId: string;
  taskType: CareTaskType;
  date?: string;
  note?: string;
}

export function addCareEvent(data: AppData, input: CareInput, today = todayISODate()): AppData {
  const date = input.date?.trim() || today;
  const event: CareEvent = {
    id: createId(),
    plantId: input.plantId,
    kind: 'care',
    taskType: input.taskType,
    date,
    note: input.note?.trim() || undefined
  };

  let records = [...data.records, event];

  if (input.taskType === 'water') {
    records = records.map((record) =>
      record.kind === 'postponement' &&
      record.plantId === input.plantId &&
      !record.resolvedByEventId &&
      record.date <= date
        ? { ...record, resolvedByEventId: event.id }
        : record
    );
  }

  return { ...data, records };
}

export interface PostponementInput {
  plantId: string;
  days: number;
  date?: string;
  reason?: string;
}

export function postponeWatering(
  data: AppData,
  input: PostponementInput,
  today = todayISODate()
): AppData {
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 30) {
    throw new Error('顺延天数需要是 1 到 30 之间的整数。');
  }

  const record: Postponement = {
    id: createId(),
    plantId: input.plantId,
    kind: 'postponement',
    taskType: 'water',
    date: input.date?.trim() || today,
    days: input.days,
    reason: input.reason?.trim() || '连续阴雨'
  };

  return { ...data, records: [...data.records, record] };
}

export function cancelPostponement(data: AppData, recordId: string): AppData {
  return {
    ...data,
    records: data.records.filter((record) => record.id !== recordId || record.kind !== 'postponement')
  };
}

export function upsertPlant(data: AppData, plant: Plant): AppData {
  const existing = data.plants.some((item) => item.id === plant.id);
  return {
    ...data,
    plants: existing
      ? data.plants.map((item) => (item.id === plant.id ? plant : item))
      : [...data.plants, plant]
  };
}

export function deletePlant(data: AppData, plantId: string): AppData {
  return {
    ...data,
    plants: data.plants.filter((plant) => plant.id !== plantId),
    records: data.records.filter((record) => record.plantId !== plantId)
  };
}

export function recordsForPlant(records: PlantRecord[], plantId: string): PlantRecord[] {
  return records
    .filter((record) => record.plantId === plantId)
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
}
