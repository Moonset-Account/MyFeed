import { buildReplacementList } from '../lib/assembly';
import type { AssemblyPlan, ProgressState } from '../lib/types';

interface Props {
  plan: AssemblyPlan;
  progress: ProgressState;
}

/**
 * 可打印材料表：屏幕上作为侧栏信息展示；
 * 打印时（@media print）只输出本表与补件清单。
 */
export function MaterialsSheet({ plan, progress }: Props) {
  const replacements = buildReplacementList(plan, progress.missingParts);
  return (
    <div className="print-sheet" id="materials-sheet">
      <h1>{plan.name} — 材料表</h1>
      <p className="print-meta">
        {plan.description} ｜ 打印时间：{new Date().toLocaleString()}
      </p>

      <h2>零件清单</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>零件</th>
            <th>规格</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          {plan.parts.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.spec ?? '—'}</td>
              <td>{p.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>工具清单</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>工具</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {plan.tools.map((t, i) => (
            <tr key={t.id}>
              <td>{i + 1}</td>
              <td>{t.name}</td>
              <td>{t.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {replacements.length > 0 && (
        <>
          <h2>补件清单</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>零件</th>
                <th>规格</th>
                <th>补发数量</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {replacements.map((r, i) => (
                <tr key={r.part.id}>
                  <td>{i + 1}</td>
                  <td>{r.part.name}</td>
                  <td>{r.part.spec ?? '—'}</td>
                  <td>{r.quantity}</td>
                  <td>{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
