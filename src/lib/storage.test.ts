import { beforeEach, describe, expect, it, vi } from 'vitest';
import { samplePlan } from '../data/samplePlan';
import {
  completeStep,
  createEmptyProgress,
  reportMissingPart,
  setPaused,
  toggleCheckpoint,
} from './assembly';
import { clearProgress, loadProgress, saveProgress } from './storage';

/** 简单的内存 localStorage，模拟浏览器刷新后重新读取 */
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

describe('刷新恢复（localStorage 持久化）', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it('暂停状态、缺件记录、完成进度与勾选状态在刷新后完整恢复', () => {
    const plan = samplePlan;
    let p = createEmptyProgress(plan.id);
    // 完成第 1 步
    for (const c of plan.steps[0].checkpoints.filter((c) => c.required)) {
      p = toggleCheckpoint(p, 's1', c.id);
    }
    p = completeStep(p, plan, plan.steps[0]).progress;
    // 第 2 步勾选一半后报告缺件，进入暂停
    p = toggleCheckpoint(p, 's2', 's2-c1');
    p = reportMissingPart(p, plan, { partId: 'p-screw', quantity: 2, note: '少发', stepId: 's5' }, 1000);
    expect(p.paused).toBe(true);
    saveProgress(p);

    // 模拟刷新：重新从 localStorage 读取
    const restored = loadProgress(plan.id);
    expect(restored.paused).toBe(true);
    expect(restored.completedStepIds).toEqual(['s1']);
    expect(restored.checkedCheckpoints['s2']).toEqual(['s2-c1']);
    expect(restored.missingParts).toHaveLength(1);
    expect(restored.missingParts[0]).toMatchObject({
      partId: 'p-screw',
      quantity: 2,
      note: '少发',
      partCode: 'B02',
      partName: '沉头螺丝 M6×40',
    });

    // 恢复后仍处于暂停锁定：勾选与完成均无效
    expect(toggleCheckpoint(restored, 's2', 's2-c2').checkedCheckpoints['s2']).toEqual(['s2-c1']);
    const blocked = completeStep(restored, plan, plan.steps[1]);
    expect(blocked.blockedByPause).toBe(true);
    expect(blocked.progress.completedStepIds).toEqual(['s1']);

    // 恢复组装后保留进度并可继续
    const resumed = setPaused(restored, false);
    expect(resumed.completedStepIds).toEqual(['s1']);
    const continued = toggleCheckpoint(resumed, 's2', 's2-c2');
    expect(continued.checkedCheckpoints['s2']).toEqual(['s2-c1', 's2-c2']);
    const done = completeStep(continued, plan, plan.steps[1]);
    expect(done.progress.completedStepIds).toEqual(['s1', 's2']);
  });

  it('方案不一致或数据损坏时返回空白进度', () => {
    const plan = samplePlan;
    saveProgress(createEmptyProgress('other-plan'));
    expect(loadProgress(plan.id).completedStepIds).toHaveLength(0);
    localStorage.setItem('fac.progress.v1', '{broken json');
    expect(loadProgress(plan.id).completedStepIds).toHaveLength(0);
  });

  it('清空进度后刷新得到空白进度', () => {
    const plan = samplePlan;
    let p = createEmptyProgress(plan.id);
    p = toggleCheckpoint(p, 's1', 's1-c1');
    saveProgress(p);
    clearProgress();
    const restored = loadProgress(plan.id);
    expect(restored.completedStepIds).toHaveLength(0);
    expect(restored.checkedCheckpoints).toEqual({});
    expect(restored.paused).toBe(false);
  });
});
