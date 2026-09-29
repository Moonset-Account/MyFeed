import type { AssemblyPlan, ProgressState } from '../types';
import { createEmptyProgress } from './assembly';

const PLAN_KEY = 'fac.plan.v1';
const PROGRESS_KEY = 'fac.progress.v1';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 读取本地保存的方案；没有或解析失败时返回 null */
export function loadPlan(): AssemblyPlan | null {
  return safeParse<AssemblyPlan>(localStorage.getItem(PLAN_KEY));
}

export function savePlan(plan: AssemblyPlan): void {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

/** 恢复进度；方案不一致或数据损坏时返回该方案的空白进度 */
export function loadProgress(planId: string): ProgressState {
  const saved = safeParse<ProgressState>(localStorage.getItem(PROGRESS_KEY));
  if (saved && saved.planId === planId && Array.isArray(saved.completedStepIds)) {
    return {
      ...createEmptyProgress(planId),
      ...saved,
      checkedCheckpoints: saved.checkedCheckpoints ?? {},
      missingParts: saved.missingParts ?? [],
    };
  }
  return createEmptyProgress(planId);
}

export function saveProgress(progress: ProgressState): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function clearProgress(): void {
  localStorage.removeItem(PROGRESS_KEY);
}
