import { stepBlockReason } from '../lib/assembly';
import type { AssemblyPlan, AssemblyStep, ProgressState } from '../lib/types';
import { Illustration } from './Illustration';

interface Props {
  plan: AssemblyPlan;
  step: AssemblyStep;
  index: number;
  progress: ProgressState;
  onToggleCheckpoint: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  onUncomplete: (stepId: string) => void;
  /** 完成动作被必需检查点拦截时提示 */
  onBlocked: (reason: string) => void;
}

export function StepCard({
  plan,
  step,
  index,
  progress,
  onToggleCheckpoint,
  onComplete,
  onUncomplete,
  onBlocked,
}: Props) {
  const completed = progress.completedStepIds.includes(step.id);
  const checked = progress.checkedCheckpoints.includes(step.id);
  const blockReason = stepBlockReason(step, progress.checkedCheckpoints);
  const parts = step.partIds
    .map((id) => plan.parts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const tools = step.toolIds
    .map((id) => plan.tools.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const handleComplete = () => {
    if (blockReason) {
      onBlocked(blockReason);
      return;
    }
    onComplete(step.id);
  };

  return (
    <article className={`step-card ${completed ? 'is-done' : ''}`} aria-label={`步骤 ${index + 1}`}>
      <header className="step-card-header">
        <span className="step-number">{index + 1}</span>
        <div>
          <h2>{step.title}</h2>
          {completed && <span className="badge badge-done">已完成</span>}
        </div>
      </header>

      <Illustration name={step.illustration} />

      <p className="step-desc">{step.description}</p>

      {parts.length > 0 && (
        <section className="step-section">
          <h3>本步零件</h3>
          <ul className="chip-list">
            {parts.map((p) => (
              <li key={p.id} className="chip">
                {p.name} × {p.quantity}
                {p.spec ? <em>{p.spec}</em> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tools.length > 0 && (
        <section className="step-section">
          <h3>本步工具</h3>
          <ul className="chip-list">
            {tools.map((t) => (
              <li key={t.id} className="chip chip-tool">
                {t.name}
                {t.note ? <em>{t.note}</em> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {step.checkpoint && (
        <label className={`checkpoint ${step.checkpoint.required ? 'is-required' : ''}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleCheckpoint(step.id)}
          />
          <span>
            <strong>{step.checkpoint.required ? '必需检查点' : '建议检查点'}</strong>
            {step.checkpoint.text}
          </span>
        </label>
      )}

      {blockReason && !completed && (
        <p className="checkpoint-hint" role="note">
          完成本步前需先勾选必需检查点。
        </p>
      )}

      <footer className="step-actions">
        {completed ? (
          <button type="button" className="btn btn-ghost" onClick={() => onUncomplete(step.id)}>
            标记为未完成
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleComplete}>
            完成本步
          </button>
        )}
      </footer>
    </article>
  );
}
