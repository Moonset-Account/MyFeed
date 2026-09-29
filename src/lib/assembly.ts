import type {
  AssemblyPlan,
  AssemblyStep,
  Checkpoint,
  MissingPartReport,
  Part,
  ProgressState,
} from '../types';

export function createEmptyProgress(planId: string): ProgressState {
  return {
    planId,
    completedStepIds: [],
    checkedCheckpoints: {},
    missingParts: [],
    paused: false,
    updatedAt: Date.now(),
  };
}

/** 步骤中尚未勾选的必需检查点 */
export function uncheckedRequiredCheckpoints(
  step: AssemblyStep,
  progress: ProgressState,
): Checkpoint[] {
  const checked = new Set(progress.checkedCheckpoints[step.id] ?? []);
  return step.checkpoints.filter((c) => c.required && !checked.has(c.id));
}

export interface StepCompletionCheck {
  ok: boolean;
  missing: Checkpoint[];
}

/** 完成步骤前校验：必需检查点必须全部勾选 */
export function checkStepCompletion(
  step: AssemblyStep,
  progress: ProgressState,
): StepCompletionCheck {
  const missing = uncheckedRequiredCheckpoints(step, progress);
  return { ok: missing.length === 0, missing };
}

export function isStepCompleted(stepId: string, progress: ProgressState): boolean {
  return progress.completedStepIds.includes(stepId);
}

export function toggleCheckpoint(
  progress: ProgressState,
  stepId: string,
  checkpointId: string,
): ProgressState {
  const current = progress.checkedCheckpoints[stepId] ?? [];
  const next = current.includes(checkpointId)
    ? current.filter((id) => id !== checkpointId)
    : [...current, checkpointId];
  return {
    ...progress,
    checkedCheckpoints: { ...progress.checkedCheckpoints, [stepId]: next },
    updatedAt: Date.now(),
  };
}

export interface CompleteStepResult {
  progress: ProgressState;
  /** 被阻止时，未勾选的必需检查点 */
  blockedBy: Checkpoint[];
}

/** 尝试完成步骤；存在未勾选的必需检查点时返回 blockedBy 且不修改进度 */
export function completeStep(
  progress: ProgressState,
  step: AssemblyStep,
): CompleteStepResult {
  const check = checkStepCompletion(step, progress);
  if (!check.ok) {
    return { progress, blockedBy: check.missing };
  }
  if (isStepCompleted(step.id, progress)) {
    return { progress, blockedBy: [] };
  }
  return {
    progress: {
      ...progress,
      completedStepIds: [...progress.completedStepIds, step.id],
      updatedAt: Date.now(),
    },
    blockedBy: [],
  };
}

export function uncompleteStep(progress: ProgressState, stepId: string): ProgressState {
  return {
    ...progress,
    completedStepIds: progress.completedStepIds.filter((id) => id !== stepId),
    updatedAt: Date.now(),
  };
}

/** 登记缺件：自动进入暂停状态，等待补件 */
export function reportMissingPart(
  progress: ProgressState,
  report: Omit<MissingPartReport, 'id' | 'reportedAt'>,
  now = Date.now(),
): ProgressState {
  const entry: MissingPartReport = {
    ...report,
    id: `miss-${now}-${progress.missingParts.length}`,
    reportedAt: now,
  };
  return {
    ...progress,
    missingParts: [...progress.missingParts, entry],
    paused: true,
    updatedAt: now,
  };
}

export function removeMissingPartReport(
  progress: ProgressState,
  reportId: string,
): ProgressState {
  const missingParts = progress.missingParts.filter((r) => r.id !== reportId);
  return {
    ...progress,
    missingParts,
    paused: missingParts.length > 0 ? progress.paused : false,
    updatedAt: Date.now(),
  };
}

export function setPaused(progress: ProgressState, paused: boolean): ProgressState {
  return { ...progress, paused, updatedAt: Date.now() };
}

export interface ReplacementItem {
  part: Part;
  quantity: number;
  notes: string[];
}

/** 汇总缺件报告，生成补件清单（按零件合并数量） */
export function buildReplacementList(
  plan: AssemblyPlan,
  progress: ProgressState,
): ReplacementItem[] {
  const byPart = new Map<string, ReplacementItem>();
  for (const report of progress.missingParts) {
    const part = plan.parts.find((p) => p.id === report.partId);
    if (!part) continue;
    const existing = byPart.get(part.id);
    if (existing) {
      existing.quantity += report.quantity;
      if (report.note.trim()) existing.notes.push(report.note.trim());
    } else {
      byPart.set(part.id, {
        part,
        quantity: report.quantity,
        notes: report.note.trim() ? [report.note.trim()] : [],
      });
    }
  }
  return [...byPart.values()].sort((a, b) => a.part.code.localeCompare(b.part.code));
}

/** 步骤搜索：匹配标题、描述、图片说明、零件名/编号、工具名、检查点文本 */
export function searchSteps(plan: AssemblyPlan, query: string): AssemblyStep[] {
  const q = query.trim().toLowerCase();
  if (!q) return plan.steps;
  return plan.steps.filter((step) => {
    if (step.title.toLowerCase().includes(q)) return true;
    if (step.description.toLowerCase().includes(q)) return true;
    if (step.imageAlt.toLowerCase().includes(q)) return true;
    if (step.checkpoints.some((c) => c.text.toLowerCase().includes(q))) return true;
    const matchedPart = step.parts.some((use) => {
      const part = plan.parts.find((p) => p.id === use.partId);
      return (
        part &&
        (part.name.toLowerCase().includes(q) || part.code.toLowerCase().includes(q))
      );
    });
    if (matchedPart) return true;
    return step.toolIds.some((toolId) => {
      const tool = plan.tools.find((t) => t.id === toolId);
      return tool && tool.name.toLowerCase().includes(q);
    });
  });
}

export interface PlanProgress {
  completed: number;
  total: number;
  percent: number;
}

export function overallProgress(plan: AssemblyPlan, progress: ProgressState): PlanProgress {
  const total = plan.steps.length;
  const completed = plan.steps.filter((s) => isStepCompleted(s.id, progress)).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** 找到第一个未完成步骤的索引（全部完成时返回 -1） */
export function nextStepIndex(plan: AssemblyPlan, progress: ProgressState): number {
  return plan.steps.findIndex((s) => !isStepCompleted(s.id, progress));
}
