import type {
  AssemblyPlan,
  AssemblyStep,
  AssemblyStatus,
  MissingPartEntry,
  Part,
  ProgressState,
} from './types';

/** 初始进度 */
export function createInitialProgress(planId: string): ProgressState {
  return {
    version: 1,
    planId,
    completedStepIds: [],
    checkedCheckpoints: [],
    status: 'assembling',
    missingParts: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 若步骤当前不能完成，返回原因；可以完成则返回 null。
 * 规则：存在必需检查点且未勾选时阻止完成。
 */
export function stepBlockReason(step: AssemblyStep, checkedCheckpoints: string[]): string | null {
  if (step.checkpoint && step.checkpoint.required && !checkedCheckpoints.includes(step.id)) {
    return `必需检查点未通过：${step.checkpoint.text}`;
  }
  return null;
}

export function canCompleteStep(step: AssemblyStep, checkedCheckpoints: string[]): boolean {
  return stepBlockReason(step, checkedCheckpoints) === null;
}

/** 第一个未完成的步骤下标；全部完成时返回 steps.length */
export function nextStepIndex(plan: AssemblyPlan, completedStepIds: string[]): number {
  const idx = plan.steps.findIndex((s) => !completedStepIds.includes(s.id));
  return idx === -1 ? plan.steps.length : idx;
}

/** 完成百分比（0-100 整数） */
export function progressPercent(plan: AssemblyPlan, completedStepIds: string[]): number {
  if (plan.steps.length === 0) return 0;
  const done = plan.steps.filter((s) => completedStepIds.includes(s.id)).length;
  return Math.round((done / plan.steps.length) * 100);
}

/**
 * 步骤搜索：匹配步骤标题、描述、关联零件名与工具名；空查询返回全部下标。
 */
export function searchSteps(plan: AssemblyPlan, query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return plan.steps.map((_, i) => i);
  return plan.steps
    .map((step, i) => {
      const partNames = step.partIds
        .map((id) => plan.parts.find((p) => p.id === id)?.name ?? '')
        .join(' ');
      const toolNames = step.toolIds
        .map((id) => plan.tools.find((t) => t.id === id)?.name ?? '')
        .join(' ');
      const haystack = `${step.title} ${step.description} ${partNames} ${toolNames}`.toLowerCase();
      return haystack.includes(q) ? i : -1;
    })
    .filter((i) => i >= 0);
}

export interface ReplacementLine {
  part: Part;
  quantity: number;
  note?: string;
}

/** 根据缺件登记生成补件清单（过滤无效零件与非法数量，按零件表顺序排列） */
export function buildReplacementList(
  plan: AssemblyPlan,
  missing: MissingPartEntry[],
): ReplacementLine[] {
  const lines: ReplacementLine[] = [];
  for (const entry of missing) {
    const part = plan.parts.find((p) => p.id === entry.partId);
    if (!part) continue;
    const quantity = Math.floor(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    lines.push({ part, quantity: Math.min(quantity, part.quantity), note: entry.note?.trim() || undefined });
  }
  return lines;
}

/** 补件清单的纯文本形式（用于复制/打印） */
export function formatReplacementList(plan: AssemblyPlan, missing: MissingPartEntry[]): string {
  const lines = buildReplacementList(plan, missing);
  if (lines.length === 0) return '（无有效缺件登记）';
  const rows = lines.map(
    (l, i) =>
      `${i + 1}. ${l.part.name}${l.part.spec ? `（${l.part.spec}）` : ''} × ${l.quantity}` +
      (l.note ? ` — 备注：${l.note}` : ''),
  );
  return [`【${plan.name}】补件清单`, `生成时间：${new Date().toLocaleString()}`, '', ...rows].join('\n');
}

const STORAGE_KEY = 'furniture-assembly-progress-v1';

export function storageKey(): string {
  return STORAGE_KEY;
}

/** 序列化进度；非法输入抛错由调用方处理 */
export function serializeProgress(state: ProgressState): string {
  return JSON.stringify(state);
}

function isValidStatus(s: unknown): s is AssemblyStatus {
  return s === 'assembling' || s === 'paused-missing-parts' || s === 'finished';
}

/**
 * 反序列化进度。数据损坏、版本不符或与当前方案不匹配时返回 null（调用方回退到初始进度）。
 */
export function parseProgress(raw: string | null, plan: AssemblyPlan): ProgressState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.version !== 1 || d.planId !== plan.id) return null;
  if (!Array.isArray(d.completedStepIds) || !Array.isArray(d.checkedCheckpoints)) return null;
  if (!isValidStatus(d.status)) return null;
  const stepIds = new Set(plan.steps.map((s) => s.id));
  const partIds = new Set(plan.parts.map((p) => p.id));
  const completedStepIds = (d.completedStepIds as unknown[]).filter(
    (x): x is string => typeof x === 'string' && stepIds.has(x),
  );
  const checkedCheckpoints = (d.checkedCheckpoints as unknown[]).filter(
    (x): x is string => typeof x === 'string' && stepIds.has(x),
  );
  const missingParts: MissingPartEntry[] = Array.isArray(d.missingParts)
    ? (d.missingParts as unknown[])
        .map((m) => m as Record<string, unknown>)
        .filter(
          (m) =>
            m &&
            typeof m.partId === 'string' &&
            partIds.has(m.partId) &&
            typeof m.quantity === 'number' &&
            m.quantity > 0,
        )
        .map((m) => ({
          partId: m.partId as string,
          quantity: m.quantity as number,
          note: typeof m.note === 'string' ? m.note : undefined,
        }))
    : [];
  return {
    version: 1,
    planId: plan.id,
    completedStepIds,
    checkedCheckpoints,
    status: d.status,
    missingParts,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(),
  };
}
