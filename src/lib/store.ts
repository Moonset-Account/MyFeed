import { writable } from 'svelte/store';
import type { BoardState, CareTask } from './types';
import { completeTask } from './logic';
import { createSampleState } from './sampleData';

const STORAGE_KEY = 'pet-care-handoff-board:v1';

function loadInitial(): BoardState {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BoardState;
        if (
          parsed &&
          Array.isArray(parsed.pets) &&
          Array.isArray(parsed.caregivers) &&
          Array.isArray(parsed.tasks) &&
          Array.isArray(parsed.records)
        ) {
          return parsed;
        }
      }
    } catch {
      // 数据损坏时回退到示例数据
    }
  }
  return createSampleState();
}

function createBoard() {
  const { subscribe, update, set } = writable<BoardState>(loadInitial());

  return {
    subscribe,
    /** 确认完成某事项，返回是否为重复确认 */
    confirm(task: CareTask, completedBy: string, note: string): { duplicate: boolean } {
      let duplicate = false;
      update((s) => {
        const result = completeTask(task, s.records, completedBy, note);
        duplicate = result.duplicate;
        return { ...s, records: [...s.records, result.record] };
      });
      return { duplicate };
    },
    addTask(task: CareTask): void {
      update((s) => ({ ...s, tasks: [...s.tasks, task] }));
    },
    /** 删除事项，同时清理其交接记录 */
    removeTask(taskId: string): void {
      update((s) => ({
        ...s,
        tasks: s.tasks.filter((t) => t.id !== taskId),
        records: s.records.filter((r) => r.taskId !== taskId),
      }));
    },
    addCaregiver(name: string): void {
      const n = name.trim();
      if (!n) return;
      update((s) => {
        if (s.caregivers.some((c) => c.name === n)) return s;
        return { ...s, caregivers: [...s.caregivers, { id: `cg-${Date.now().toString(36)}`, name: n }] };
      });
    },
    /** 清空当前数据并恢复虚构示例数据 */
    reset(): void {
      set(createSampleState());
    },
  };
}

export const board = createBoard();

if (typeof localStorage !== 'undefined') {
  board.subscribe((s) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // 存储失败（如隐私模式）时仅保留内存状态
    }
  });
}
