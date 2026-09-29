import type { AssemblyPlan, ProgressState } from '../types';
import { buildReplacementList } from '../lib/assembly';

interface Props {
  plan: AssemblyPlan;
  progress: ProgressState;
  onResume: () => void;
  onRemoveReport: (reportId: string) => void;
}

export function MissingPartsPanel({ plan, progress, onResume, onRemoveReport }: Props) {
  const items = buildReplacementList(plan, progress);
  if (items.length === 0) return null;

  return (
    <section className="missing-panel" aria-live="polite">
      <div className="missing-head">
        <h2>⏸ 已暂停：等待补件</h2>
        <p>
          共登记 {progress.missingParts.length} 条缺件记录。补件清单如下，可凭此向售后申请补发；
          零件到齐后可逐条移除记录，全部处理完即可恢复组装。
        </p>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>编号</th>
            <th>零件名称</th>
            <th>需补数量</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.part.id}>
              <td>{item.part.code}</td>
              <td>{item.part.name}</td>
              <td>
                {item.quantity} {item.part.unit}
              </td>
              <td>{item.notes.join('；') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="missing-records">
        <summary>缺件记录明细</summary>
        <ul>
          {progress.missingParts.map((r) => {
            const part = plan.parts.find((p) => p.id === r.partId);
            const step = plan.steps.find((s) => s.id === r.stepId);
            return (
              <li key={r.id}>
                {part ? `${part.code} ${part.name}` : r.partId} × {r.quantity}
                {step ? `（步骤：${step.title}）` : ''}
                {r.note ? ` — ${r.note}` : ''}
                <button type="button" className="btn ghost small" onClick={() => onRemoveReport(r.id)}>
                  已补齐，移除
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      <button type="button" className="btn primary" onClick={onResume}>
        零件已补齐，恢复组装
      </button>
    </section>
  );
}
