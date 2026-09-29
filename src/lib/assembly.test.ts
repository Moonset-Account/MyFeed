import { beforeEach, describe, expect, it, vi } from 'vitest';
import { samplePlan } from '../data/samplePlan';
import {
  activeMissingParts,
  attemptCompleteStep,
  buildReplacementList,
  checkStepCompletion,
  createEmptyProgress,
  getCheckpointEditBlock,
  getStepEntryBlock,
  hydrateProgress,
  markMissingPartReceived,
  overallProgress,
  reportMissingPart,
  resumeAssembly,
  searchSteps,
  toggleCheckpoint,
  uncheckedRequiredCheckpoints,
  undoStepCompletion,
} from './assembly';
import { loadPlan, loadProgress, savePlan, saveProgress } from './storage';
import type { AssemblyPlan, ProgressState } from '../types';

const plan = samplePlan;
const [step1, step2, step3] = plan.steps;

function freshProgress(): ProgressState {
  return createEmptyProgress(plan.id);
}

function checkRequired(progress: ProgressState, stepId: string): ProgressState {
  const step = plan.steps.find((item) => item.id === stepId)!;
  let next = progress;
  for (const checkpoint of step.checkpoints.filter((item) => item.required)) {
    next = toggleCheckpoint(next, stepId, checkpoint.id);
  }
  return next;
}

function completeRequiredStep(progress: ProgressState, stepIndex: number): ProgressState {
  const step = plan.steps[stepIndex];
  const checked = checkRequired(progress, step.id);
  return attemptCompleteStep(plan, checked, step).progress;
}

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

describe('按步骤顺序执行', () => {
  it('跨步骤跳过会指出最早未完成步骤及其未勾选必需检查点', () => {
    const progress = freshProgress();

    const entryBlock = getStepEntryBlock(plan, step3, progress);
    expect(entryBlock).toMatchObject({
      reason: 'required-checkpoints',
      stepId: step1.id,
      stepTitle: step1.title,
    });
    expect(entryBlock?.missing.map((item) => item.id)).toEqual([
      's1-c1',
      's1-c2',
    ]);

    const completion = attemptCompleteStep(plan, progress, step3);
    expect(completion.block).toMatchObject({
      reason: 'required-checkpoints',
      stepId: step1.id,
      stepTitle: step1.title,
    });
    expect(completion.block?.missing.map((item) => item.text)).toContain(
      '对照材料表清点全部零件，数量一致',
    );
    expect(completion.progress.completedStepIds).toHaveLength(0);
  });

  it('前置步骤检查点补齐但未点击完成时，仍不能进入后续步骤', () => {
    const progress = checkRequired(freshProgress(), step1.id);
    const block = getStepEntryBlock(plan, step2, progress);
    expect(block).toMatchObject({
      reason: 'step-not-completed',
      stepId: step1.id,
    });
    expect(block?.missing).toEqual([]);
    expect(attemptCompleteStep(plan, progress, step2).block?.reason).toBe('step-not-completed');
  });

  it('按顺序补齐必需检查点后可继续，可选检查点不阻止完成', () => {
    let progress = freshProgress();
    expect(uncheckedRequiredCheckpoints(step1, progress)).toHaveLength(2);

    progress = checkRequired(progress, step1.id);
    expect(checkStepCompletion(step1, progress).ok).toBe(true);
    progress = attemptCompleteStep(plan, progress, step1).progress;
    expect(progress.completedStepIds).toEqual([step1.id]);

    const blockedStep2 = attemptCompleteStep(plan, progress, step2);
    expect(blockedStep2.block).toMatchObject({
      reason: 'required-checkpoints',
      stepId: step2.id,
      stepTitle: step2.title,
    });
    expect(blockedStep2.block?.missing.map((item) => item.id)).toEqual([
      's2-c1',
      's2-c2',
    ]);

    progress = checkRequired(progress, step2.id);
    progress = attemptCompleteStep(plan, progress, step2).progress;
    expect(progress.completedStepIds).toEqual([step1.id, step2.id]);
    expect(overallProgress(plan, progress).completed).toBe(2);
  });

  it('只能先撤销最后完成的步骤；撤销前置步骤后后续步骤立即重新锁定', () => {
    let progress = completeRequiredStep(completeRequiredStep(freshProgress(), 0), 1);
    expect(undoStepCompletion(plan, progress, step1.id).block?.reason).toBe(
      'later-step-completed',
    );

    progress = undoStepCompletion(plan, progress, step2.id).progress;
    expect(getCheckpointEditBlock(plan, step2, progress)).toBeNull();

    progress = undoStepCompletion(plan, progress, step1.id).progress;
    expect(getCheckpointEditBlock(plan, step2, progress)?.reason).toBe('step-not-completed');
  });
});


  it('为旧版本保存的活动缺件记录补齐当前零件与步骤快照', () => {
    const legacy: ProgressState = {
      ...freshProgress(),
      paused: true,
      missingParts: [
        {
          id: 'legacy-1',
          partId: 'p-screw',
          quantity: 1,
          note: '旧记录',
          stepId: 's5',
          reportedAt: 1000,
        },
      ],
    };

    const hydrated = hydrateProgress(plan, legacy);
    expect(hydrated.missingParts[0]).toMatchObject({
      partSnapshot: {
        code: 'B02',
        name: '沉头螺丝 M6×40',
        unit: '颗',
      },
      stepTitle: '固定剩余层板螺丝',
      resolvedAt: null,
    });
  });

describe('缺件暂停锁定', () => {
  it('暂停期间不能继续勾选检查点、进入后续步骤、完成步骤或撤销进度', () => {
    let progress = completeRequiredStep(freshProgress(), 0);
    const beforePause = progress;
    progress = reportMissingPart(
      plan,
      progress,
      { partId: 'p-dowel', quantity: 4, note: '包装内未见', stepId: step2.id },
      1000,
    );

    expect(getCheckpointEditBlock(plan, step2, progress)).toMatchObject({ reason: 'paused' });
    expect(getCheckpointEditBlock(plan, step1, progress)).toMatchObject({ reason: 'paused' });
    expect(getStepEntryBlock(plan, step3, progress)).toMatchObject({ reason: 'paused' });
    expect(attemptCompleteStep(plan, progress, step2).block).toMatchObject({ reason: 'paused' });
    expect(undoStepCompletion(plan, progress, step1.id).block).toMatchObject({ reason: 'paused' });

    const attemptedToggle = toggleCheckpoint(progress, step2.id, 's2-c1');
    expect(getCheckpointEditBlock(plan, step2, attemptedToggle)).toMatchObject({ reason: 'paused' });
    expect(progress).toEqual({
      ...beforePause,
      paused: true,
      missingParts: [
        expect.objectContaining({ partId: 'p-dowel', resolvedAt: null }),
      ],
      updatedAt: 1000,
    });
  });

  it('单条记录可标记收到；全部恢复时保留完成进度并保留补件记录', () => {
    let progress = completeRequiredStep(freshProgress(), 0);
    progress = reportMissingPart(
      plan,
      progress,
      { partId: 'p-dowel', quantity: 4, note: '', stepId: step2.id },
      1000,
    );
    const reportId = progress.missingParts[0].id;

    progress = markMissingPartReceived(progress, reportId, 2000);
    expect(activeMissingParts(progress.missingParts)).toHaveLength(0);
    expect(progress.paused).toBe(true);
    expect(buildReplacementList(plan, progress)).toHaveLength(0);

    progress = resumeAssembly(progress, 3000);
    expect(progress.paused).toBe(false);
    expect(progress.completedStepIds).toEqual([step1.id]);
    expect(progress.missingParts).toHaveLength(1);
    expect(progress.missingParts[0]).toMatchObject({
      id: reportId,
      resolvedAt: 2000,
    });
    expect(getStepEntryBlock(plan, step2, progress)).toBeNull();
  });
});

describe('删除已报缺零件后的补件与恢复', () => {
  it('管理员删除零件后仍使用报缺快照生成可理解清单，并可恢复已有进度', () => {
    let progress = completeRequiredStep(freshProgress(), 0);
    progress = reportMissingPart(
      plan,
      progress,
      { partId: 'p-screw', quantity: 2, note: '少发', stepId: 's5' },
      1000,
    );

    const changedPlan: AssemblyPlan = structuredClone(plan);
    changedPlan.parts = changedPlan.parts.filter((part) => part.id !== 'p-screw');

    const replacement = buildReplacementList(changedPlan, progress);
    expect(replacement).toHaveLength(1);
    expect(replacement[0]).toMatchObject({
      quantity: 2,
      notes: ['少发'],
      sourceStepTitles: ['固定剩余层板螺丝'],
    });
    expect(replacement[0].part).toMatchObject({
      id: 'p-screw',
      code: 'B02',
      name: '沉头螺丝 M6×40',
      unit: '颗',
      deleted: true,
    });

    const resumed = resumeAssembly(progress, 2000);
    expect(resumed.paused).toBe(false);
    expect(resumed.completedStepIds).toEqual([step1.id]);
    expect(resumed.missingParts[0]).toMatchObject({
      partId: 'p-screw',
      partSnapshot: {
        code: 'B02',
        name: '沉头螺丝 M6×40',
        unit: '颗',
      },
      resolvedAt: 2000,
    });
  });
});

describe('持久化刷新恢复', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('刷新后保留暂停状态、已有完成进度和已删除零件的报缺快照', () => {
    let progress = completeRequiredStep(freshProgress(), 0);
    progress = reportMissingPart(
      plan,
      progress,
      { partId: 'p-screw', quantity: 1, note: '运输损坏', stepId: 's5' },
      1000,
    );

    const changedPlan: AssemblyPlan = structuredClone(plan);
    changedPlan.parts = changedPlan.parts.filter((part) => part.id !== 'p-screw');
    savePlan(changedPlan);
    saveProgress(progress);

    const reloadedPlan = loadPlan()!;
    const reloadedProgress = loadProgress(reloadedPlan.id);
    expect(reloadedPlan.parts.some((part) => part.id === 'p-screw')).toBe(false);
    expect(reloadedProgress.paused).toBe(true);
    expect(reloadedProgress.completedStepIds).toEqual([step1.id]);
    expect(reloadedProgress.missingParts[0].partSnapshot).toEqual({
      code: 'B02',
      name: '沉头螺丝 M6×40',
      unit: '颗',
    });
    expect(buildReplacementList(reloadedPlan, reloadedProgress)[0].part.deleted).toBe(true);
  });
});

describe('步骤搜索', () => {
  it('保留标题、描述、零件编号和工具搜索能力', () => {
    expect(searchSteps(plan, '   ')).toHaveLength(plan.steps.length);
    expect(searchSteps(plan, '背板').some((step) => step.id === 's6')).toBe(true);
    expect(searchSteps(plan, 'B02').some((step) => step.id === 's5')).toBe(true);
    expect(searchSteps(plan, '水平仪').some((step) => step.id === 's8')).toBe(true);
    expect(searchSteps(plan, '不存在的零件xyz')).toHaveLength(0);
  });
});
