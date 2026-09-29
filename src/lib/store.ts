"use client";

import { OnboardingState, toDateString } from "./onboarding";

const STORAGE_KEY = "onboarding-map-state-v1";

export function defaultState(): OnboardingState {
  return { roleId: null, startDate: toDateString(new Date()), completed: {} };
}

export function loadState(): OnboardingState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      roleId: typeof parsed.roleId === "string" ? parsed.roleId : null,
      startDate:
        typeof parsed.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)
          ? parsed.startDate
          : toDateString(new Date()),
      completed:
        parsed.completed && typeof parsed.completed === "object" ? (parsed.completed as Record<string, string>) : {},
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: OnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（如隐私模式）时静默降级为内存态
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
