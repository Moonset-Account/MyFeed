import { useEffect, useMemo, useState } from 'react';
import type { AssemblyStep, Checkpoint } from './types';
import { samplePlan } from './data/samplePlan';
import {
  attemptCompleteStep,
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
  undoStepCompletion,
  type StepBlock,
} from './lib/assembly';
import { clearProgress, loadPlan, loadProgress, savePlan, saveProgress } from './lib/storage';
import { StepCard, describeStepBlock } from './components/StepCard';
import { MissingPartsPanel } from './components/MissingPartsPanel';
import { MaterialsView } from './components/MaterialsView';
import { AdminPanel } from './components/AdminPanel';

interface BlockedWarning {
  title: string;
  block: StepBlock;
}

function warningTitle(block: StepBlock): string {
  if (block.reason === 'paused') return '组装已暂停';
  if (block.reason === 'completed-step') return '该步骤已完成';
  if (block.reason === 'later-step-completed') return '不能撤销该步骤';
  return '请按顺序组装';
}

export default function App() {
  const [plan, setPlan] = useState(() => loadPlan() ?? samplePlan);
  const [progress, setProgress] = useState(() => {
    const initialPlan = loadPlan() ?? samplePlan;
    return hydrateProgress(initialPlan, loadProgress(initialPlan.id));
  });
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [view, setView] = useState<'steps' | 'materials'>('steps');
  const [query, setQuery] = useState('');
  const [warning, setWarning] = useState<BlockedWarning | null>(null);

  useEffect(() => savePlan(plan), [plan]);
  useEffect(() => saveProgress(progress), [progress]);

  const stats = overallProgress(plan, progress);
  const visibleSteps = useMemo(() => searchSteps(plan, query), [plan, query]);

  const showBlock = (block: StepBlock | null) => {
    if (block) setWarning({ title: warningTitle(block), block });
  };

  const handleAttemptEnter = (step: AssemblyStep) => {
    showBlock(getStepEntryBlock(plan, step, progress));
  };

  const handleToggleCheckpoint = (stepId: string, checkpointId: string) => {
    const step = plan.steps.find((item) => item.id === stepId);
    if (!step) return;
    const block = getCheckpointEditBlock(plan, step, progress);
    if (block) {
      showBlock(block);
      return;
    }
    setProgress(toggleCheckpoint(progress, stepId, checkpointId));
  };

  const handleCompleteStep = (step: AssemblyStep) => {
    const result = attemptCompleteStep(plan, progress, step);
    if (result.block) {
      setWarning({ title: warningTitle(result.block), block: result.block });
      return;
    }
    setProgress(result.progress);
  };

  const handleUncompleteStep = (stepId: string) => {
    const result = undoStepCompletion(plan, progress, stepId);
    if (result.block) {
      setWarning({ title: warningTitle(result.block), block: result.block });
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
            {progress.paused && <strong className="paused-label"> · 暂停中</strong>}
          </span>
          <button
            type="button"
            className="btn ghost small"
            disabled={progress.paused}
            title={progress.paused ? '恢复组装后才能清空进度' : undefined}
            onClick={handleResetProgress}
          >
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
                onResume={() => setProgress(resumeAssembly(progress))}
                onMarkReceived={(id) => setProgress(markMissingPartReceived(progress, id))}
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
                  onAttemptEnter={handleAttemptEnter}
                  onToggleCheckpoint={handleToggleCheckpoint}
                  onCompleteStep={handleCompleteStep}
                  onUncompleteStep={handleUncompleteStep}
                  onReportMissing={(partId, qty, note, stepId) =>
                    setProgress(
                      reportMissingPart(plan, progress, {
                        partId,
                        quantity: qty,
                        note,
                        stepId,
                      }),
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
            <h2>{warning.title}</h2>
            <p>{describeStepBlock(warning.block)}</p>
            {warning.block.missing.length > 0 && (
              <>
                <p>
                  步骤「{warning.block.stepTitle}」中以下必需检查点尚未勾选，请先逐项确认：
                </p>
                <ul>
                  {warning.block.missing.map((checkpoint: Checkpoint) => (
                    <li key={checkpoint.id}>{checkpoint.text}</li>
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
