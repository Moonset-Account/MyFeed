import { useEffect, useMemo, useState } from 'react';
import { AdminEditor } from './components/AdminEditor';
import { MaterialsSheet } from './components/MaterialsSheet';
import { MissingPartsModal } from './components/MissingPartsModal';
import { StepCard } from './components/StepCard';
import { StepNav } from './components/StepNav';
import { defaultPlan } from './data/defaultPlan';
import {
  createInitialProgress,
  nextStepIndex,
  parseProgress,
  progressPercent,
  serializeProgress,
  storageKey,
} from './lib/assembly';
import type { AssemblyPlan, ProgressState } from './lib/types';
import { reduceProgress, type Action } from './state/reducer';

const PLAN_KEY = 'furniture-assembly-plan-v1';

function loadPlan(): AssemblyPlan {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return defaultPlan;
    const data = JSON.parse(raw) as AssemblyPlan;
    if (data && data.id && Array.isArray(data.steps) && Array.isArray(data.parts)) return data;
    return defaultPlan;
  } catch {
    return defaultPlan;
  }
}

function loadProgress(plan: AssemblyPlan): { progress: ProgressState; restored: boolean } {
  try {
    const parsed = parseProgress(localStorage.getItem(storageKey()), plan);
    if (parsed) return { progress: parsed, restored: true };
  } catch {
    /* 忽略损坏数据 */
  }
  return { progress: createInitialProgress(plan.id), restored: false };
}

export default function App() {
  const [plan, setPlan] = useState<AssemblyPlan>(loadPlan);
  const [{ progress, restored }, setBoot] = useState(() => loadProgress(plan));
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(nextStepIndex(plan, progress.completedStepIds), Math.max(plan.steps.length - 1, 0)),
  );
  const [query, setQuery] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showRestored, setShowRestored] = useState(restored);

  const dispatch = (action: Action) => {
    setBoot((prev) => {
      const next = reduceProgress(plan, prev.progress, action);
      if (!next) return prev;
      return { ...prev, progress: next };
    });
  };

  // 进度持久化：任何变化都写入 localStorage，刷新/关闭后可恢复
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(), serializeProgress(progress));
    } catch {
      /* 存储不可用时静默降级 */
    }
  }, [progress]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!showRestored) return;
    const t = window.setTimeout(() => setShowRestored(false), 5000);
    return () => window.clearTimeout(t);
  }, [showRestored]);

  const percent = progressPercent(plan, progress.completedStepIds);
  const step = plan.steps[currentIndex];
  const paused = progress.status === 'paused-missing-parts';
  const finished = progress.status === 'finished';

  const statusText = useMemo(() => {
    if (finished) return '已完成全部步骤';
    if (paused) return '已暂停（等待补件）';
    return '组装中';
  }, [finished, paused]);

  const savePlan = (next: AssemblyPlan) => {
    setPlan(next);
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(next));
    } catch {
      /* 忽略 */
    }
    // 方案变化后重新校验进度，丢弃失效步骤
    const revalidated = parseProgress(serializeProgress(progress), next) ?? createInitialProgress(next.id);
    setBoot({ progress: revalidated, restored: false });
    setCurrentIndex(Math.min(nextStepIndex(next, revalidated.completedStepIds), Math.max(next.steps.length - 1, 0)));
    setAdminOpen(false);
  };

  const restoreDefault = () => {
    savePlan(defaultPlan);
    try {
      localStorage.removeItem(PLAN_KEY);
    } catch {
      /* 忽略 */
    }
  };

  if (adminOpen) {
    return (
      <AdminEditor
        plan={plan}
        onSave={savePlan}
        onRestoreDefault={restoreDefault}
        onClose={() => setAdminOpen(false)}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header no-print">
        <div>
          <h1>{plan.name}</h1>
          <p className="subtitle">{plan.description}</p>
        </div>
        <div className="header-actions">
          <span className={`status-pill status-${progress.status}`}>{statusText}</span>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            打印材料表
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAdminOpen(true)}>
            管理配置
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: 'reset', planId: plan.id });
              setCurrentIndex(0);
            }}
          >
            重置进度
          </button>
        </div>
      </header>

      <div className="progress-bar no-print" aria-label={`总进度 ${percent}%`}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
        <span className="progress-label">
          {progress.completedStepIds.length} / {plan.steps.length} 步 · {percent}%
        </span>
      </div>

      {showRestored && (
        <p className="banner banner-info no-print" role="status">
          已恢复上次进度（{progress.completedStepIds.length} 步已完成，更新于{' '}
          {new Date(progress.updatedAt).toLocaleString()}）。
        </p>
      )}

      {paused && (
        <div className="banner banner-warning no-print" role="alert">
          <div>
            <strong>组装已暂停：等待补件。</strong>
            补件清单已生成（见下方材料表 / 可打印），共 {progress.missingParts.length} 项。
          </div>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'resume' })}>
            补件已到，继续组装
          </button>
        </div>
      )}

      {finished && (
        <p className="banner banner-success no-print" role="status">
          🎉 全部步骤已完成，{plan.name} 组装完毕！
        </p>
      )}

      <main className="layout no-print">
        <StepNav
          plan={plan}
          progress={progress}
          query={query}
          currentIndex={currentIndex}
          onQueryChange={setQuery}
          onSelect={setCurrentIndex}
        />

        <section className="main-panel">
          {step ? (
            <>
              <StepCard
                plan={plan}
                step={step}
                index={currentIndex}
                progress={progress}
                onToggleCheckpoint={(id) => dispatch({ type: 'toggle-checkpoint', stepId: id })}
                onComplete={(id) => {
                  dispatch({ type: 'complete-step', stepId: id });
                  const next = nextStepIndex(plan, [...progress.completedStepIds, id]);
                  if (next < plan.steps.length) setCurrentIndex(next);
                }}
                onUncomplete={(id) => dispatch({ type: 'uncomplete-step', stepId: id })}
                onBlocked={(reason) => setToast(`⚠ 无法完成本步：${reason}。请先勾选检查点。`)}
              />
              <div className="step-pager">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  ← 上一步
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={paused || finished}
                  onClick={() => setMissingOpen(true)}
                >
                  发现缺件，暂停组装
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={currentIndex >= plan.steps.length - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(plan.steps.length - 1, i + 1))}
                >
                  下一步 →
                </button>
              </div>
            </>
          ) : (
            <p>方案中暂无步骤，请进入“管理配置”添加。</p>
          )}
        </section>
      </main>

      {missingOpen && (
        <MissingPartsModal
          plan={plan}
          initial={progress.missingParts}
          onCancel={() => setMissingOpen(false)}
          onConfirm={(missing) => {
            dispatch({ type: 'pause-missing', missing });
            setMissingOpen(false);
            setToast('已暂停组装并生成补件清单，可打印材料表随补件申请使用。');
          }}
        />
      )}

      {toast && (
        <div className="toast no-print" role="alert">
          {toast}
        </div>
      )}

      <MaterialsSheet plan={plan} progress={progress} />
    </div>
  );
}
