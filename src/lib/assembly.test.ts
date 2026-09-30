import { describe, expect, it } from 'vitest';
import { samplePlan } from '../data/samplePlan';
import {
  buildReplacementList,
  checkStepCompletion,
  completeStep,
  createEmptyProgress,
  incompleteEarlierSteps,
  overallProgress,
  removeMissingPartReport,
  reportMissingPart,
  searchSteps,
  setPaused,
  toggleCheckpoint,
  uncheckedRequiredCheckpoints,
} from './assembly';
import type { AssemblyPlan, ProgressState } from '../types';

const plan = samplePlan;
const step1 = plan.steps[0];

function freshProgress(): ProgressState {
  return createEmptyProgress(plan.id);
}

function checkAllRequired(p: ProgressState, stepId: string): ProgressState {
  const step = plan.steps.find((s) => s.id === stepId)!;
  let next = p;
  for (const c of step.checkpoints.filter((c) => c.required)) {
    next = toggleCheckpoint(next, stepId, c.id);
  }
  return next;
}

function completeInOrder(p: ProgressState, stepId: string): ProgressState {
  const step = plan.steps.find((s) => s.id === stepId)!;
  const result = completeStep(p, plan, step);
  expect(result.blockedBy).toHaveLength(0);
  expect(result.blockedByEarlier).toHaveLength(0);
  expect(result.blockedByPause).toBe(false);
  return result.progress;
}

describe('必需检查点校验', () => {
  it('未勾选必需检查点时阻止完成步骤', () => {
    const p = freshProgress();
    const result = completeStep(p, plan, step1);
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
    const result = completeStep(p, plan, step1);
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

describe('按序执行：跨步骤跳过拦截', () => {
  it('前序步骤存在未勾选必需检查点时，不得完成后续步骤，并指出步骤与检查点', () => {
    const p = freshProgress();
    const target = plan.steps[2]; // 跳到第 3 步
    const result = completeStep(p, plan, target);
    // 后续步骤未被标记完成
    expect(result.progress.completedStepIds).toHaveLength(0);
    // 明确指出前面的步骤及其未勾选的必需检查点
    const earlierIds = result.blockedByEarlier.map((b) => b.step.id);
    expect(earlierIds).toEqual(['s1', 's2']);
    const s1Block = result.blockedByEarlier.find((b) => b.step.id === 's1')!;
    expect(s1Block.index).toBe(0);
    expect(s1Block.missing.map((c) => c.id)).toEqual(['s1-c1', 's1-c2']);
    expect(s1Block.missing.every((c) => c.required)).toBe(true);
  });

  it('incompleteEarlierSteps 只报告未完成且缺必需检查点的前序步骤', () => {
    // 第 1 步完成、第 2 步必需检查点未勾选时，进入第 3 步只被第 2 步拦截
    let p = completeInOrder(checkAllRequired(freshProgress(), 's1'), 's1');
    const blockers = incompleteEarlierSteps(plan, p, 's3');
    expect(blockers.map((b) => b.step.id)).toEqual(['s2']);
    // 第 2 步必需检查点补齐但未点完成时，不再拦截
    p = checkAllRequired(p, 's2');
    expect(incompleteEarlierSteps(plan, p, 's3')).toHaveLength(0);
  });

  it('补齐前序检查点并按序完成后，后续步骤可正常完成', () => {
    let p = freshProgress();
    p = completeInOrder(checkAllRequired(p, 's1'), 's1');
    p = completeInOrder(checkAllRequired(p, 's2'), 's2');
    p = checkAllRequired(p, 's3');
    const result = completeStep(p, plan, plan.steps[2]);
    expect(result.blockedByEarlier).toHaveLength(0);
    expect(result.blockedBy).toHaveLength(0);
    expect(result.progress.completedStepIds).toEqual(['s1', 's2', 's3']);
  });
});

describe('缺件暂停与补件清单', () => {
  it('登记缺件后进入暂停状态', () => {
    const p = reportMissingPart(freshProgress(), plan, {
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
    p = reportMissingPart(p, plan, { partId: 'p-screw', quantity: 2, note: '少发', stepId: 's5' }, 1000);
    p = reportMissingPart(p, plan, { partId: 'p-screw', quantity: 1, note: '滑丝', stepId: 's5' }, 2000);
    p = reportMissingPart(p, plan, { partId: 'p-dowel', quantity: 4, note: '', stepId: 's2' }, 3000);
    const list = buildReplacementList(plan, p);
    expect(list).toHaveLength(2);
    const screws = list.find((i) => i.partId === 'p-screw')!;
    expect(screws.quantity).toBe(3);
    expect(screws.notes).toEqual(['少发', '滑丝']);
    expect(screws.partRemoved).toBe(false);
    const dowels = list.find((i) => i.partId === 'p-dowel')!;
    expect(dowels.quantity).toBe(4);
  });

  it('移除全部缺件记录后自动解除暂停', () => {
    let p = reportMissingPart(freshProgress(), plan, {
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

describe('暂停期间锁定', () => {
  function pausedProgress(): ProgressState {
    let p = checkAllRequired(freshProgress(), 's1');
    p = completeInOrder(p, 's1');
    return reportMissingPart(p, plan, {
      partId: 'p-screw',
      quantity: 1,
      note: '',
      stepId: 's2',
    });
  }

  it('暂停时不能勾选或取消勾选检查点', () => {
    const p = pausedProgress();
    expect(p.paused).toBe(true);
    // 勾选新检查点无效
    const afterToggle = toggleCheckpoint(p, 's2', 's2-c1');
    expect(afterToggle).toBe(p);
    expect(afterToggle.checkedCheckpoints['s2'] ?? []).toHaveLength(0);
    // 已勾选的也不能取消
    const checkedId = plan.steps[0].checkpoints.find((c) => c.required)!.id;
    const afterUntoggle = toggleCheckpoint(p, 's1', checkedId);
    expect(afterUntoggle.checkedCheckpoints['s1']).toContain(checkedId);
  });

  it('暂停时不能完成步骤', () => {
    let p = pausedProgress();
    p = checkAllRequired(p, 's2'); // 暂停中勾选无效，直接构造已勾选状态
    p = {
      ...p,
      checkedCheckpoints: { ...p.checkedCheckpoints, s2: ['s2-c1', 's2-c2'] },
    };
    const result = completeStep(p, plan, plan.steps[1]);
    expect(result.blockedByPause).toBe(true);
    expect(result.progress.completedStepIds).toEqual(['s1']);
  });

  it('恢复组装后保留已有完成进度，可继续勾选与完成', () => {
    let p = pausedProgress();
    p = setPaused(p, false);
    expect(p.paused).toBe(false);
    // 已有进度保留
    expect(p.completedStepIds).toEqual(['s1']);
    expect(p.checkedCheckpoints['s1'].length).toBeGreaterThan(0);
    // 可继续正常流程
    p = completeInOrder(checkAllRequired(p, 's2'), 's2');
    expect(p.completedStepIds).toEqual(['s1', 's2']);
  });
});

describe('管理员删除已报缺零件后的恢复', () => {
  function planWithoutPart(plan: AssemblyPlan, partId: string): AssemblyPlan {
    return {
      ...plan,
      parts: plan.parts.filter((p) => p.id !== partId),
      steps: plan.steps.map((s) => ({
        ...s,
        parts: s.parts.filter((u) => u.partId !== partId),
      })),
    };
  }

  it('补件清单仍保留可理解的记录（编号、名称、数量、备注）', () => {
    let p = freshProgress();
    p = reportMissingPart(p, plan, { partId: 'p-screw', quantity: 3, note: '少发一包', stepId: 's5' }, 1000);
    const reducedPlan = planWithoutPart(plan, 'p-screw');
    const list = buildReplacementList(reducedPlan, p);
    expect(list).toHaveLength(1);
    const item = list[0];
    expect(item.partRemoved).toBe(true);
    expect(item.code).toBe('B02');
    expect(item.name).toBe('沉头螺丝 M6×40');
    expect(item.quantity).toBe(3);
    expect(item.unit).toBe('颗');
    expect(item.notes).toEqual(['少发一包']);
  });

  it('删除零件后仍可恢复组装，且已有完成进度保留', () => {
    let p = completeInOrder(checkAllRequired(freshProgress(), 's1'), 's1');
    p = reportMissingPart(p, plan, { partId: 'p-screw', quantity: 2, note: '', stepId: 's5' }, 1000);
    expect(p.paused).toBe(true);
    const reducedPlan = planWithoutPart(plan, 'p-screw');
    // 暂停中仍被锁定
    expect(completeStep(p, reducedPlan, reducedPlan.steps[1]).blockedByPause).toBe(true);
    // 恢复：不要求清空数据
    p = setPaused(p, false);
    expect(p.completedStepIds).toEqual(['s1']);
    expect(p.missingParts).toHaveLength(1); // 补件记录保留
    // 可继续完成后续步骤
    p = checkAllRequired(p, 's2');
    const result = completeStep(p, reducedPlan, reducedPlan.steps[1]);
    expect(result.blockedByPause).toBe(false);
    expect(result.progress.completedStepIds).toEqual(['s1', 's2']);
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
    p = completeStep(p, plan, step1).progress;
    const stats = overallProgress(plan, p);
    expect(stats.completed).toBe(1);
    expect(stats.total).toBe(plan.steps.length);
    expect(stats.percent).toBe(Math.round((1 / plan.steps.length) * 100));
  });
});
