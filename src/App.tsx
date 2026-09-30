import { useEffect, useMemo, useState } from 'react';
import type { AssemblyStep, Checkpoint } from './types';
import { samplePlan } from './data/samplePlan';
import {
  completeStep,
  createEmptyProgress,
  overallProgress,
  removeMissingPartReport,
  reportMissingPart,
  searchSteps,
  setPaused,
  toggleCheckpoint,
  uncompleteStep,
  type IncompleteEarlierStep,
} from './lib/assembly';
import { clearProgress, loadPlan, loadProgress, savePlan, saveProgress } from './lib/storage';
import { StepCard } from './components/StepCard';
import { MissingPartsPanel } from './components/MissingPartsPanel';
import { MaterialsView } from './components/MaterialsView';
import { AdminPanel } from './components/AdminPanel';

interface BlockedWarning {
  stepTitle: string;
  missing: Checkpoint[];
  earlier: IncompleteEarlierStep[];
  paused: boolean;
}

export default function App() {
  const [plan, setPlan] = useState(() => loadPlan() ?? samplePlan);
  const [progress, setProgress] = useState(() => loadProgress((loadPlan() ?? samplePlan).id));
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [view, setView] = useState<'steps' | 'materials'>('steps');
  const [query, setQuery] = useState('');
  const [warning, setWarning] = useState<BlockedWarning | null>(null);

  useEffect(() => savePlan(plan), [plan]);
  useEffect(() => saveProgress(progress), [progress]);

  const stats = overallProgress(plan, progress);
  const visibleSteps = useMemo(() => searchSteps(plan, query), [plan, query]);

  const handleCompleteStep = (step: AssemblyStep) => {
    const result = completeStep(progress, plan, step);
    if (
      result.blockedByPause ||
      result.blockedBy.length > 0 ||
      result.blockedByEarlier.length > 0
    ) {
      setWarning({
        stepTitle: step.title,
        missing: result.blockedBy,
        earlier: result.blockedByEarlier,
        paused: result.blockedByPause,
      });
      return;
    }
    setProgress(result.progress);
  };

  const handleResetProgress = () => {
    clearProgress();
    setProgress(createEmptyProgress(plan.id));
  };

  const handleResetSample = () => {
    setPlan(samplePlan);
    clearProgress();
    setProgress(createEmptyProgress(samplePlan.id));
  };

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="title-block">
          <h1>{plan.name}</h1>
          <p>{plan.description}</p>
        </div>
        <div className="header-controls">
          <div className="mode-switch" role="tablist" aria-label="模式切换">
            <button
              type="button"
              className={mode === 'user' ? 'active' : ''}
              onClick={() => setMode('user')}
            >
              组装模式
            </button>
            <button
              type="button"
              className={mode === 'admin' ? 'active' : ''}
              onClick={() => setMode('admin')}
            >
              管理员配置
            </button>
          </div>
        </div>
      </header>

      {mode === 'user' && (
        <div className="progress-bar-wrap no-print">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${stats.percent}%` }} />
          </div>
          <span>
            {stats.completed}/{stats.total} 步（{stats.percent}%）
          </span>
          <button type="button" className="btn ghost small" onClick={handleResetProgress}>
            清空进度
          </button>
        </div>
      )}

      {mode === 'user' && (
        <nav className="view-tabs no-print">
          <button
            type="button"
            className={view === 'steps' ? 'active' : ''}
            onClick={() => setView('steps')}
          >
            组装步骤
          </button>
          <button
            type="button"
            className={view === 'materials' ? 'active' : ''}
            onClick={() => setView('materials')}
          >
            材料表
          </button>
        </nav>
      )}

      <main>
        {mode === 'admin' ? (
          <AdminPanel plan={plan} onChange={setPlan} onResetSample={handleResetSample} />
        ) : view === 'materials' ? (
          <MaterialsView plan={plan} onPrint={() => window.print()} />
        ) : (
          <>
            {progress.paused && (
              <MissingPartsPanel
                plan={plan}
                progress={progress}
                onResume={() => setProgress(setPaused(progress, false))}
                onRemoveReport={(id) => setProgress(removeMissingPartReport(progress, id))}
              />
            )}

            <div className="search-bar no-print">
              <input
                type="search"
                placeholder="搜索步骤、零件、工具或检查点…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索步骤"
              />
              {query && (
                <span className="search-hint">
                  匹配 {visibleSteps.length}/{plan.steps.length} 步
                </span>
              )}
            </div>

            {visibleSteps.length === 0 ? (
              <p className="empty-hint">没有匹配「{query}」的步骤。</p>
            ) : (
              visibleSteps.map((step) => (
                <StepCard
                  key={step.id}
                  index={plan.steps.findIndex((s) => s.id === step.id)}
                  plan={plan}
                  step={step}
                  progress={progress}
                  onToggleCheckpoint={(stepId, cpId) =>
                    setProgress(toggleCheckpoint(progress, stepId, cpId))
                  }
                  onCompleteStep={handleCompleteStep}
                  onUncompleteStep={(stepId) => setProgress(uncompleteStep(progress, stepId))}
                  onReportMissing={(partId, qty, note, stepId) =>
                    setProgress(
                      reportMissingPart(progress, plan, { partId, quantity: qty, note, stepId }),
                    )
                  }
                />
              ))
            )}
          </>
        )}
      </main>

      {warning && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal">
            <h2>无法完成「{warning.stepTitle}」</h2>
            {warning.paused && (
              <p>当前处于缺件暂停状态，请先处理补件清单并恢复组装。</p>
            )}
            {warning.earlier.length > 0 && (
              <>
                <p>请按顺序组装，以下先前步骤仍有未勾选的必需检查点：</p>
                {warning.earlier.map((item) => (
                  <div key={item.step.id} className="modal-block">
                    <strong>
                      第 {item.index + 1} 步「{item.step.title}」
                    </strong>
                    <ul>
                      {item.missing.map((c) => (
                        <li key={c.id}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
            {warning.missing.length > 0 && (
              <>
                <p>本步骤以下必需检查点尚未勾选，请先逐项确认：</p>
                <ul>
                  {warning.missing.map((c) => (
                    <li key={c.id}>{c.text}</li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="btn primary" onClick={() => setWarning(null)}>
              返回检查
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
