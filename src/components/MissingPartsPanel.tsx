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

  return (
    <section className="missing-panel" aria-live="polite">
      <div className="missing-head">
        <h2>⏸ 已暂停：等待补件</h2>
        <p>
          共登记 {progress.missingParts.length} 条缺件记录。补件清单如下，可凭此向售后申请补发；
          零件到齐后可逐条移除记录，也可以直接恢复组装——已有完成进度会全部保留。
        </p>
      </div>
      {items.length > 0 ? (
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
              <tr key={item.partId} className={item.partRemoved ? 'part-removed' : ''}>
                <td>{item.code}</td>
                <td>
                  {item.name}
                  {item.partRemoved && (
                    <em className="removed-mark">（该零件已从方案中删除，按登记信息补件）</em>
                  )}
                </td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td>{item.notes.join('；') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>缺件记录已全部处理，可以直接恢复组装。</p>
      )}
      {progress.missingParts.length > 0 && (
        <details className="missing-records">
          <summary>缺件记录明细</summary>
          <ul>
            {progress.missingParts.map((r) => {
              const part = plan.parts.find((p) => p.id === r.partId);
              const label = part
                ? `${part.code} ${part.name}`
                : r.partCode || r.partName
                  ? `${r.partCode ?? ''} ${r.partName ?? ''}（已删除）`.trim()
                  : `未知零件 ${r.partId}（已删除）`;
              const step = plan.steps.find((s) => s.id === r.stepId);
              return (
                <li key={r.id}>
                  {label} × {r.quantity}
                  {step ? `（步骤：${step.title}）` : ''}
                  {r.note ? ` — ${r.note}` : ''}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onRemoveReport(r.id)}
                  >
                    已补齐，移除
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <button type="button" className="btn primary" onClick={onResume}>
        零件已补齐，恢复组装
      </button>
    </section>
  );
}
