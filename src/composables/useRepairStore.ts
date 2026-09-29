import { computed, ref } from 'vue';
import {
  advanceStatus,
  completeInspection,
  createRepairRecord,
  getTodoStats,
  INSPECTION_ITEMS,
  type InspectionChecklist,
  type InspectionInput,
  type RepairInput,
  type RepairRecord,
} from '../core/repairs';

const STORAGE_KEY = 'book-repair-register:records:v1';

function createSeedRecords(): RepairRecord[] {
  const checkedChecklist = Object.fromEntries(
    INSPECTION_ITEMS.map((item) => [item, true]),
  ) as InspectionChecklist;

  let first = createRepairRecord(
    {
      bookNumber: 'B-1001',
      damageLocation: '封面右下角折裂',
      photoNote: '2025 年归档照片：封面折痕明显，边角磨损。',
      repairSteps: ['压平折角', '用薄棉纸加固内侧'],
      handler: '周敏',
    },
    'seed-b-1001-old',
    '2025-11-08T02:20:00.000Z',
  );
  first = advanceStatus(first, '2025-11-08T03:00:00.000Z');
  first = advanceStatus(first, '2025-11-08T04:10:00.000Z');
  first = completeInspection(
    first,
    {
      inspector: '陈丽',
      checklist: checkedChecklist,
    },
    '2025-11-08T04:30:00.000Z',
  );

  const pending = createRepairRecord(
    {
      bookNumber: 'B-1001',
      damageLocation: '第 36 页与书脊连接处脱胶',
      photoNote: '新照片说明：中缝张开约 4 厘米，未见缺页。',
      repairSteps: ['清除残胶', '重新刷胶并固定压平'],
      handler: '王建国',
    },
    'seed-b-1001-new',
    '2026-09-29T01:15:00.000Z',
  );

  let repairing = createRepairRecord(
    {
      bookNumber: 'B-2048',
      damageLocation: '封底靠近书脊处撕裂',
      photoNote: '照片说明：撕裂长度约 6 厘米，撕裂边缘干燥。',
      repairSteps: ['对齐撕裂边缘', '贴加固纸', '压置一夜'],
      handler: '赵一鸣',
    },
    'seed-b-2048',
    '2026-09-28T06:40:00.000Z',
  );
  repairing = advanceStatus(repairing, '2026-09-28T07:05:00.000Z');

  let ready = createRepairRecord(
    {
      bookNumber: 'B-3309',
      damageLocation: '书名页边角缺损',
      photoNote: '照片说明：缺损未影响文字和条码。',
      repairSteps: ['补纸裁切', '黏合修补', '修平边缘'],
      handler: '孙琳',
    },
    'seed-b-3309',
    '2026-09-27T08:30:00.000Z',
  );
  ready = advanceStatus(ready, '2026-09-27T09:00:00.000Z');
  ready = advanceStatus(ready, '2026-09-27T10:20:00.000Z');
  ready = completeInspection(
    ready,
    {
      inspector: '陈丽',
      checklist: checkedChecklist,
    },
    '2026-09-27T11:00:00.000Z',
  );

  return [pending, repairing, ready, first];
}

function sortRecords(records: RepairRecord[]): RepairRecord[] {
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function readRecords(): RepairRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seedRecords = createSeedRecords();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedRecords));
      return seedRecords;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as RepairRecord[];
  } catch {
    return [];
  }
}

const records = ref<RepairRecord[]>(sortRecords(readRecords()));
const storageError = ref('');

function persist(nextRecords: RepairRecord[]): void {
  records.value = sortRecords(nextRecords);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value));
    storageError.value = '';
  } catch {
    storageError.value = '浏览器本地存储不可用，当前修改只保留在页面中。';
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `repair-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRepairStore() {
  const stats = computed(() => getTodoStats(records.value));

  function addRecord(input: RepairInput): RepairRecord {
    const record = createRepairRecord(input, createId(), new Date().toISOString());
    persist([record, ...records.value]);
    return record;
  }

  function moveForward(id: string): void {
    const record = records.value.find((item) => item.id === id);
    if (!record) {
      return;
    }
    persist(records.value.map((item) => (item.id === id ? advanceStatus(item, new Date().toISOString()) : item)));
  }

  function finishInspection(id: string, input: InspectionInput): void {
    const record = records.value.find((item) => item.id === id);
    if (!record) {
      return;
    }
    persist(
      records.value.map((item) =>
        item.id === id ? completeInspection(item, input, new Date().toISOString()) : item,
      ),
    );
  }

  function resetDemoRecords(): void {
    persist(createSeedRecords());
  }

  function clearRecords(): void {
    persist([]);
  }

  return {
    records,
    stats,
    storageError,
    addRecord,
    moveForward,
    finishInspection,
    resetDemoRecords,
    clearRecords,
  };
}
