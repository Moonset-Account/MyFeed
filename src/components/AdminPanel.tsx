import type { AssemblyPlan, AssemblyStep, Checkpoint } from '../types';
import { illustrationKeys } from './Illustration';

interface Props {
  plan: AssemblyPlan;
  onChange: (plan: AssemblyPlan) => void;
  onResetSample: () => void;
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function AdminPanel({ plan, onChange, onResetSample }: Props) {
  const update = (patch: Partial<AssemblyPlan>) => onChange({ ...plan, ...patch });

  const updateStep = (stepId: string, patch: Partial<AssemblyStep>) =>
    update({
      steps: plan.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    });

  const moveStep = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= plan.steps.length) return;
    const steps = [...plan.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    update({ steps });
  };

  const addStep = () =>
    update({
      steps: [
        ...plan.steps,
        {
          id: uid('s'),
          title: `新步骤 ${plan.steps.length + 1}`,
          description: '',
          imageKey: 'generic',
          imageAlt: '',
          parts: [],
          toolIds: [],
          checkpoints: [],
        },
      ],
    });

  const removeStep = (stepId: string) =>
    update({ steps: plan.steps.filter((s) => s.id !== stepId) });

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <h2>管理员配置</h2>
        <button type="button" className="btn ghost" onClick={onResetSample}>
          恢复示例方案
        </button>
      </div>

      <fieldset>
        <legend>方案信息</legend>
        <label className="field">
          产品名称
          <input
            value={plan.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label className="field">
          方案描述
          <textarea
            rows={2}
            value={plan.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>零件清单（{plan.parts.length} 项）</legend>
        {plan.parts.map((p) => (
          <div className="row" key={p.id}>
            <input
              className="w-code"
              value={p.code}
              placeholder="编号"
              onChange={(e) =>
                update({
                  parts: plan.parts.map((x) => (x.id === p.id ? { ...x, code: e.target.value } : x)),
                })
              }
            />
            <input
              className="w-name"
              value={p.name}
              placeholder="名称"
              onChange={(e) =>
                update({
                  parts: plan.parts.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)),
                })
              }
            />
            <input
              className="w-num"
              type="number"
              min={0}
              value={p.quantity}
              onChange={(e) =>
                update({
                  parts: plan.parts.map((x) =>
                    x.id === p.id ? { ...x, quantity: Math.max(0, Number(e.target.value) || 0) } : x,
                  ),
                })
              }
            />
            <input
              className="w-unit"
              value={p.unit}
              placeholder="单位"
              onChange={(e) =>
                update({
                  parts: plan.parts.map((x) => (x.id === p.id ? { ...x, unit: e.target.value } : x)),
                })
              }
            />
            <button
              type="button"
              className="btn ghost small"
              onClick={() => update({ parts: plan.parts.filter((x) => x.id !== p.id) })}
            >
              删除
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn small"
          onClick={() =>
            update({
              parts: [
                ...plan.parts,
                { id: uid('p'), code: '', name: '新零件', quantity: 1, unit: '个' },
              ],
            })
          }
        >
          + 添加零件
        </button>
      </fieldset>

      <fieldset>
        <legend>工具清单（{plan.tools.length} 项）</legend>
        {plan.tools.map((t) => (
          <div className="row" key={t.id}>
            <input
              className="w-name"
              value={t.name}
              placeholder="工具名称"
              onChange={(e) =>
                update({
                  tools: plan.tools.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)),
                })
              }
            />
            <input
              className="w-grow"
              value={t.note}
              placeholder="说明（可选）"
              onChange={(e) =>
                update({
                  tools: plan.tools.map((x) => (x.id === t.id ? { ...x, note: e.target.value } : x)),
                })
              }
            />
            <button
              type="button"
              className="btn ghost small"
              onClick={() => update({ tools: plan.tools.filter((x) => x.id !== t.id) })}
            >
              删除
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn small"
          onClick={() =>
            update({ tools: [...plan.tools, { id: uid('t'), name: '新工具', note: '' }] })
          }
        >
          + 添加工具
        </button>
      </fieldset>

      <fieldset>
        <legend>组装步骤（{plan.steps.length} 步，按顺序执行）</legend>
        {plan.steps.map((step, index) => (
          <details className="admin-step" key={step.id}>
            <summary>
              <span className="step-no small">{index + 1}</span> {step.title}
              <span className="admin-step-ops">
                <button type="button" className="btn ghost small" disabled={index === 0} onClick={(e) => { e.preventDefault(); moveStep(index, -1); }}>
                  ↑
                </button>
                <button type="button" className="btn ghost small" disabled={index === plan.steps.length - 1} onClick={(e) => { e.preventDefault(); moveStep(index, 1); }}>
                  ↓
                </button>
                <button type="button" className="btn ghost small danger-text" onClick={(e) => { e.preventDefault(); removeStep(step.id); }}>
                  删除
                </button>
              </span>
            </summary>

            <label className="field">
              步骤标题
              <input value={step.title} onChange={(e) => updateStep(step.id, { title: e.target.value })} />
            </label>
            <label className="field">
              操作说明
              <textarea
                rows={3}
                value={step.description}
                onChange={(e) => updateStep(step.id, { description: e.target.value })}
              />
            </label>
            <div className="row">
              <label className="field w-grow">
                配图
                <select
                  value={step.imageKey}
                  onChange={(e) => updateStep(step.id, { imageKey: e.target.value })}
                >
                  {illustrationKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field w-grow">
                图片说明
                <input
                  value={step.imageAlt}
                  placeholder="描述图片内容，便于无障碍与打印"
                  onChange={(e) => updateStep(step.id, { imageAlt: e.target.value })}
                />
              </label>
            </div>

            <div className="sub-block">
              <strong>本步零件</strong>
              {step.parts.map((use, i) => (
                <div className="row" key={`${use.partId}-${i}`}>
                  <select
                    value={use.partId}
                    onChange={(e) =>
                      updateStep(step.id, {
                        parts: step.parts.map((u, j) =>
                          j === i ? { ...u, partId: e.target.value } : u,
                        ),
                      })
                    }
                  >
                    {plan.parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-num"
                    type="number"
                    min={1}
                    value={use.quantity}
                    onChange={(e) =>
                      updateStep(step.id, {
                        parts: step.parts.map((u, j) =>
                          j === i ? { ...u, quantity: Math.max(1, Number(e.target.value) || 1) } : u,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      updateStep(step.id, { parts: step.parts.filter((_, j) => j !== i) })
                    }
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn small"
                disabled={plan.parts.length === 0}
                onClick={() =>
                  updateStep(step.id, {
                    parts: [...step.parts, { partId: plan.parts[0].id, quantity: 1 }],
                  })
                }
              >
                + 添加零件用量
              </button>
            </div>

            <div className="sub-block">
              <strong>所需工具</strong>
              <div className="tool-checks">
                {plan.tools.map((t) => (
                  <label key={t.id} className="inline-check">
                    <input
                      type="checkbox"
                      checked={step.toolIds.includes(t.id)}
                      onChange={(e) =>
                        updateStep(step.id, {
                          toolIds: e.target.checked
                            ? [...step.toolIds, t.id]
                            : step.toolIds.filter((id) => id !== t.id),
                        })
                      }
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="sub-block">
              <strong>检查点</strong>
              {step.checkpoints.map((c: Checkpoint) => (
                <div className="row" key={c.id}>
                  <input
                    className="w-grow"
                    value={c.text}
                    placeholder="检查点内容"
                    onChange={(e) =>
                      updateStep(step.id, {
                        checkpoints: step.checkpoints.map((x) =>
                          x.id === c.id ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={c.required}
                      onChange={(e) =>
                        updateStep(step.id, {
                          checkpoints: step.checkpoints.map((x) =>
                            x.id === c.id ? { ...x, required: e.target.checked } : x,
                          ),
                        })
                      }
                    />
                    必需
                  </label>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      updateStep(step.id, {
                        checkpoints: step.checkpoints.filter((x) => x.id !== c.id),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  updateStep(step.id, {
                    checkpoints: [
                      ...step.checkpoints,
                      { id: uid('c'), text: '新检查点', required: true },
                    ],
                  })
                }
              >
                + 添加检查点
              </button>
            </div>
          </details>
        ))}
        <button type="button" className="btn small" onClick={addStep}>
          + 添加步骤
        </button>
      </fieldset>
    </section>
  );
}
