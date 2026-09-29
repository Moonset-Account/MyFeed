"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLES, getRole } from "@/lib/roles";
import {
  buildTaskViews,
  canComplete,
  getBlocked,
  getOverdue,
  progressSummary,
  todayISO,
} from "@/lib/onboarding";
import {
  clearState,
  defaultRoleProgress,
  loadState,
  saveState,
} from "@/lib/storage";
import type { RoleProgress, StoredState, TaskView } from "@/lib/types";
import TaskMap from "@/components/TaskMap";
import TaskDetail from "@/components/TaskDetail";
import OverduePanel from "@/components/OverduePanel";

export default function Home() {
  const [state, setState] = useState<StoredState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // 首次挂载时从 localStorage 恢复进度
  useEffect(() => {
    setState(loadState());
  }, []);

  // 状态变化即持久化
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const today = todayISO();
  const role = state ? getRole(state.activeRoleId) : null;
  const progress = state ? state.roles[role!.id] ?? defaultRoleProgress() : null;

  const views = useMemo(() => {
    if (!role || !progress) return [];
    return buildTaskViews(role, progress.done, progress.startDate, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, progress, today]);

  const summary = useMemo(() => progressSummary(views), [views]);
  const overdue = useMemo(() => getOverdue(views, today), [views, today]);
  const blocked = useMemo(() => getBlocked(views), [views]);
  const selected = views.find((v) => v.id === selectedId) ?? null;

  if (!state || !role || !progress) {
    return <main className="loading">正在加载本地进度…</main>;
  }

  const updateProgress = (updater: (p: RoleProgress) => RoleProgress) => {
    setState((prev) =>
      prev
        ? { ...prev, roles: { ...prev.roles, [role.id]: updater(progress) } }
        : prev,
    );
  };

  const switchRole = (roleId: string) => {
    setSelectedId(null);
    setWarning(null);
    setState((prev) => {
      if (!prev) return prev;
      const roles = prev.roles[roleId]
        ? prev.roles
        : { ...prev.roles, [roleId]: defaultRoleProgress() };
      return { ...prev, activeRoleId: roleId, roles };
    });
  };

  const completeTask = (view: TaskView) => {
    if (!canComplete(view)) {
      const names = view.blockedBy.map((t) => `「${t.title}」`).join("、");
      setWarning(`前置事项 ${names} 尚未完成，暂时无法完成本任务。`);
      return;
    }
    setWarning(null);
    updateProgress((p) => ({
      ...p,
      done: { ...p.done, [view.id]: new Date().toISOString() },
    }));
  };

  const undoTask = (view: TaskView) => {
    setWarning(null);
    updateProgress((p) => {
      const done = { ...p.done };
      delete done[view.id];
      return { ...p, done };
    });
  };

  const resetAll = () => {
    clearState();
    setSelectedId(null);
    setWarning(null);
    setState(loadState());
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>入职任务地图</h1>
          <p className="subtitle">按角色跟进入职事项，全部数据仅保存在本机浏览器。</p>
        </div>
        <button className="btn btn-secondary" onClick={resetAll}>
          重置全部进度
        </button>
      </header>

      <nav className="role-tabs" aria-label="选择角色">
        {ROLES.map((r) => (
          <button
            key={r.id}
            className={r.id === role.id ? "tab tab-active" : "tab"}
            onClick={() => switchRole(r.id)}
          >
            {r.name}
          </button>
        ))}
      </nav>

      <section className="meta-row">
        <p className="role-desc">{role.description}</p>
        <label className="start-date">
          入职日期
          <input
            type="date"
            value={progress.startDate}
            onChange={(e) => {
              if (e.target.value) {
                updateProgress((p) => ({ ...p, startDate: e.target.value }));
              }
            }}
          />
        </label>
        <div className="progress" aria-label="完成进度">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${summary.percent}%` }} />
          </div>
          <span>
            {summary.done}/{summary.total} 完成（{summary.percent}%）
          </span>
        </div>
      </section>

      <OverduePanel overdue={overdue} onSelect={setSelectedId} />

      {blocked.length > 0 && (
        <section className="blocked-panel" aria-label="被阻塞事项">
          <strong>{blocked.length} 项任务等待前置事项完成：</strong>
          {blocked.map((v) => (
            <span key={v.id} className="blocked-chip">
              {v.title}（待：{v.blockedBy.map((t) => t.title).join("、")}）
            </span>
          ))}
        </section>
      )}

      <div className="board">
        <TaskMap views={views} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setWarning(null); }} />
        <TaskDetail view={selected} warning={warning} onComplete={completeTask} onUndo={undoTask} />
      </div>

      <footer className="legend" aria-label="图例">
        <span><i className="dot dot-available" /> 可进行</span>
        <span><i className="dot dot-blocked" /> 待前置</span>
        <span><i className="dot dot-overdue" /> 已逾期</span>
        <span><i className="dot dot-done" /> 已完成</span>
        <span className="legend-note">实线=前置已完成，虚线=前置未完成</span>
      </footer>
    </main>
  );
}
