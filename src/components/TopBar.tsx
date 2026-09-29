import { useRef, useState } from 'react';
import type { ClubState } from '../types';
import type { Action } from '../lib/store';
import { unreadReminders } from '../lib/reading';

interface Props {
  state: ClubState;
  dispatch: React.Dispatch<Action>;
  organizer: boolean;
  onToggleOrganizer: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function TopBar({ state, dispatch, organizer, onToggleOrganizer, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const reminderCount = unreadReminders(state, state.currentMemberId).length;

  function submitMember(e: React.FormEvent) {
    e.preventDefault();
    const name = memberName.trim();
    if (!name) return;
    const member = { id: crypto.randomUUID(), name };
    dispatch({ type: 'addMember', member });
    dispatch({ type: 'setCurrentMember', memberId: member.id });
    setMemberName('');
    setAddingMember(false);
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon">📚</span>
        <div>
          <h1>共读进度墙</h1>
          <p>读书会 · 进度 / 摘录 / 讨论</p>
        </div>
      </div>

      <div className="topbar-actions">
        {reminderCount > 0 && (
          <span className="reminder-badge" title="你有未读章节临近讨论日期">
            ⏰ {reminderCount} 章待读
          </span>
        )}

        <label className="member-picker">
          当前成员
          <select
            value={state.currentMemberId}
            onChange={(e) => dispatch({ type: 'setCurrentMember', memberId: e.target.value })}
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        {addingMember ? (
          <form className="inline-form" onSubmit={submitMember}>
            <input
              autoFocus
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="成员昵称"
            />
            <button type="submit">加入</button>
            <button type="button" className="ghost" onClick={() => setAddingMember(false)}>
              取消
            </button>
          </form>
        ) : (
          <button className="ghost" onClick={() => setAddingMember(true)}>
            + 成员
          </button>
        )}

        <label className="organizer-toggle">
          <input type="checkbox" checked={organizer} onChange={onToggleOrganizer} />
          组织者
        </label>

        <button onClick={onExport}>导出 JSON 备份</button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          导入备份
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
