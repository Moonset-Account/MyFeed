import { useState } from 'react';
import type { Area, Issue } from '../types';
import { createId } from '../lib/storage';
import type { Action } from '../store';
import { PhotoUploader } from './PhotoUploader';

interface Props {
  areas: Area[];
  issues: Issue[];
  dispatch: React.Dispatch<Action>;
}

function emptyIssue(): Issue {
  return {
    id: createId(),
    title: '',
    description: '',
    areaIds: [],
    suggestion: '',
    status: 'open',
    beforePhotos: [],
    afterPhotos: [],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

function AreaMultiSelect(props: {
  areas: Area[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="area-checkboxes">
      {props.areas.map((area) => (
        <label key={area.id} className="checkbox-pill">
          <input
            type="checkbox"
            checked={props.selected.includes(area.id)}
            onChange={(e) =>
              props.onChange(
                e.target.checked
                  ? [...props.selected, area.id]
                  : props.selected.filter((id) => id !== area.id),
              )
            }
          />
          {area.name}
        </label>
      ))}
      {props.areas.length === 0 && <span className="hint">请先在“检查记录”中添加区域</span>}
    </div>
  );
}

function IssueEditor(props: {
  issue: Issue;
  areas: Area[];
  onSave: (issue: Issue) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Issue>(props.issue);

  const save = () => {
    if (!draft.title.trim()) {
      window.alert('请填写问题标题');
      return;
    }
    if (draft.areaIds.length === 0) {
      window.alert('请至少关联一个区域');
      return;
    }
    props.onSave({ ...draft, title: draft.title.trim() });
  };

  return (
    <div className="card editor">
      <label className="field">
        <span>问题标题 *</span>
        <input
          value={draft.title}
          placeholder="如：卫生间门槛过高，轮椅无法通行"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="field">
        <span>问题描述</span>
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <div className="field">
        <span className="field-label">关联区域 *（同一问题可关联多个区域）</span>
        <AreaMultiSelect
          areas={props.areas}
          selected={draft.areaIds}
          onChange={(ids) => setDraft({ ...draft, areaIds: ids })}
        />
      </div>
      <label className="field">
        <span>整改建议</span>
        <textarea
          rows={2}
          value={draft.suggestion}
          placeholder="如：拆除门槛并做 1:12 坡道过渡，建议宽度 ≥ 90cm"
          onChange={(e) => setDraft({ ...draft, suggestion: e.target.value })}
        />
      </label>
      <PhotoUploader
        label="整改前照片"
        photos={draft.beforePhotos}
        onChange={(p) => setDraft({ ...draft, beforePhotos: p })}
      />
      {draft.status === 'resolved' && (
        <PhotoUploader
          label="整改后照片"
          photos={draft.afterPhotos}
          onChange={(p) => setDraft({ ...draft, afterPhotos: p })}
        />
      )}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={save}>
          保存
        </button>
        <button className="btn" onClick={props.onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

export function IssuePanel({ areas, issues, dispatch }: Props) {
  const [editing, setEditing] = useState<Issue | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '（已删除区域）';

  const visible = issues.filter((i) => filter === 'all' || i.status === filter);

  const toggleResolved = (issue: Issue) => {
    if (issue.status === 'open') {
      dispatch({
        type: 'updateIssue',
        issue: { ...issue, status: 'resolved', resolvedAt: new Date().toISOString() },
      });
    } else {
      dispatch({ type: 'updateIssue', issue: { ...issue, status: 'open', resolvedAt: null } });
    }
  };

  return (
    <section>
      <div className="section-head">
        <h2>问题与整改</h2>
        <div className="toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">全部问题</option>
            <option value="open">待整改</option>
            <option value="resolved">已整改</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(emptyIssue());
              setIsNew(true);
            }}
          >
            登记问题
          </button>
        </div>
      </div>

      {editing && (
        <IssueEditor
          issue={editing}
          areas={areas}
          onSave={(issue) => {
            dispatch({ type: isNew ? 'addIssue' : 'updateIssue', issue });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {visible.length === 0 && !editing && <p className="hint">暂无记录，点击“登记问题”开始。</p>}

      {visible.map((issue) => (
        <div key={issue.id} className={`card issue-card ${issue.status}`}>
          <div className="card-head">
            <h3>
              <span className={`status-badge ${issue.status}`}>
                {issue.status === 'open' ? '待整改' : '已整改'}
              </span>
              {issue.title}
            </h3>
            <div className="btn-row">
              <button className="btn btn-sm" onClick={() => toggleResolved(issue)}>
                {issue.status === 'open' ? '标记已整改' : '重新打开'}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setEditing(issue);
                  setIsNew(false);
                }}
              >
                编辑
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (window.confirm(`删除问题「${issue.title}」及其前后照片记录？`)) {
                    dispatch({ type: 'removeIssue', issueId: issue.id });
                  }
                }}
              >
                删除
              </button>
            </div>
          </div>
          <p className="issue-areas">关联区域：{issue.areaIds.map(areaName).join('、') || '未关联'}</p>
          {issue.description && <p>{issue.description}</p>}
          {issue.suggestion && <p className="suggestion">整改建议：{issue.suggestion}</p>}
          <p className="hint">
            登记于 {new Date(issue.createdAt).toLocaleString('zh-CN')}
            {issue.resolvedAt && ` · 整改完成于 ${new Date(issue.resolvedAt).toLocaleString('zh-CN')}`}
            {` · 整改前照片 ${issue.beforePhotos.length} 张 · 整改后照片 ${issue.afterPhotos.length} 张`}
          </p>
          {(issue.beforePhotos.length > 0 || issue.afterPhotos.length > 0) && (
            <div className="before-after">
              {issue.beforePhotos.length > 0 && (
                <div>
                  <span className="field-label">整改前</span>
                  <div className="photo-grid">
                    {issue.beforePhotos.map((p) => (
                      <figure key={p.id} className="photo-item">
                        <img src={p.dataUrl} alt={p.caption || '整改前'} />
                        {p.caption && <figcaption>{p.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </div>
              )}
              {issue.afterPhotos.length > 0 && (
                <div>
                  <span className="field-label">整改后</span>
                  <div className="photo-grid">
                    {issue.afterPhotos.map((p) => (
                      <figure key={p.id} className="photo-item">
                        <img src={p.dataUrl} alt={p.caption || '整改后'} />
                        {p.caption && <figcaption>{p.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
