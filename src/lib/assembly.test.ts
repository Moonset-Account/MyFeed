import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../data/defaultPlan';
import {
  buildReplacementList,
  canCompleteStep,
  createInitialProgress,
  formatReplacementList,
  nextStepIndex,
  parseProgress,
  progressPercent,
  searchSteps,
  serializeProgress,
  stepBlockReason,
} from './assembly';
import { reduceProgress } from '../state/reducer';

const plan = defaultPlan;

describe('检查点拦截', () => {
  it('必需检查点未勾选时阻止完成并给出原因', () => {
    const s1 = plan.steps[0];
    expect(s1.checkpoint?.required).toBe(true);
    expect(canCompleteStep(s1, [])).toBe(false);
    expect(stepBlockReason(s1, [])).toContain('必需检查点');
    expect(canCompleteStep(s1, [s1.id])).toBe(true);
  });

  it('可选检查点未勾选不阻止完成', () => {
    const s3 = plan.steps.find((s) => s.id === 's3')!;
    expect(s3.checkpoint?.required).toBe(false);
    expect(canCompleteStep(s3, [])).toBe(true);
  });

  it('reducer 拒绝带必需检查点的完成动作', () => {
    const state = createInitialProgress(plan.id);
    expect(reduceProgress(plan, state, { type: 'complete-step', stepId: 's1' })).toBeNull();
    const checked = reduceProgress(plan, state, { type: 'toggle-checkpoint', stepId: 's1' })!;
    const done = reduceProgress(plan, checked, { type: 'complete-step', stepId: 's1' })!;
    expect(done.completedStepIds).toContain('s1');
  });
});

describe('进度推进', () => {
  it('nextStepIndex 指向第一个未完成步骤，全部完成时返回 steps.length', () => {
    expect(nextStepIndex(plan, [])).toBe(0);
    expect(nextStepIndex(plan, ['s1', 's2'])).toBe(2);
    expect(nextStepIndex(plan, plan.steps.map((s) => s.id))).toBe(plan.steps.length);
  });

  it('progressPercent 按完成比例取整', () => {
    expect(progressPercent(plan, [])).toBe(0);
    expect(progressPercent(plan, plan.steps.map((s) => s.id))).toBe(100);
  });

  it('完成最后一步后状态变为 finished', () => {
    let state = createInitialProgress(plan.id);
    for (const s of plan.steps) {
      state = reduceProgress(plan, state, { type: 'toggle-checkpoint', stepId: s.id }) ?? state;
      state = reduceProgress(plan, state, { type: 'complete-step', stepId: s.id })!;
    }
    expect(state.status).toBe('finished');
  });
});

describe('缺件暂停与补件清单', () => {
  it('登记缺件后进入暂停状态，可恢复', () => {
    let state = createInitialProgress(plan.id);
    state = reduceProgress(plan, state, {
      type: 'pause-missing',
      missing: [{ partId: 'p-dowel', quantity: 2, note: '断裂' }],
    })!;
    expect(state.status).toBe('paused-missing-parts');
    state = reduceProgress(plan, state, { type: 'resume' })!;
    expect(state.status).toBe('assembling');
  });

  it('补件清单过滤无效零件与非法数量，数量不超过应有数', () => {
    const lines = buildReplacementList(plan, [
      { partId: 'p-dowel', quantity: 2 },
      { partId: 'p-nope', quantity: 1 },
      { partId: 'p-screw', quantity: 999 },
      { partId: 'p-cam', quantity: 0 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].part.id).toBe('p-dowel');
    expect(lines[0].quantity).toBe(2);
    expect(lines[1].quantity).toBe(plan.parts.find((p) => p.id === 'p-screw')!.quantity);
  });

  it('补件清单文本包含零件名、数量与备注', () => {
    const text = formatReplacementList(plan, [{ partId: 'p-dowel', quantity: 3, note: '运输破损' }]);
    expect(text).toContain('补件清单');
    expect(text).toContain('木榫');
    expect(text).toContain('× 3');
    expect(text).toContain('运输破损');
  });
});

describe('步骤搜索', () => {
  it('空查询返回全部步骤', () => {
    expect(searchSteps(plan, '')).toHaveLength(plan.steps.length);
    expect(searchSteps(plan, '   ')).toHaveLength(plan.steps.length);
  });

  it('按标题、零件名与工具名匹配，大小写不敏感', () => {
    expect(searchSteps(plan, '背板')).toEqual([0, 3]); // 步骤 1 清点零件、步骤 4 固定背板
    expect(searchSteps(plan, '水平仪')).toEqual([4]);
    expect(searchSteps(plan, '木榫')).toContain(1);
    expect(searchSteps(plan, '不存在的词')).toEqual([]);
  });
});

describe('进度持久化与恢复', () => {
  it('序列化后可完整恢复', () => {
    let state = createInitialProgress(plan.id);
    state = reduceProgress(plan, state, { type: 'toggle-checkpoint', stepId: 's1' })!;
    state = reduceProgress(plan, state, { type: 'complete-step', stepId: 's1' })!;
    const restored = parseProgress(serializeProgress(state), plan);
    expect(restored).not.toBeNull();
    expect(restored!.completedStepIds).toEqual(['s1']);
    expect(restored!.checkedCheckpoints).toEqual(['s1']);
  });

  it('损坏数据、版本不符或方案不匹配时返回 null', () => {
    expect(parseProgress('not-json', plan)).toBeNull();
    expect(parseProgress('{"version":2}', plan)).toBeNull();
    expect(parseProgress(JSON.stringify({ ...createInitialProgress('other'), planId: 'other' }), plan)).toBeNull();
    expect(parseProgress(null, plan)).toBeNull();
  });

  it('恢复时丢弃已不存在于方案中的步骤与零件', () => {
    const state = createInitialProgress(plan.id);
    const raw = JSON.stringify({
      ...state,
      completedStepIds: ['s1', 'ghost-step'],
      checkedCheckpoints: ['ghost-step'],
      missingParts: [
        { partId: 'p-dowel', quantity: 1 },
        { partId: 'ghost-part', quantity: 1 },
        { partId: 'p-cam', quantity: -2 },
      ],
    });
    const restored = parseProgress(raw, plan)!;
    expect(restored.completedStepIds).toEqual(['s1']);
    expect(restored.checkedCheckpoints).toEqual([]);
    expect(restored.missingParts).toEqual([{ partId: 'p-dowel', quantity: 1, note: undefined }]);
  });
});
