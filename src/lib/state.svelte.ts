import type { CompletionRecord } from './types';
import { seedRecords } from './sampleData';

const STORAGE_KEY = 'pet-care-handoff.records.v1';

function loadRecords(): CompletionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CompletionRecord[];
    }
  } catch {
    // 本地数据损坏时回退到示例数据
  }
  return seedRecords();
}

function createBoardState() {
  let records = $state<CompletionRecord[]>(loadRecords());

  $effect.root(() => {
    $effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // 存储不可用时仅保留内存状态
      }
    });
  });

  return {
    get records() {
      return records;
    },
    add(record: CompletionRecord) {
      records = [...records, record];
    },
    reset() {
      records = seedRecords();
    }
  };
}

export const board = createBoardState();
