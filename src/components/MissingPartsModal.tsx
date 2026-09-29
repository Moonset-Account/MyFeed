import { useMemo, useState } from 'react';
import { formatReplacementList } from '../lib/assembly';
import type { AssemblyPlan, MissingPartEntry } from '../lib/types';

interface Props {
  plan: AssemblyPlan;
  initial: MissingPartEntry[];
  onCancel: () => void;
  /** 确认后暂停组装并生成补件清单 */
  onConfirm: (missing: MissingPartEntry[]) => void;
}

export function MissingPartsModal({ plan, initial, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<Record<string, { quantity: number; note: string }>>(() => {
    const map: Record<string, { quantity: number; note: string }> = {};
    for (const m of initial) map[m.partId] = { quantity: m.quantity, note: m.note ?? '' };
    return map;
  });

  const entries: MissingPartEntry[] = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v.quantity > 0)
        .map(([partId, v]) => ({ partId, quantity: v.quantity, note: v.note || undefined })),
    [selected],
  );

  const toggle = (partId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[partId]) delete next[partId];
      else next[partId] = { quantity: 1, note: '' };
      return next;
    });
  };

  const preview = formatReplacementList(plan, entries);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="缺件登记">
      <div className="modal">
        <h2>缺件登记与暂停</h2>
        <p className="modal-tip">
          勾选缺失或损坏的零件并填写数量。确认后组装将暂停，并生成补件清单用于联系售后补发。
        </p>
        <ul className="missing-list">
          {plan.parts.map((p) => {
            const sel = selected[p.id];
            return (
              <li key={p.id} className={sel ? 'is-selected' : ''}>
                <label>
                  <input type="checkbox" checked={Boolean(sel)} onChange={() => toggle(p.id)} />
                  <span className="missing-name">
                    {p.name}
                    {p.spec ? <em>{p.spec}</em> : null}
                    <small>应有 × {p.quantity}</small>
                  </span>
                </label>
                {sel && (
                  <span className="missing-fields">
                    <label>
                      缺
                      <input
                        type="number"
                        min={1}
                        max={p.quantity}
                        value={sel.quantity}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], quantity: Number(e.target.value) },
                          }))
                        }
                      />
                      件
                    </label>
                    <input
                      type="text"
                      placeholder="备注（可选，如：边角破损）"
                      value={sel.note}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], note: e.target.value },
                        }))
                      }
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {entries.length > 0 && (
          <pre className="replacement-preview" aria-label="补件清单预览">{preview}</pre>
        )}
        <footer className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-warning"
            disabled={entries.length === 0}
            onClick={() => onConfirm(entries)}
          >
            暂停组装并生成补件清单（{entries.length} 项）
          </button>
        </footer>
      </div>
    </div>
  );
}
