import type { AssemblyPlan } from '../types';

interface Props {
  plan: AssemblyPlan;
  onPrint: () => void;
}

/** 可打印材料表：零件清单 + 工具清单 */
export function MaterialsView({ plan, onPrint }: Props) {
  const usageOf = (partId: string) =>
    plan.steps
      .map((s, i) => ({ step: s, index: i, use: s.parts.find((u) => u.partId === partId) }))
      .filter((x) => x.use)
      .map((x) => `第${x.index + 1}步 ×${x.use!.quantity}`)
      .join('、');

  return (
    <section className="materials-view">
      <div className="materials-toolbar no-print">
        <p>材料表适合打印后随货核对或采购备料使用。</p>
        <button type="button" className="btn primary" onClick={onPrint}>
          🖨 打印材料表
        </button>
      </div>

      <div className="print-area">
        <h2 className="print-title">{plan.name} — 材料表</h2>
        <p className="print-sub">{plan.description}</p>

        <h3>零件清单</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>名称</th>
              <th>数量</th>
              <th>使用步骤</th>
              <th className="print-only-col">核对 ✓</th>
            </tr>
          </thead>
          <tbody>
            {plan.parts.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>
                  {p.quantity} {p.unit}
                </td>
                <td>{usageOf(p.id) || '（全程备用）'}</td>
                <td className="print-only-col">☐</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>工具清单</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>工具</th>
              <th>说明</th>
              <th className="print-only-col">核对 ✓</th>
            </tr>
          </thead>
          <tbody>
            {plan.tools.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.note || '—'}</td>
                <td className="print-only-col">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="print-footer">打印时间：{new Date().toLocaleString('zh-CN')}</p>
      </div>
    </section>
  );
}
