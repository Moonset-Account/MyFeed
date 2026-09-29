import type { Area, Issue, Thresholds } from '../types';
import { overallStats, summarizeByArea } from '../lib/rules';

interface Props {
  areas: Area[];
  issues: Issue[];
  thresholds: Thresholds;
}

function fmt(v: number | null): string {
  return v === null ? '未测量' : `${v} cm`;
}

export function ReportPanel({ areas, issues, thresholds }: Props) {
  const summaries = summarizeByArea(areas, issues, thresholds);
  const stats = overallStats(summaries);
  const generatedAt = new Date().toLocaleString('zh-CN');

  return (
    <section>
      <div className="section-head no-print">
        <h2>汇总报告</h2>
        <button className="btn btn-primary" onClick={() => window.print()}>
          打印报告
        </button>
      </div>

      <div id="report" className="report">
        <header className="report-header">
          <h1>住宅无障碍检查报告</h1>
          <p>
            生成时间：{generatedAt} · 适用阈值：门净宽 ≥ {thresholds.minDoorWidth} cm，通道净宽 ≥{' '}
            {thresholds.minPassageWidth} cm，台阶/门槛 ≤ {thresholds.maxStepHeight} cm
          </p>
        </header>

        <table className="stats-table">
          <tbody>
            <tr>
              <th>检查区域数</th>
              <td>{stats.totalAreas}</td>
              <th>存在不达标的区域</th>
              <td>{stats.areasWithViolations}</td>
            </tr>
            <tr>
              <th>测量不达标项</th>
              <td>{stats.totalViolations}</td>
              <th>问题（待整改 / 已整改）</th>
              <td>
                {stats.openIssues} / {stats.resolvedIssues}
              </td>
            </tr>
          </tbody>
        </table>

        {summaries.map((s) => (
          <div key={s.area.id} className="report-area">
            <h2>
              {s.area.name}
              {s.violations.length === 0 && s.openIssues.length === 0 && (
                <span className="ok-text">　✓ 无待处理问题</span>
              )}
            </h2>
            <table className="report-table">
              <thead>
                <tr>
                  <th>门净宽</th>
                  <th>通道净宽</th>
                  <th>台阶/门槛</th>
                  <th>评估结果</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{fmt(s.area.doorWidth)}</td>
                  <td>{fmt(s.area.passageWidth)}</td>
                  <td>{fmt(s.area.stepHeight)}</td>
                  <td>
                    {s.violations.length === 0
                      ? '达标'
                      : s.violations.map((v) => `${v.label} ${v.actual}cm（要求${v.requirement}）`).join('；')}
                  </td>
                </tr>
              </tbody>
            </table>
            {s.area.notes && <p className="hint">备注：{s.area.notes}</p>}

            {s.openIssues.length > 0 && (
              <>
                <h3>待整改问题</h3>
                <ul>
                  {s.openIssues.map((i) => (
                    <li key={i.id}>
                      <strong>{i.title}</strong>
                      {i.suggestion && ` —— 建议：${i.suggestion}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {s.resolvedIssues.length > 0 && (
              <>
                <h3>已整改问题（保留前后记录）</h3>
                <ul>
                  {s.resolvedIssues.map((i) => (
                    <li key={i.id}>
                      <strong>{i.title}</strong>
                      {i.resolvedAt && `（完成于 ${new Date(i.resolvedAt).toLocaleDateString('zh-CN')}）`}
                      {` —— 整改前照片 ${i.beforePhotos.length} 张，整改后照片 ${i.afterPhotos.length} 张`}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}

        <footer className="report-footer">
          <p>本报告由「无障碍检查清单」本地生成，数据仅保存在当前浏览器中。</p>
        </footer>
      </div>
    </section>
  );
}
