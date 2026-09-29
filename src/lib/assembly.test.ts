import { describe, expect, it } from 'vitest';
import { samplePlan } from '../data/samplePlan';
import {
  buildReplacementList,
  checkStepCompletion,
  completeStep,
  createEmptyProgress,
  overallProgress,
  removeMissingPartReport,
  reportMissingPart,
  searchSteps,
  toggleCheckpoint,
  uncheckedRequiredCheckpoints,
} from './assembly';
import type { ProgressState } from '../types';

const plan = samplePlan;
const step1 = plan.steps[0];

function freshProgress(): ProgressState {
  return createEmptyProgress(plan.id);
}

function checkAllRequired(p: ProgressState, stepId: string): ProgressState {
  const step = plan.steps.find((s) => s.id === stepId)!;
  let next = p;
  for (const c of step.checkpoints) {
    next = toggleCheckpoint(next, stepId, c.id);
  }
  return next;
}

describe('必需检查点校验', () => {
  it('未勾选必需检查点时阻止完成步骤', () => {
    const p = freshProgress();
    const result = completeStep(p, step1);
    expect(result.blockedBy.length).toBeGreaterThan(0);
    expect(result.progress.completedStepIds).toHaveLength(0);
    // 被阻止的应全部是必需检查点
    expect(result.blockedBy.every((c) => c.required)).toBe(true);
  });

  it('勾选全部必需检查点后可以完成（可选检查点不强制）', () => {
    let p = freshProgress();
    for (const c of step1.checkpoints.filter((c) => c.required)) {
      p = toggleCheckpoint(p, step1.id, c.id);
    }
    const check = checkStepCompletion(step1, p);
    expect(check.ok).toBe(true);
    const result = completeStep(p, step1);
    expect(result.blockedBy).toHaveLength(0);
    expect(result.progress.completedStepIds).toContain(step1.id);
  });

  it('取消勾选必需检查点后重新变为不可完成', () => {
    let p = checkAllRequired(freshProgress(), step1.id);
    const required = step1.checkpoints.find((c) => c.required)!;
    p = toggleCheckpoint(p, step1.id, required.id);
    expect(uncheckedRequiredCheckpoints(step1, p).map((c) => c.id)).toContain(required.id);
  });
});

describe('缺件与补件清单', () => {
  it('登记缺件后进入暂停状态', () => {
    const p = reportMissingPart(freshProgress(), {
      partId: 'p-screw',
      quantity: 2,
      note: '包装内未见',
      stepId: 's5',
    });
    expect(p.paused).toBe(true);
    expect(p.missingParts).toHaveLength(1);
  });

  it('补件清单按零件合并数量与备注', () => {
    let p = freshProgress();
    p = reportMissingPart(p, { partId: 'p-screw', quantity: 2, note: '少发', stepId: 's5' }, 1000);
    p = reportMissingPart(p, { partId: 'p-screw', quantity: 1, note: '滑丝', stepId: 's5' }, 2000);
    p = reportMissingPart(p, { partId: 'p-dowel', quantity: 4, note: '', stepId: 's2' }, 3000);
    const list = buildReplacementList(plan, p);
    expect(list).toHaveLength(2);
    const screws = list.find((i) => i.part.id === 'p-screw')!;
    expect(screws.quantity).toBe(3);
    expect(screws.notes).toEqual(['少发', '滑丝']);
    const dowels = list.find((i) => i.part.id === 'p-dowel')!;
    expect(dowels.quantity).toBe(4);
  });

  it('移除全部缺件记录后自动解除暂停', () => {
    let p = reportMissingPart(freshProgress(), {
      partId: 'p-back',
      quantity: 1,
      note: '',
      stepId: 's6',
    });
    p = removeMissingPartReport(p, p.missingParts[0].id);
    expect(p.paused).toBe(false);
    expect(buildReplacementList(plan, p)).toHaveLength(0);
  });
});

describe('步骤搜索', () => {
  it('空查询返回全部步骤', () => {
    expect(searchSteps(plan, '')).toHaveLength(plan.steps.length);
    expect(searchSteps(plan, '   ')).toHaveLength(plan.steps.length);
  });

  it('按标题与描述匹配', () => {
    expect(searchSteps(plan, '背板').some((s) => s.id === 's6')).toBe(true);
    expect(searchSteps(plan, '水平仪').some((s) => s.id === 's8')).toBe(true);
  });

  it('按零件名称与编号匹配', () => {
    const byName = searchSteps(plan, '木榫');
    expect(byName.some((s) => s.id === 's2')).toBe(true);
    const byCode = searchSteps(plan, 'B02');
    expect(byCode.some((s) => s.id === 's5')).toBe(true);
  });

  it('无匹配时返回空数组', () => {
    expect(searchSteps(plan, '不存在的零件xyz')).toHaveLength(0);
  });
});

describe('整体进度', () => {
  it('完成步骤后进度更新', () => {
    let p = checkAllRequired(freshProgress(), step1.id);
    p = completeStep(p, step1).progress;
    const stats = overallProgress(plan, p);
    expect(stats.completed).toBe(1);
    expect(stats.total).toBe(plan.steps.length);
    expect(stats.percent).toBe(Math.round((1 / plan.steps.length) * 100));
  });
});
