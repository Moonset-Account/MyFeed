import { useState } from 'react';
import type { Thresholds } from '../types';
import { DEFAULT_THRESHOLDS } from '../lib/rules';
import type { Action } from '../store';

interface Props {
  thresholds: Thresholds;
  dispatch: React.Dispatch<Action>;
}

export function ThresholdPanel({ thresholds, dispatch }: Props) {
  const [draft, setDraft] = useState<Thresholds>(thresholds);

  const save = () => {
    const values = [draft.minDoorWidth, draft.minPassageWidth, draft.maxStepHeight];
    if (values.some((v) => Number.isNaN(v) || v < 0)) {
      window.alert('阈值需为不小于 0 的数字');
      return;
    }
    dispatch({ type: 'setThresholds', thresholds: draft });
    window.alert('阈值已保存，区域测量与汇总报告将按新阈值重新评估。');
  };

  return (
    <section>
      <div className="section-head">
        <h2>规则阈值设置</h2>
        <p className="hint">单位均为厘米（cm）。修改后全站评估与报告立即按新阈值生效。</p>
      </div>
      <div className="card editor">
        <label className="field">
          <span>门净宽下限（cm）</span>
          <input
            type="number"
            min={0}
            step="1"
            value={draft.minDoorWidth}
            onChange={(e) => setDraft({ ...draft, minDoorWidth: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>通道净宽下限（cm）</span>
          <input
            type="number"
            min={0}
            step="1"
            value={draft.minPassageWidth}
            onChange={(e) => setDraft({ ...draft, minPassageWidth: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>允许的最大台阶/门槛高度（cm，0 表示要求无台阶）</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={draft.maxStepHeight}
            onChange={(e) => setDraft({ ...draft, maxStepHeight: Number(e.target.value) })}
          />
        </label>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>
            保存阈值
          </button>
          <button
            className="btn"
            onClick={() => {
              setDraft({ ...DEFAULT_THRESHOLDS });
              dispatch({ type: 'setThresholds', thresholds: { ...DEFAULT_THRESHOLDS } });
            }}
          >
            恢复默认（80 / 90 / 2）
          </button>
        </div>
      </div>
    </section>
  );
}
