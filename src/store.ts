import { useEffect, useState } from 'react';
import type { LedgerState } from './types';

const STORAGE_KEY = 'shared-expenses-ledger:v1';

export const emptyState: LedgerState = {
  members: [],
  bills: [],
  payments: [],
  settlements: [],
};

function load(): LedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<LedgerState>;
    return {
      members: parsed.members ?? [],
      bills: parsed.bills ?? [],
      payments: parsed.payments ?? [],
      settlements: parsed.settlements ?? [],
    };
  } catch {
    return emptyState;
  }
}

/** 本地持久化：数据只存在浏览器 localStorage，不接入任何外部服务。 */
export function useLedger(): [LedgerState, React.Dispatch<React.SetStateAction<LedgerState>>] {
  const [state, setState] = useState<LedgerState>(load);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  return [state, setState];
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function currentMonth(): string {
  return today().slice(0, 7);
}
