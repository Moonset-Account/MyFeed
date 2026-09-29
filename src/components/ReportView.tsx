import type { ProjectState } from '../types';
import { summarizeByArea, summarizeOverall } from '../logic/rules';

const SEVERITY_LABEL = { low: '轻微', medium: '中等', high: '严重' } as const;

export function ReportView({ state }: { state: ProjectState }) {
  const summaries = summarizeByArea(state.areas, state.issues, state.thresholds);
  const overall = summarizeOverall(summaries);
  const today = new Date().toLocaleDateString('zh-CN');

  return (
    <section className="report">
      <div className="row between no-print">
        <h2>打印报告</h2>
        <button onClick={() => window.print()}>打印 / 导出 PDF</button>
      </div>
      <div className="report-paper">
        <header className="report-header">
          <h1>居家无障碍检查报告</h1>
          <p>生成日期：{today}</p>
          <p>
            判定阈值：门净宽 ≥ {state.thresholds.doorWidthMin}cm ｜ 通道净宽 ≥{' '}
            {state.thresholds.passageWidthMin}cm ｜ 台阶/门槛 ≤ {state.thresholds.stepHeightMax}cm
          </p>
          <p>
            共检查 {overall.totalAreas} 个区域，{overall.areasWithViolations} 个区域存在测量不达标项（共{' '}
            {overall.totalViolations} 项）；待整改问题 {overall.openIssues} 个，已整改{' '}
            {overall.fixedIssues} 个。
          </p>
        </header>

        {summaries.map((s) => (
          <section className="report-area" key={s.area.id}>
            <h2>{s.area.name}</h2>
            <table>
              <tbody>
                <tr>
                  <th>门净宽</th>
                  <td>{s.area.measurement.doorWidth !== null ? `${s.area.measurement.doorWidth} cm` : '未测量'}</td>
                  <th>通道净宽</th>
                  <td>
                    {s.area.measurement.passageWidth !== null
                      ? `${s.area.measurement.passageWidth} cm`
                      : '未测量'}
                  </td>
                  <th>台阶/门槛</th>
                  <td>
                    {s.area.measurement.hasStep ? `有，高 ${s.area.measurement.stepHeight} cm` : '无'}
                  </td>
                </tr>
              </tbody>
            </table>
            {s.area.measurement.note && <p>备注：{s.area.measurement.note}</p>}
            {s.violations.length > 0 && (
              <ul>
                {s.violations.map((v) => (
                  <li key={v.field}>不达标：{v.message}</li>
                ))}
              </ul>
            )}
            {[...s.openIssues, ...s.fixedIssues].map((issue) => (
              <div className="report-issue" key={issue.id}>
                <h3>
                  {issue.status === 'fixed' ? '【已整改】' : '【待整改】'}
                  {issue.title}（{SEVERITY_LABEL[issue.severity]}）
                </h3>
                {issue.description && <p>问题描述：{issue.description}</p>}
                {issue.suggestion && <p>整改建议：{issue.suggestion}</p>}
                <p className="hint">
                  登记：{new Date(issue.createdAt).toLocaleDateString('zh-CN')}
                  {issue.fixedAt &&
                    ` ｜ 整改完成：${new Date(issue.fixedAt).toLocaleDateString('zh-CN')}`}
                </p>
                {(issue.beforePhotos.length > 0 || issue.afterPhotos.length > 0) && (
                  <div className="report-photos">
                    {issue.beforePhotos.length > 0 && (
                      <div>
                        <h4>整改前</h4>
                        <div className="report-photo-row">
                          {issue.beforePhotos.map((p) => (
                            <figure key={p.id}>
                              <img src={p.dataUrl} alt={p.caption || '整改前照片'} />
                              {p.caption && <figcaption>{p.caption}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                    {issue.afterPhotos.length > 0 && (
                      <div>
                        <h4>整改后</h4>
                        <div className="report-photo-row">
                          {issue.afterPhotos.map((p) => (
                            <figure key={p.id}>
                              <img src={p.dataUrl} alt={p.caption || '整改后照片'} />
                              {p.caption && <figcaption>{p.caption}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
