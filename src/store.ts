import { useEffect, useMemo, useReducer } from 'react';
import type { AppState, Area, Issue, Thresholds } from './types';
import { loadState, saveState } from './lib/storage';

export type Action =
  | { type: 'addArea'; area: Area }
  | { type: 'updateArea'; area: Area }
  | { type: 'removeArea'; areaId: string }
  | { type: 'addIssue'; issue: Issue }
  | { type: 'updateIssue'; issue: Issue }
  | { type: 'removeIssue'; issueId: string }
  | { type: 'setThresholds'; thresholds: Thresholds };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addArea':
      return { ...state, areas: [...state.areas, action.area] };
    case 'updateArea':
      return {
        ...state,
        areas: state.areas.map((a) => (a.id === action.area.id ? action.area : a)),
      };
    case 'removeArea':
      return {
        ...state,
        areas: state.areas.filter((a) => a.id !== action.areaId),
        issues: state.issues.map((i) => ({
          ...i,
          areaIds: i.areaIds.filter((id) => id !== action.areaId),
        })),
      };
    case 'addIssue':
      return { ...state, issues: [...state.issues, action.issue] };
    case 'updateIssue':
      return {
        ...state,
        issues: state.issues.map((i) => (i.id === action.issue.id ? action.issue : i)),
      };
    case 'removeIssue':
      return { ...state, issues: state.issues.filter((i) => i.id !== action.issueId) };
    case 'setThresholds':
      return { ...state, thresholds: action.thresholds };
  }
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return useMemo(() => ({ state, dispatch }), [state]);
}
