import type { Area, Thresholds } from '../types';
import { evaluateMeasurement } from '../logic/rules';
import { emptyMeasurement, uid } from '../logic/store';

interface Props {
  areas: Area[];
  thresholds: Thresholds;
  onChange: (areas: Area[]) => void;
}

export function AreasView({ areas, thresholds, onChange }: Props) {
  const updateArea = (id: string, patch: Partial<Area>) =>
    onChange(areas.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const updateMeasurement = (id: string, patch: Partial<Area['measurement']>) =>
    onChange(
      areas.map((a) =>
        a.id === id ? { ...a, measurement: { ...a.measurement, ...patch } } : a,
      ),
    );

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  return (
    <section>
      <div className="row between">
        <h2>区域测量记录</h2>
        <button
          onClick={() =>
            onChange([...areas, { id: uid(), name: `新区域 ${areas.length + 1}`, measurement: emptyMeasurement() }])
          }
        >
          + 添加区域
        </button>
      </div>
      <p className="hint">
        记录各区域门净宽、通道净宽与台阶情况；不达标项会依据当前阈值自动标红。
      </p>
      <div className="grid">
        {areas.map((area) => {
          const violations = evaluateMeasurement(area.measurement, thresholds);
          return (
            <div className="card" key={area.id}>
              <div className="row between">
                <input
                  className="area-name"
                  value={area.name}
                  onChange={(e) => updateArea(area.id, { name: e.target.value })}
                />
                <button
                  className="danger ghost"
                  onClick={() => {
                    if (confirm(`删除区域「${area.name}」？关联问题中的该区域引用也会移除。`)) {
                      onChange(areas.filter((a) => a.id !== area.id));
                    }
                  }}
                >
                  删除
                </button>
              </div>
              <label>
                门净宽（cm）
                <input
                  type="number"
                  min={0}
                  value={area.measurement.doorWidth ?? ''}
                  placeholder="未测量"
                  onChange={(e) => updateMeasurement(area.id, { doorWidth: numOrNull(e.target.value) })}
                />
              </label>
              <label>
                通道净宽（cm）
                <input
                  type="number"
                  min={0}
                  value={area.measurement.passageWidth ?? ''}
                  placeholder="未测量"
                  onChange={(e) =>
                    updateMeasurement(area.id, { passageWidth: numOrNull(e.target.value) })
                  }
                />
              </label>
              <label className="row gap">
                <input
                  type="checkbox"
                  checked={area.measurement.hasStep}
                  onChange={(e) =>
                    updateMeasurement(area.id, {
                      hasStep: e.target.checked,
                      stepHeight: e.target.checked ? area.measurement.stepHeight : 0,
                    })
                  }
                />
                存在台阶 / 门槛
              </label>
              {area.measurement.hasStep && (
                <label>
                  台阶 / 门槛高度（cm）
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={area.measurement.stepHeight}
                    onChange={(e) =>
                      updateMeasurement(area.id, { stepHeight: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              )}
              <label>
                备注
                <input
                  value={area.measurement.note}
                  placeholder="如：入户门为子母门"
                  onChange={(e) => updateMeasurement(area.id, { note: e.target.value })}
                />
              </label>
              {violations.length > 0 ? (
                <ul className="violations">
                  {violations.map((v) => (
                    <li key={v.field}>⚠ {v.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="ok">✓ 当前测量值均达标</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
