import { useState } from 'react';
import type { AssemblyPlan, AssemblyStep, Part, Tool } from '../lib/types';

interface Props {
  plan: AssemblyPlan;
  onSave: (plan: AssemblyPlan) => void;
  onRestoreDefault: () => void;
  onClose: () => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 管理员配置页：按顺序维护零件、工具、步骤（含图片说明与检查点） */
export function AdminEditor({ plan, onSave, onRestoreDefault, onClose }: Props) {
  const [draft, setDraft] = useState<AssemblyPlan>(() => structuredClone(plan));

  const update = (fn: (d: AssemblyPlan) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const moveStep = (index: number, dir: -1 | 1) =>
    update((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.steps.length) return;
      const [s] = d.steps.splice(index, 1);
      d.steps.splice(j, 0, s);
    });

  const illustrations = ['layout', 'frame', 'shelf', 'back', 'anchor', 'done'];

  return (
    <div className="admin">
      <header className="admin-header">
        <h2>管理配置</h2>
        <div className="admin-header-actions">
          <button type="button" className="btn btn-ghost" onClick={onRestoreDefault}>
            恢复默认方案
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>
            保存方案
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            返回
          </button>
        </div>
      </header>

      <section className="admin-section">
        <h3>基本信息</h3>
        <label className="field">
          方案名称
          <input
            value={draft.name}
            onChange={(e) => update((d) => void (d.name = e.target.value))}
          />
        </label>
        <label className="field">
          方案描述
          <input
            value={draft.description}
            onChange={(e) => update((d) => void (d.description = e.target.value))}
          />
        </label>
      </section>

      <section className="admin-section">
        <h3>零件（{draft.parts.length}）</h3>
        {draft.parts.map((p: Part, i: number) => (
          <div className="admin-row" key={p.id}>
            <input
              aria-label="零件名"
              value={p.name}
              onChange={(e) => update((d) => void (d.parts[i].name = e.target.value))}
            />
            <input
              aria-label="数量"
              type="number"
              min={1}
              value={p.quantity}
              onChange={(e) =>
                update((d) => void (d.parts[i].quantity = Math.max(1, Number(e.target.value) || 1)))
              }
            />
            <input
              aria-label="规格"
              placeholder="规格（可选）"
              value={p.spec ?? ''}
              onChange={(e) => update((d) => void (d.parts[i].spec = e.target.value || undefined))}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => update((d) => void d.parts.splice(i, 1))}
            >
              删除
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            update((d) => void d.parts.push({ id: uid('p'), name: '新零件', quantity: 1 }))
          }
        >
          + 添加零件
        </button>
      </section>

      <section className="admin-section">
        <h3>工具（{draft.tools.length}）</h3>
        {draft.tools.map((t: Tool, i: number) => (
          <div className="admin-row" key={t.id}>
            <input
              aria-label="工具名"
              value={t.name}
              onChange={(e) => update((d) => void (d.tools[i].name = e.target.value))}
            />
            <input
              aria-label="备注"
              placeholder="备注（可选）"
              value={t.note ?? ''}
              onChange={(e) => update((d) => void (d.tools[i].note = e.target.value || undefined))}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => update((d) => void d.tools.splice(i, 1))}
            >
              删除
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => update((d) => void d.tools.push({ id: uid('t'), name: '新工具' }))}
        >
          + 添加工具
        </button>
      </section>

      <section className="admin-section">
        <h3>步骤（{draft.steps.length}，按顺序执行）</h3>
        {draft.steps.map((s: AssemblyStep, i: number) => (
          <div className="admin-step" key={s.id}>
            <div className="admin-step-head">
              <span className="step-number">{i + 1}</span>
              <input
                aria-label="步骤标题"
                value={s.title}
                onChange={(e) => update((d) => void (d.steps[i].title = e.target.value))}
              />
              <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={i === draft.steps.length - 1}
                onClick={() => moveStep(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => update((d) => void d.steps.splice(i, 1))}
              >
                删除
              </button>
            </div>
            <textarea
              aria-label="步骤说明"
              rows={2}
              value={s.description}
              onChange={(e) => update((d) => void (d.steps[i].description = e.target.value))}
            />
            <div className="admin-step-grid">
              <label className="field">
                示意图
                <select
                  value={s.illustration}
                  onChange={(e) => update((d) => void (d.steps[i].illustration = e.target.value))}
                >
                  {illustrations.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                关联零件（逗号分隔 id）
                <input
                  value={s.partIds.join(',')}
                  onChange={(e) =>
                    update(
                      (d) =>
                        void (d.steps[i].partIds = e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean)),
                    )
                  }
                />
              </label>
              <label className="field">
                关联工具（逗号分隔 id）
                <input
                  value={s.toolIds.join(',')}
                  onChange={(e) =>
                    update(
                      (d) =>
                        void (d.steps[i].toolIds = e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean)),
                    )
                  }
                />
              </label>
            </div>
            <div className="admin-checkpoint">
              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={Boolean(s.checkpoint)}
                  onChange={(e) =>
                    update(
                      (d) =>
                        void (d.steps[i].checkpoint = e.target.checked
                          ? { text: '检查点内容', required: false }
                          : null),
                    )
                  }
                />
                启用检查点
              </label>
              {s.checkpoint && (
                <>
                  <input
                    aria-label="检查点内容"
                    className="grow"
                    value={s.checkpoint.text}
                    onChange={(e) => update((d) => void (d.steps[i].checkpoint!.text = e.target.value))}
                  />
                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={s.checkpoint.required}
                      onChange={(e) =>
                        update((d) => void (d.steps[i].checkpoint!.required = e.target.checked))
                      }
                    />
                    必需（未勾选则阻止完成）
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            update(
              (d) =>
                void d.steps.push({
                  id: uid('s'),
                  title: '新步骤',
                  description: '',
                  illustration: 'layout',
                  partIds: [],
                  toolIds: [],
                  checkpoint: null,
                }),
            )
          }
        >
          + 添加步骤
        </button>
      </section>
    </div>
  );
}
