import { useState } from 'react';
import type { Area, Thresholds } from '../types';
import { evaluateArea } from '../lib/rules';
import { createId } from '../lib/storage';
import type { Action } from '../store';

interface Props {
  areas: Area[];
  thresholds: Thresholds;
  dispatch: React.Dispatch<Action>;
}

function NumberField(props: {
  label: string;
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        min={0}
        step="0.5"
        value={props.value ?? ''}
        placeholder={props.placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          props.onChange(raw === '' ? null : Number(raw));
        }}
      />
    </label>
  );
}

export function AreaPanel({ areas, thresholds, dispatch }: Props) {
  const [newName, setNewName] = useState('');

  const addArea = () => {
    const name = newName.trim();
    if (!name) return;
    dispatch({
      type: 'addArea',
      area: { id: createId(), name, doorWidth: null, passageWidth: null, stepHeight: null, notes: '' },
    });
    setNewName('');
  };

  return (
    <section>
      <div className="section-head">
        <h2>区域测量记录</h2>
        <p className="hint">
          当前阈值：门净宽 ≥ {thresholds.minDoorWidth} cm，通道净宽 ≥ {thresholds.minPassageWidth}{' '}
          cm，台阶/门槛 ≤ {thresholds.maxStepHeight} cm（可在“阈值设置”中调整）
        </p>
      </div>

      <div className="area-grid">
        {areas.map((area) => {
          const violations = evaluateArea(area, thresholds);
          return (
            <div key={area.id} className={`card ${violations.length > 0 ? 'card-warn' : ''}`}>
              <div className="card-head">
                <input
                  className="area-name"
                  value={area.name}
                  onChange={(e) => dispatch({ type: 'updateArea', area: { ...area, name: e.target.value } })}
                />
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`删除区域「${area.name}」？相关问题将取消与该区域的关联。`)) {
                      dispatch({ type: 'removeArea', areaId: area.id });
                    }
                  }}
                >
                  删除
                </button>
              </div>
              <div className="field-row">
                <NumberField
                  label="门净宽 (cm)"
                  value={area.doorWidth}
                  placeholder={`≥ ${thresholds.minDoorWidth}`}
                  onChange={(v) => dispatch({ type: 'updateArea', area: { ...area, doorWidth: v } })}
                />
                <NumberField
                  label="通道净宽 (cm)"
                  value={area.passageWidth}
                  placeholder={`≥ ${thresholds.minPassageWidth}`}
                  onChange={(v) => dispatch({ type: 'updateArea', area: { ...area, passageWidth: v } })}
                />
                <NumberField
                  label="台阶/门槛 (cm)"
                  value={area.stepHeight}
                  placeholder={`≤ ${thresholds.maxStepHeight}`}
                  onChange={(v) => dispatch({ type: 'updateArea', area: { ...area, stepHeight: v } })}
                />
              </div>
              <label className="field">
                <span>备注</span>
                <input
                  value={area.notes}
                  placeholder="如：入户门为子母门、卫生间有挡水条…"
                  onChange={(e) => dispatch({ type: 'updateArea', area: { ...area, notes: e.target.value } })}
                />
              </label>
              {violations.length > 0 ? (
                <ul className="violation-list">
                  {violations.map((v) => (
                    <li key={v.field}>
                      ⚠ {v.label} {v.actual} cm，要求 {v.requirement}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ok-text">✓ 已填写的测量项均达标</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="add-row">
        <input
          value={newName}
          placeholder="新增区域名称，如：书房"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addArea()}
        />
        <button className="btn" onClick={addArea}>
          添加区域
        </button>
      </div>
    </section>
  );
}
