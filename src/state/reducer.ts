import {
  canCompleteStep,
  createInitialProgress,
  nextStepIndex,
} from '../lib/assembly';
import type { AssemblyPlan, MissingPartEntry, ProgressState } from '../lib/types';

export type Action =
  | { type: 'toggle-checkpoint'; stepId: string }
  | { type: 'complete-step'; stepId: string }
  | { type: 'uncomplete-step'; stepId: string }
  | { type: 'pause-missing'; missing: MissingPartEntry[] }
  | { type: 'resume' }
  | { type: 'reset'; planId: string };

/**
 * 进度状态迁移。返回 null 表示该动作被拒绝（例如必需检查点未勾选时完成步骤）。
 */
export function reduceProgress(
  plan: AssemblyPlan,
  state: ProgressState,
  action: Action,
): ProgressState | null {
  const touch = (next: ProgressState): ProgressState => ({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  switch (action.type) {
    case 'toggle-checkpoint': {
      const step = plan.steps.find((s) => s.id === action.stepId);
      if (!step || !step.checkpoint) return null;
      const checked = state.checkedCheckpoints.includes(action.stepId);
      return touch({
        ...state,
        checkedCheckpoints: checked
          ? state.checkedCheckpoints.filter((id) => id !== action.stepId)
          : [...state.checkedCheckpoints, action.stepId],
      });
    }
    case 'complete-step': {
      const step = plan.steps.find((s) => s.id === action.stepId);
      if (!step) return null;
      if (state.status === 'finished') return null;
      if (!canCompleteStep(step, state.checkedCheckpoints)) return null;
      if (state.completedStepIds.includes(action.stepId)) return state;
      const completedStepIds = [...state.completedStepIds, action.stepId];
      const finished = nextStepIndex(plan, completedStepIds) >= plan.steps.length;
      return touch({
        ...state,
        completedStepIds,
        status: finished ? 'finished' : state.status === 'paused-missing-parts' ? 'paused-missing-parts' : 'assembling',
      });
    }
    case 'uncomplete-step': {
      if (!state.completedStepIds.includes(action.stepId)) return null;
      return touch({
        ...state,
        completedStepIds: state.completedStepIds.filter((id) => id !== action.stepId),
        status: state.status === 'finished' ? 'assembling' : state.status,
      });
    }
    case 'pause-missing': {
      if (action.missing.length === 0) return null;
      return touch({ ...state, status: 'paused-missing-parts', missingParts: action.missing });
    }
    case 'resume': {
      if (state.status !== 'paused-missing-parts') return null;
      return touch({ ...state, status: 'assembling' });
    }
    case 'reset':
      return createInitialProgress(action.planId);
    default:
      return null;
  }
}
