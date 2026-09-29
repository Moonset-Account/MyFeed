import { useState } from 'react';
import type { Thresholds } from '../types';
import { DEFAULT_THRESHOLDS, validateThresholds } from '../logic/rules';

interface Props {
  thresholds: Thresholds;
  onChange: (t: Thresholds) => void;
}

export function SettingsView({ thresholds, onChange }: Props) {
  const [draft, setDraft] = useState<Thresholds>({ ...thresholds });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const save = () => {
    const err = validateThresholds(draft);
    setError(err);
    if (!err) {
      onChange({ ...draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const field = (key: keyof Thresholds, label: string, hint: string) => (
    <label>
      {label}（cm）
      <input
        type="number"
        min={0}
        value={draft[key]}
        onChange={(e) => {
          setDraft({ ...draft, [key]: Number(e.target.value) });
          setSaved(false);
        }}
      />
      <span className="hint">{hint}</span>
    </label>
  );

  return (
    <section>
      <h2>规则阈值设置</h2>
      <p className="hint">阈值用于判定各区域测量是否达标，保存后立即作用于汇总与报告。</p>
      <div className="card">
        {field('doorWidthMin', '门净宽最小值', '常用参考：轮椅通行建议 ≥ 80cm')}
        {field('passageWidthMin', '通道净宽最小值', '常用参考：轮椅单向通行建议 ≥ 90cm')}
        {field('stepHeightMax', '台阶 / 门槛高度限值', '0 表示要求完全无高差')}
        {error && <p className="error">{error}</p>}
        <div className="row gap">
          <button onClick={save}>保存阈值</button>
          <button
            className="ghost"
            onClick={() => {
              setDraft({ ...DEFAULT_THRESHOLDS });
              setError('');
            }}
          >
            恢复默认
          </button>
          {saved && <span className="ok">已保存 ✓</span>}
        </div>
      </div>
    </section>
  );
}
