import type { RoleProgress, StoredState } from "./types";
import { ROLES } from "./roles";
import { todayISO } from "./onboarding";

const STORAGE_KEY = "onboarding-map:v1";

export function defaultRoleProgress(): RoleProgress {
  return { startDate: todayISO(), done: {} };
}

export function defaultState(): StoredState {
  return {
    version: 1,
    activeRoleId: ROLES[0].id,
    roles: { [ROLES[0].id]: defaultRoleProgress() },
  };
}

export function loadState(): StoredState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.version !== 1 || !parsed.roles || !parsed.activeRoleId) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(state: StoredState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
