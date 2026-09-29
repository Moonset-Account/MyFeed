import { useState } from 'react';
import type { AssemblyPlan, AssemblyStep, ProgressState } from '../types';
import { isStepCompleted } from '../lib/assembly';
import { Illustration } from './Illustration';

interface StepCardProps {
  index: number;
  plan: AssemblyPlan;
  step: AssemblyStep;
  progress: ProgressState;
  onToggleCheckpoint: (stepId: string, checkpointId: string) => void;
  onCompleteStep: (step: AssemblyStep) => void;
  onUncompleteStep: (stepId: string) => void;
  onReportMissing: (partId: string, quantity: number, note: string, stepId: string) => void;
}

export function StepCard({
  index,
  plan,
  step,
  progress,
  onToggleCheckpoint,
  onCompleteStep,
  onUncompleteStep,
  onReportMissing,
}: StepCardProps) {
  const completed = isStepCompleted(step.id, progress);
  const checked = new Set(progress.checkedCheckpoints[step.id] ?? []);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingPartId, setMissingPartId] = useState(step.parts[0]?.partId ?? plan.parts[0]?.id ?? '');
  const [missingQty, setMissingQty] = useState(1);
  const [missingNote, setMissingNote] = useState('');

  const usedParts = step.parts
    .map((use) => ({ use, part: plan.parts.find((p) => p.id === use.partId) }))
    .filter((x): x is { use: (typeof x)['use']; part: NonNullable<(typeof x)['part']> } => Boolean(x.part));
  const usedTools = step.toolIds
    .map((id) => plan.tools.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const submitMissing = () => {
    if (!missingPartId || missingQty < 1) return;
    onReportMissing(missingPartId, missingQty, missingNote, step.id);
    setMissingOpen(false);
    setMissingQty(1);
    setMissingNote('');
  };

  return (
    <article className={`step-card ${completed ? 'is-done' : ''}`} id={`step-${step.id}`}>
      <header className="step-head">
        <span className="step-no">{completed ? '✓' : index + 1}</span>
        <h3>{step.title}</h3>
        {completed && <span className="badge done">已完成</span>}
      </header>

      <div className="step-body">
        <Illustration imageKey={step.imageKey} alt={step.imageAlt} />
        <p className="step-desc">{step.description}</p>
      </div>

      {usedParts.length > 0 && (
        <div className="step-meta">
          <strong>本步零件：</strong>
          {usedParts.map(({ use, part }) => (
            <span key={part.id} className="chip">
              {part.code} {part.name} × {use.quantity}
            </span>
          ))}
        </div>
      )}
      {usedTools.length > 0 && (
        <div className="step-meta">
          <strong>所需工具：</strong>
          {usedTools.map((t) => (
            <span key={t.id} className="chip tool" title={t.note}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      {step.checkpoints.length > 0 && (
        <ul className="checkpoints">
          {step.checkpoints.map((c) => (
            <li key={c.id}>
              <label className={c.required ? 'required' : ''}>
                <input
                  type="checkbox"
                  checked={checked.has(c.id)}
                  disabled={progress.paused && !completed}
                  onChange={() => onToggleCheckpoint(step.id, c.id)}
                />
                <span>
                  {c.text}
                  {c.required && <em className="req-mark">必需</em>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <footer className="step-actions">
        {completed ? (
          <button type="button" className="btn ghost" onClick={() => onUncompleteStep(step.id)}>
            撤销完成
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={progress.paused}
            onClick={() => onCompleteStep(step)}
          >
            完成本步骤
          </button>
        )}
        {!completed && (
          <button type="button" className="btn warn" onClick={() => setMissingOpen((v) => !v)}>
            报告缺件
          </button>
        )}
      </footer>

      {missingOpen && !completed && (
        <div className="missing-form">
          <label>
            缺少的零件
            <select value={missingPartId} onChange={(e) => setMissingPartId(e.target.value)}>
              {plan.parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            数量
            <input
              type="number"
              min={1}
              value={missingQty}
              onChange={(e) => setMissingQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label>
            备注（可选）
            <input
              type="text"
              value={missingNote}
              placeholder="例如：包装内未见 / 运输损坏"
              onChange={(e) => setMissingNote(e.target.value)}
            />
          </label>
          <div className="missing-form-actions">
            <button type="button" className="btn danger" onClick={submitMissing}>
              登记缺件并暂停
            </button>
            <button type="button" className="btn ghost" onClick={() => setMissingOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
