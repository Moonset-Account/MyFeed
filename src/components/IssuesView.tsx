import { useState } from 'react';
import type { Area, Issue, Severity } from '../types';
import { uid } from '../logic/store';
import { PhotoPicker } from './PhotoPicker';

interface Props {
  areas: Area[];
  issues: Issue[];
  onChange: (issues: Issue[]) => void;
}

const SEVERITY_LABEL: Record<Severity, string> = { low: '轻微', medium: '中等', high: '严重' };

const emptyDraft = () => ({
  title: '',
  description: '',
  suggestion: '',
  areaIds: [] as string[],
  severity: 'medium' as Severity,
});

export function IssuesView({ areas, issues, onChange }: Props) {
  const [draft, setDraft] = useState(emptyDraft());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleArea = (id: string) =>
    setDraft((d) => ({
      ...d,
      areaIds: d.areaIds.includes(id) ? d.areaIds.filter((x) => x !== id) : [...d.areaIds, id],
    }));

  const addIssue = () => {
    if (!draft.title.trim()) {
      alert('请填写问题标题');
      return;
    }
    if (draft.areaIds.length === 0) {
      alert('请至少关联一个区域');
      return;
    }
    onChange([
      {
        id: uid(),
        ...draft,
        title: draft.title.trim(),
        status: 'open',
        beforePhotos: [],
        afterPhotos: [],
        createdAt: new Date().toISOString(),
        fixedAt: null,
      },
      ...issues,
    ]);
    setDraft(emptyDraft());
  };

  const updateIssue = (id: string, patch: Partial<Issue>) =>
    onChange(issues.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggleStatus = (issue: Issue) => {
    if (issue.status === 'open') {
      updateIssue(issue.id, { status: 'fixed', fixedAt: new Date().toISOString() });
    } else {
      updateIssue(issue.id, { status: 'open', fixedAt: null });
    }
  };

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '（已删除区域）';

  return (
    <section>
      <h2>问题与整改</h2>
      <div className="card">
        <h3>登记新问题</h3>
        <label>
          问题标题
          <input
            value={draft.title}
            placeholder="如：卫生间门槛过高"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          问题描述
          <textarea
            value={draft.description}
            placeholder="现场情况、影响人群等"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label>
          整改建议
          <textarea
            value={draft.suggestion}
            placeholder="如：拆除门槛并做 1:12 坡道过渡"
            onChange={(e) => setDraft({ ...draft, suggestion: e.target.value })}
          />
        </label>
        <div className="row gap wrap">
          <span>严重程度：</span>
          {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
            <label key={s} className="row gap">
              <input
                type="radio"
                name="severity"
                checked={draft.severity === s}
                onChange={() => setDraft({ ...draft, severity: s })}
              />
              {SEVERITY_LABEL[s]}
            </label>
          ))}
        </div>
        <fieldset>
          <legend>关联区域（可多选）</legend>
          <div className="row gap wrap">
            {areas.map((a) => (
              <label key={a.id} className="row gap">
                <input
                  type="checkbox"
                  checked={draft.areaIds.includes(a.id)}
                  onChange={() => toggleArea(a.id)}
                />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button onClick={addIssue}>登记问题</button>
      </div>

      {issues.length === 0 && <p className="hint">暂无问题记录。</p>}
      {issues.map((issue) => (
        <div className={`card issue ${issue.status}`} key={issue.id}>
          <div className="row between">
            <h3>
              {issue.status === 'fixed' ? '✅' : '🔧'} {issue.title}
              <span className={`badge sev-${issue.severity}`}>{SEVERITY_LABEL[issue.severity]}</span>
            </h3>
            <div className="row gap">
              <button className="ghost" onClick={() => setExpanded(expanded === issue.id ? null : issue.id)}>
                {expanded === issue.id ? '收起' : '详情 / 整改'}
              </button>
              <button
                className="danger ghost"
                onClick={() => {
                  if (confirm(`删除问题「${issue.title}」及其前后照片记录？`)) {
                    onChange(issues.filter((i) => i.id !== issue.id));
                  }
                }}
              >
                删除
              </button>
            </div>
          </div>
          <p className="hint">
            关联区域：{issue.areaIds.map(areaName).join('、')} ｜ 登记于{' '}
            {new Date(issue.createdAt).toLocaleDateString('zh-CN')}
            {issue.fixedAt && ` ｜ 整改完成于 ${new Date(issue.fixedAt).toLocaleDateString('zh-CN')}`}
          </p>
          {issue.description && <p>{issue.description}</p>}
          {issue.suggestion && <p>整改建议:{issue.suggestion}</p>}

          {expanded === issue.id && (
            <div className="issue-detail">
              <label>
                整改建议（可修改）
                <textarea
                  value={issue.suggestion}
                  onChange={(e) => updateIssue(issue.id, { suggestion: e.target.value })}
                />
              </label>
              <fieldset>
                <legend>关联区域</legend>
                <div className="row gap wrap">
                  {areas.map((a) => (
                    <label key={a.id} className="row gap">
                      <input
                        type="checkbox"
                        checked={issue.areaIds.includes(a.id)}
                        onChange={() =>
                          updateIssue(issue.id, {
                            areaIds: issue.areaIds.includes(a.id)
                              ? issue.areaIds.filter((x) => x !== a.id)
                              : [...issue.areaIds, a.id],
                          })
                        }
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <PhotoPicker
                label="整改前照片"
                photos={issue.beforePhotos}
                onChange={(photos) => updateIssue(issue.id, { beforePhotos: photos })}
              />
              {issue.status === 'fixed' && (
                <PhotoPicker
                  label="整改后照片"
                  photos={issue.afterPhotos}
                  onChange={(photos) => updateIssue(issue.id, { afterPhotos: photos })}
                />
              )}
              <button onClick={() => toggleStatus(issue)}>
                {issue.status === 'open' ? '标记为已整改（保留前后记录）' : '重新打开问题'}
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
