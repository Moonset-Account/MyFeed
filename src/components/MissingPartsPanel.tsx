import type { AssemblyPlan, ProgressState } from '../types';
import {
  activeMissingParts,
  buildReplacementList,
  missingReportStepTitle,
} from '../lib/assembly';

interface Props {
  plan: AssemblyPlan;
  progress: ProgressState;
  onResume: () => void;
  onMarkReceived: (reportId: string) => void;
}

export function MissingPartsPanel({ plan, progress, onResume, onMarkReceived }: Props) {
  const items = buildReplacementList(plan, progress);
  const activeReports = activeMissingParts(progress.missingParts);

  return (
    <section className="missing-panel" aria-live="polite">
      <div className="missing-head">
        <h2>⏸ 已暂停：等待补件</h2>
        <p>
          暂停期间不能勾选检查点或完成步骤，已有完成进度会保留。补件记录保存了报缺时的零件和步骤信息；
          即使管理员之后删除该零件，也可以凭下方记录申请补件。
        </p>
      </div>

      {items.length > 0 ? (
        <>
          <h3>待处理补件清单</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>零件名称</th>
                <th>需补数量</th>
                <th>备注</th>
                <th>来源步骤</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.part.id} className={item.part.deleted ? 'part-deleted' : undefined}>
                  <td>{item.part.code}</td>
                  <td>
                    {item.part.name}
                    {item.part.deleted && <span className="deleted-note">（当前配置已删除，保留报缺记录）</span>}
                  </td>
                  <td>
                    {item.quantity} {item.part.unit}
                  </td>
                  <td>{item.notes.join('；') || '—'}</td>
                  <td>{item.sourceStepTitles.join('、')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="resolved-note">待补件均已标记收到。可直接恢复组装，历史记录仍保存在下方。</p>
      )}

      <details className="missing-records" open={items.length === 0}>
        <summary>缺件记录明细（{progress.missingParts.length} 条）</summary>
        <ul>
          {progress.missingParts.map((report) => {
            const part = plan.parts.find((p) => p.id === report.partId);
            const snapshot = report.partSnapshot;
            const label = part
              ? `${part.code} ${part.name}`
              : `${snapshot?.code ?? '已删除'} ${snapshot?.name ?? `原零件 ${report.partId}`}`;
            const resolved = report.resolvedAt != null;
            return (
              <li key={report.id} className={resolved ? 'is-resolved' : undefined}>
                <strong>{label}</strong> × {report.quantity}
                {!part && <span className="deleted-note">（该零件已从当前配置删除）</span>}
                <span>（步骤：{missingReportStepTitle(report, plan)}）</span>
                {report.note ? <span> — {report.note}</span> : null}
                <span className="record-status">{resolved ? '已收到' : '待补件'}</span>
                {!resolved && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onMarkReceived(report.id)}
                  >
                    已收到
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </details>

      <button type="button" className="btn primary" onClick={onResume}>
        {activeReports.length > 0
          ? '确认补件到齐，恢复组装'
          : '恢复组装'}
      </button>
      {activeReports.length > 0 && (
        <p className="resume-hint">恢复会保留已完成步骤和检查点；尚未标记收到的记录将一并确认为已到齐。</p>
      )}
    </section>
  );
}
