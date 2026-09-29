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

export type StepBlockReason =
  | 'paused'
  | 'required-checkpoints'
  | 'step-not-completed'
  | 'completed-step'
  | 'later-step-completed';

export interface StepBlock {
  reason: StepBlockReason;
  stepId: string;
  stepTitle: string;
  missing: Checkpoint[];
}

function pausedBlock(step: AssemblyStep): StepBlock {
  return {
    reason: 'paused',
    stepId: step.id,
    stepTitle: step.title,
    missing: [],
  };
}

/** 返回阻止进入目标步骤的最早前置步骤；目标步骤自身的检查点不在此校验。 */
export function findPrerequisiteBlock(
  plan: AssemblyPlan,
  targetStep: AssemblyStep,
  progress: ProgressState,
): StepBlock | null {
  const targetIndex = plan.steps.findIndex((step) => step.id === targetStep.id);
  for (let index = 0; index >= 0 && index < targetIndex; index += 1) {
    const step = plan.steps[index];
    if (isStepCompleted(step.id, progress)) continue;

    const missing = uncheckedRequiredCheckpoints(step, progress);
    return {
      reason: missing.length > 0 ? 'required-checkpoints' : 'step-not-completed',
      stepId: step.id,
      stepTitle: step.title,
      missing,
    };
  }
  return null;
}

/** 暂停或前置步骤未完成时，不能进入并操作后续步骤。 */
export function getStepEntryBlock(
  plan: AssemblyPlan,
  step: AssemblyStep,
  progress: ProgressState,
): StepBlock | null {
  if (progress.paused) return pausedBlock(step);
  return findPrerequisiteBlock(plan, step, progress);
}

/** 检查点只允许在未暂停、步骤未完成且前置步骤均完成时编辑。 */
export function getCheckpointEditBlock(
  plan: AssemblyPlan,
  step: AssemblyStep,
  progress: ProgressState,
): StepBlock | null {
  if (progress.paused) return pausedBlock(step);
  if (isStepCompleted(step.id, progress)) {
    return {
      reason: 'completed-step',
      stepId: step.id,
      stepTitle: step.title,
      missing: [],
    };
  }
  return findPrerequisiteBlock(plan, step, progress);
}

export function canUndoStep(
  plan: AssemblyPlan,
  stepId: string,
  progress: ProgressState,
): boolean {
  if (progress.paused || !isStepCompleted(stepId, progress)) return false;
  const targetIndex = plan.steps.findIndex((step) => step.id === stepId);
  return !plan.steps.some(
    (step, index) => index > targetIndex && isStepCompleted(step.id, progress),
  );
}

/** 仅供已通过顺序与暂停校验后的本地状态更新使用。 */
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

export interface StepActionResult {
  progress: ProgressState;
  block: StepBlock | null;
}

/**
 * 尝试完成步骤。按顺序校验前置步骤，再校验当前步骤；
 * 被阻止时返回原进度和需要处理的步骤/检查点，不写入完成状态。
 */
export function attemptCompleteStep(
  plan: AssemblyPlan,
  progress: ProgressState,
  step: AssemblyStep,
): StepActionResult {
  if (progress.paused) return { progress, block: pausedBlock(step) };

  const prerequisiteBlock = findPrerequisiteBlock(plan, step, progress);
  if (prerequisiteBlock) return { progress, block: prerequisiteBlock };

  const check = checkStepCompletion(step, progress);
  if (!check.ok) {
    return {
      progress,
      block: {
        reason: 'required-checkpoints',
        stepId: step.id,
        stepTitle: step.title,
        missing: check.missing,
      },
    };
  }

  if (isStepCompleted(step.id, progress)) return { progress, block: null };
  return {
    progress: {
      ...progress,
      completedStepIds: [...progress.completedStepIds, step.id],
      updatedAt: Date.now(),
    },
    block: null,
  };
}

export function undoStepCompletion(
  plan: AssemblyPlan,
  progress: ProgressState,
  stepId: string,
): StepActionResult {
  const step = plan.steps.find((item) => item.id === stepId);
  if (!step || !isStepCompleted(stepId, progress)) return { progress, block: null };
  if (progress.paused) return { progress, block: pausedBlock(step) };

  const targetIndex = plan.steps.findIndex((item) => item.id === stepId);
  const laterStep = plan.steps.find(
    (item, index) => index > targetIndex && isStepCompleted(item.id, progress),
  );
  if (laterStep) {
    return {
      progress,
      block: {
        reason: 'later-step-completed',
        stepId: laterStep.id,
        stepTitle: laterStep.title,
        missing: [],
      },
    };
  }

  return {
    progress: {
      ...progress,
      completedStepIds: progress.completedStepIds.filter((id) => id !== stepId),
      updatedAt: Date.now(),
    },
    block: null,
  };
}


/** 兼容旧记录：当前方案中仍存在的报缺零件在加载时补存快照。 */
export function hydrateProgress(plan: AssemblyPlan, progress: ProgressState): ProgressState {
  let changed = false;
  const missingParts = progress.missingParts.map((report) => {
    const next = { ...report };
    if (!next.partSnapshot) {
      const part = plan.parts.find((item) => item.id === next.partId);
      if (part) {
        next.partSnapshot = { code: part.code, name: part.name, unit: part.unit };
        changed = true;
      }
    }
    if (next.stepTitle === undefined && next.stepId) {
      next.stepTitle = plan.steps.find((step) => step.id === next.stepId)?.title ?? null;
      changed = true;
    }
    if (next.resolvedAt === undefined) {
      next.resolvedAt = null;
      changed = true;
    }
    return next;
  });
  return changed ? { ...progress, missingParts } : progress;
}

export function activeMissingParts(reports: MissingPartReport[]): MissingPartReport[] {
  return reports.filter((report) => report.resolvedAt == null);
}

/** 登记缺件：保存当时的零件/步骤快照，并自动进入暂停状态。 */
export function reportMissingPart(
  plan: AssemblyPlan,
  progress: ProgressState,
  report: Omit<MissingPartReport, 'id' | 'reportedAt' | 'partSnapshot' | 'stepTitle' | 'resolvedAt'>,
  now = Date.now(),
): ProgressState {
  const part = plan.parts.find((item) => item.id === report.partId);
  const step = report.stepId ? plan.steps.find((item) => item.id === report.stepId) : null;
  const entry: MissingPartReport = {
    ...report,
    id: `miss-${now}-${progress.missingParts.length}`,
    partSnapshot: part
      ? { code: part.code, name: part.name, unit: part.unit }
      : { code: '已删除', name: `原零件 ${report.partId}`, unit: '件' },
    stepTitle: step?.title ?? null,
    resolvedAt: null,
    reportedAt: now,
  };
  return {
    ...progress,
    missingParts: [...progress.missingParts, entry],
    paused: true,
    updatedAt: now,
  };
}

/** 确认一条补件已收到；记录保留在本地，暂停状态仍需显式恢复。 */
export function markMissingPartReceived(
  progress: ProgressState,
  reportId: string,
  now = Date.now(),
): ProgressState {
  return {
    ...progress,
    missingParts: progress.missingParts.map((report) =>
      report.id === reportId && report.resolvedAt == null
        ? { ...report, resolvedAt: now }
        : report,
    ),
    updatedAt: now,
  };
}

/** 恢复组装：保留完成进度与补件记录，只解除暂停并把待处理记录标记为已收到。 */
export function resumeAssembly(progress: ProgressState, now = Date.now()): ProgressState {
  return {
    ...progress,
    paused: false,
    missingParts: progress.missingParts.map((report) =>
      report.resolvedAt == null ? { ...report, resolvedAt: now } : report,
    ),
    updatedAt: now,
  };
}

export type ReplacementPart = Part & { deleted?: boolean };

export interface ReplacementItem {
  part: ReplacementPart;
  quantity: number;
  notes: string[];
  sourceStepTitles: string[];
}

function reportPartDisplay(report: MissingPartReport, plan: AssemblyPlan): ReplacementPart {
  const current = plan.parts.find((part) => part.id === report.partId);
  if (current) return current;
  return {
    id: report.partId,
    code: report.partSnapshot?.code ?? '已删除',
    name: report.partSnapshot?.name ?? `原零件 ${report.partId}`,
    quantity: 0,
    unit: report.partSnapshot?.unit ?? '件',
    deleted: true,
  };
}

/** 汇总仍待处理的缺件报告，生成补件清单（按零件合并数量）。 */
export function buildReplacementList(
  plan: AssemblyPlan,
  progress: ProgressState,
): ReplacementItem[] {
  const byPart = new Map<string, ReplacementItem>();
  for (const report of activeMissingParts(progress.missingParts)) {
    const part = reportPartDisplay(report, plan);
    const existing = byPart.get(part.id);
    const sourceStepTitle = missingReportStepTitle(report, plan);
    if (existing) {
      existing.quantity += report.quantity;
      if (report.note.trim()) existing.notes.push(report.note.trim());
      if (!existing.sourceStepTitles.includes(sourceStepTitle)) {
        existing.sourceStepTitles.push(sourceStepTitle);
      }
    } else {
      byPart.set(part.id, {
        part,
        quantity: report.quantity,
        notes: report.note.trim() ? [report.note.trim()] : [],
        sourceStepTitles: [sourceStepTitle],
      });
    }
  }
  return [...byPart.values()].sort((a, b) => a.part.code.localeCompare(b.part.code, 'zh-Hans-CN'));
}

export function missingReportStepTitle(report: MissingPartReport, plan: AssemblyPlan): string {
  return report.stepTitle ?? plan.steps.find((step) => step.id === report.stepId)?.title ?? '未记录步骤';
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
