import { useMemo, useState } from 'react';
import type { AssemblyPlan, AssemblyStep, ProgressState } from '../types';
import {
  canUndoStep,
  getCheckpointEditBlock,
  getStepEntryBlock,
  isStepCompleted,
  type StepBlock,
} from '../lib/assembly';
import { Illustration } from './Illustration';

interface StepCardProps {
  index: number;
  plan: AssemblyPlan;
  step: AssemblyStep;
  progress: ProgressState;
  onAttemptEnter: (step: AssemblyStep) => void;
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
  onAttemptEnter,
  onToggleCheckpoint,
  onCompleteStep,
  onUncompleteStep,
  onReportMissing,
}: StepCardProps) {
  const completed = isStepCompleted(step.id, progress);
  const entryBlock = getStepEntryBlock(plan, step, progress);
  const editBlock = getCheckpointEditBlock(plan, step, progress);
  const undoAllowed = canUndoStep(plan, step.id, progress);
  const checked = new Set(progress.checkedCheckpoints[step.id] ?? []);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingPartId, setMissingPartId] = useState(step.parts[0]?.partId ?? plan.parts[0]?.id ?? '');
  const [missingQty, setMissingQty] = useState(1);
  const [missingNote, setMissingNote] = useState('');

  const locked = !completed && entryBlock !== null;
  const requiredMissing = entryBlock?.reason === 'required-checkpoints' ? entryBlock.missing : [];
  const blockingStepTitle = entryBlock && entryBlock.stepId !== step.id ? entryBlock.stepTitle : null;

  const usedParts = useMemo(
    () =>
      step.parts
        .map((use) => ({ use, part: plan.parts.find((p) => p.id === use.partId) }))
        .filter(
          (x): x is { use: (typeof x)['use']; part: NonNullable<(typeof x)['part']> } =>
            Boolean(x.part),
        ),
    [plan.parts, step.parts],
  );
  const usedTools = step.toolIds
    .map((id) => plan.tools.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const submitMissing = () => {
    if (!missingPartId || missingQty < 1 || locked) return;
    onReportMissing(missingPartId, missingQty, missingNote, step.id);
    setMissingOpen(false);
    setMissingQty(1);
    setMissingNote('');
  };

  return (
    <article
      className={`step-card ${completed ? 'is-done' : ''} ${locked ? 'is-locked' : ''}`}
      id={`step-${step.id}`}
      aria-disabled={locked || undefined}
    >
      <header className="step-head">
        <span className={`step-no ${completed ? '' : 'step-pending'}`}>{completed ? '✓' : index + 1}</span>
        <h3>{step.title}</h3>
        {completed && <span className="badge done">已完成</span>}
        {locked && <span className="badge locked">待解锁</span>}
      </header>

      {locked && entryBlock && (
        <div className="step-lock" role="alert">
          {entryBlock.reason === 'paused' ? (
            <p>缺件补件流程暂停中。请先在页面顶部处理补件并恢复组装。</p>
          ) : (
            <>
              <p>需先完成前置步骤，才能进入「{step.title}」。</p>
              {blockingStepTitle && <p className="lock-step">当前停在：{blockingStepTitle}</p>}
              {requiredMissing.length > 0 ? (
                <>
                  <p>该步骤仍有以下必需检查点未勾选：</p>
                  <ul>
                    {requiredMissing.map((checkpoint) => (
                      <li key={checkpoint.id}>{checkpoint.text}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>请先返回并点击「完成本步骤」。</p>
              )}
            </>
          )}
          <button type="button" className="btn ghost small" onClick={() => onAttemptEnter(step)}>
            查看进入要求
          </button>
        </div>
      )}

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
                  disabled={editBlock !== null}
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
          <button
            type="button"
            className="btn ghost"
            disabled={!undoAllowed}
            onClick={() => onUncompleteStep(step.id)}
          >
            撤销完成
          </button>
        ) : locked ? (
          <button type="button" className="btn ghost" onClick={() => onAttemptEnter(step)}>
            进入步骤
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => onCompleteStep(step)}>
            完成本步骤
          </button>
        )}
        {!completed && (
          <button
            type="button"
            className="btn warn"
            disabled={locked}
            onClick={() => !locked && setMissingOpen((v) => !v)}
          >
            报告缺件
          </button>
        )}
      </footer>

      {missingOpen && !completed && !locked && (
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

export function describeStepBlock(block: StepBlock): string {
  if (block.reason === 'paused') return '暂停期间不能操作检查点或完成步骤。';
  if (block.reason === 'completed-step') return '该步骤已完成。如需修改，请先撤销完成。';
  if (block.reason === 'later-step-completed') return `请先撤销后续步骤「${block.stepTitle}」。`;
  if (block.reason === 'step-not-completed') return `请先完成前置步骤「${block.stepTitle}」。`;
  return `前置步骤「${block.stepTitle}」仍有必需检查点未完成。`;
}
