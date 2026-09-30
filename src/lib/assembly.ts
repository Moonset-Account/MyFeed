import type {
  AssemblyPlan,
  AssemblyStep,
  Checkpoint,
  MissingPartReport,
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

export interface IncompleteEarlierStep {
  step: AssemblyStep;
  /** 该步骤在方案中的序号（从 0 开始） */
  index: number;
  missing: Checkpoint[];
}

/**
 * 按序执行校验：目标步骤之前仍未完成、且存在未勾选必需检查点的步骤。
 * 用于在进入/完成后续步骤时明确指出需要先补齐的前置步骤与检查点。
 */
export function incompleteEarlierSteps(
  plan: AssemblyPlan,
  progress: ProgressState,
  stepId: string,
): IncompleteEarlierStep[] {
  const targetIndex = plan.steps.findIndex((s) => s.id === stepId);
  if (targetIndex <= 0) return [];
  const result: IncompleteEarlierStep[] = [];
  for (let i = 0; i < targetIndex; i++) {
    const step = plan.steps[i];
    if (isStepCompleted(step.id, progress)) continue;
    const missing = uncheckedRequiredCheckpoints(step, progress);
    if (missing.length > 0) result.push({ step, index: i, missing });
  }
  return result;
}

/** 勾选/取消勾选检查点；暂停期间锁定，返回原进度 */
export function toggleCheckpoint(
  progress: ProgressState,
  stepId: string,
  checkpointId: string,
): ProgressState {
  if (progress.paused) return progress;
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
  /** 本步骤被阻止时，未勾选的必需检查点 */
  blockedBy: Checkpoint[];
  /** 之前步骤遗留的未勾选必需检查点（按序执行拦截） */
  blockedByEarlier: IncompleteEarlierStep[];
  /** 是否因缺件暂停而被阻止 */
  blockedByPause: boolean;
}

/**
 * 尝试完成步骤。
 * 暂停中、之前步骤存在未勾选的必需检查点、或本步骤存在未勾选的必需检查点时，
 * 不修改进度并返回对应的阻止原因。
 */
export function completeStep(
  progress: ProgressState,
  plan: AssemblyPlan,
  step: AssemblyStep,
): CompleteStepResult {
  const empty = { blockedBy: [], blockedByEarlier: [], blockedByPause: false };
  if (progress.paused) {
    return { progress, ...empty, blockedByPause: true };
  }
  const earlier = incompleteEarlierSteps(plan, progress, step.id);
  if (earlier.length > 0) {
    return { progress, ...empty, blockedByEarlier: earlier };
  }
  const check = checkStepCompletion(step, progress);
  if (!check.ok) {
    return { progress, ...empty, blockedBy: check.missing };
  }
  if (isStepCompleted(step.id, progress)) {
    return { progress, ...empty };
  }
  return {
    progress: {
      ...progress,
      completedStepIds: [...progress.completedStepIds, step.id],
      updatedAt: Date.now(),
    },
    ...empty,
  };
}

export function uncompleteStep(progress: ProgressState, stepId: string): ProgressState {
  return {
    ...progress,
    completedStepIds: progress.completedStepIds.filter((id) => id !== stepId),
    updatedAt: Date.now(),
  };
}

/** 登记缺件：自动进入暂停状态，等待补件。登记时保存零件信息快照。 */
export function reportMissingPart(
  progress: ProgressState,
  plan: AssemblyPlan,
  report: Omit<MissingPartReport, 'id' | 'reportedAt' | 'partCode' | 'partName' | 'partUnit'>,
  now = Date.now(),
): ProgressState {
  const part = plan.parts.find((p) => p.id === report.partId);
  const entry: MissingPartReport = {
    ...report,
    id: `miss-${now}-${progress.missingParts.length}`,
    partCode: part?.code,
    partName: part?.name,
    partUnit: part?.unit,
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

/** 恢复/暂停。恢复组装只解除暂停标记，保留全部已完成进度与勾选状态。 */
export function setPaused(progress: ProgressState, paused: boolean): ProgressState {
  return { ...progress, paused, updatedAt: Date.now() };
}

export interface ReplacementItem {
  partId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  notes: string[];
  /** 零件已被管理员从方案中删除（记录仍保留，凭快照信息补件） */
  partRemoved: boolean;
}

/**
 * 汇总缺件报告，生成补件清单（按零件合并数量）。
 * 即使零件已被管理员从方案中删除，也依据登记时的快照保留可读记录。
 */
export function buildReplacementList(
  plan: AssemblyPlan,
  progress: ProgressState,
): ReplacementItem[] {
  const byPart = new Map<string, ReplacementItem>();
  for (const report of progress.missingParts) {
    const part = plan.parts.find((p) => p.id === report.partId);
    const code = part?.code ?? report.partCode ?? report.partId;
    const name = part?.name ?? report.partName ?? '未知零件（已从方案中删除）';
    const unit = part?.unit ?? report.partUnit ?? '件';
    const existing = byPart.get(report.partId);
    if (existing) {
      existing.quantity += report.quantity;
      if (report.note.trim()) existing.notes.push(report.note.trim());
    } else {
      byPart.set(report.partId, {
        partId: report.partId,
        code,
        name,
        unit,
        quantity: report.quantity,
        notes: report.note.trim() ? [report.note.trim()] : [],
        partRemoved: !part,
      });
    }
  }
  return [...byPart.values()].sort((a, b) => a.code.localeCompare(b.code));
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
