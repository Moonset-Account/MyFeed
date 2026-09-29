import type { Area, Issue, Thresholds } from '../types';
import { summarizeByArea, summarizeOverall } from '../logic/rules';

interface Props {
  areas: Area[];
  issues: Issue[];
  thresholds: Thresholds;
}

export function SummaryView({ areas, issues, thresholds }: Props) {
  const summaries = summarizeByArea(areas, issues, thresholds);
  const overall = summarizeOverall(summaries);

  return (
    <section>
      <h2>按区域汇总</h2>
      <div className="stats">
        <div className="stat">
          <strong>{overall.totalAreas}</strong>
          <span>检查区域</span>
        </div>
        <div className="stat">
          <strong>{overall.areasWithViolations}</strong>
          <span>存在不达标项</span>
        </div>
        <div className="stat">
          <strong>{overall.totalViolations}</strong>
          <span>测量不达标项</span>
        </div>
        <div className="stat">
          <strong>{overall.openIssues}</strong>
          <span>待整改问题</span>
        </div>
        <div className="stat">
          <strong>{overall.fixedIssues}</strong>
          <span>已整改问题</span>
        </div>
      </div>
      {summaries.map((s) => (
        <div className="card" key={s.area.id}>
          <h3>{s.area.name}</h3>
          {s.violations.length > 0 ? (
            <ul className="violations">
              {s.violations.map((v) => (
                <li key={v.field}>⚠ {v.message}</li>
              ))}
            </ul>
          ) : (
            <p className="ok">✓ 测量项均达标</p>
          )}
          {s.openIssues.length > 0 && (
            <p>待整改：{s.openIssues.map((i) => i.title).join('、')}</p>
          )}
          {s.fixedIssues.length > 0 && (
            <p className="ok">已整改：{s.fixedIssues.map((i) => i.title).join('、')}</p>
          )}
          {s.openIssues.length === 0 && s.fixedIssues.length === 0 && (
            <p className="hint">无关联问题</p>
          )}
        </div>
      ))}
    </section>
  );
}
