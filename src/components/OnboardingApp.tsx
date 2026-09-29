"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OnboardingState,
  TaskView,
  computeTasks,
  completionBlocker,
  overdueTasks,
  topoSort,
  toDateString,
} from "@/lib/onboarding";
import { ROLES, getRole } from "@/lib/roles";
import { clearState, defaultState, loadState, saveState } from "@/lib/store";

const CATEGORY_ORDER = ["账号", "设备", "培训", "行政", "团队"];

export default function OnboardingApp() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [reminder, setReminder] = useState<string | null>(null);

  // 首次渲染后从 localStorage 恢复，避免 SSR 与水合不一致
  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const role = getRole(state?.roleId ?? null);

  const taskViews = useMemo(() => {
    if (!role || !state) return [];
    const views = computeTasks(role, state);
    const order = new Map(topoSort(role).map((t, i) => [t.id, i]));
    return [...views].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [role, state]);

  const overdue = useMemo(() => overdueTasks(taskViews), [taskViews]);

  if (!state) {
    return <main className="page"><p className="loading">加载中…</p></main>;
  }

  const doneCount = taskViews.filter((t) => t.status === "done").length;

  function update(patch: Partial<OnboardingState>) {
    setReminder(null);
    setState((s) => (s ? { ...s, ...patch } : s));
  }

  function toggleTask(task: TaskView) {
    if (!state) return;
    if (task.status === "done") {
      const completed = { ...state.completed };
      delete completed[task.id];
      update({ completed });
      return;
    }
    const blocker = completionBlocker(task);
    if (blocker) {
      setReminder(blocker);
      return;
    }
    setReminder(null);
    setState({ ...state, completed: { ...state.completed, [task.id]: new Date().toISOString() } });
  }

  function resetAll() {
    clearState();
    setReminder(null);
    setState(defaultState());
  }

  if (!role) {
    return (
      <main className="page">
        <header className="hero">
          <h1>入职任务地图</h1>
          <p>选择你的角色，按依赖顺序自助跟进入职事项。所有数据仅保存在本机浏览器中。</p>
        </header>
        <section className="role-grid">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className="role-card"
              onClick={() => update({ roleId: r.id, completed: {}, startDate: toDateString(new Date()) })}
            >
              <span className="role-name">{r.name}</span>
              <span className="role-desc">{r.description}</span>
              <span className="role-meta">{r.tasks.length} 项任务</span>
            </button>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>入职任务地图</h1>
          <p className="subtitle">
            {role.name} · 已完成 {doneCount}/{taskViews.length}
          </p>
        </div>
        <div className="controls">
          <label className="field">
            入职日期
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => e.target.value && update({ startDate: e.target.value })}
            />
          </label>
          <button className="btn ghost" onClick={() => update({ roleId: null })}>切换角色</button>
          <button className="btn ghost danger" onClick={resetAll}>重置进度</button>
        </div>
      </header>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${taskViews.length ? (doneCount / taskViews.length) * 100 : 0}%` }} />
      </div>

      {overdue.length > 0 && (
        <section className="overdue-panel" aria-label="逾期事项">
          <h2>⚠ 逾期事项（{overdue.length}）</h2>
          <ul>
            {overdue.map((t) => (
              <li key={t.id}>
                <strong>{t.title}</strong>
                <span>截止 {t.dueDate} · 负责人：{t.owner}</span>
                {t.status === "blocked" && <em>前置未完成：{t.blockedBy.join("、")}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reminder && (
        <div className="reminder" role="alert">
          <span>{reminder}</span>
          <button className="btn ghost" onClick={() => setReminder(null)}>知道了</button>
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const tasks = taskViews.filter((t) => t.category === cat);
        if (tasks.length === 0) return null;
        return (
          <section key={cat} className="group">
            <h2>{cat}</h2>
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id} className={`task ${t.status} ${t.overdue && t.status !== "done" ? "is-overdue" : ""}`}>
                  <label className="task-main">
                    <input
                      type="checkbox"
                      checked={t.status === "done"}
                      onChange={() => toggleTask(t)}
                      aria-label={`完成 ${t.title}`}
                    />
                    <span className="task-body">
                      <span className="task-title">
                        {t.title}
                        {t.overdue && t.status !== "done" && <span className="badge overdue">逾期</span>}
                        {t.status === "blocked" && <span className="badge blocked">待前置</span>}
                      </span>
                      <span className="task-meta">
                        负责人：{t.owner} · 截止 {t.dueDate}
                        {t.completedAt && ` · 完成于 ${t.completedAt.slice(0, 10)}`}
                      </span>
                      <span className="task-note">{t.note}</span>
                      {t.dependsOn.length > 0 && (
                        <span className="task-deps">
                          前置：
                          {t.dependsOn.map((dep) => {
                            const depView = taskViews.find((v) => v.id === dep);
                            const depDone = depView?.status === "done";
                            return (
                              <span key={dep} className={`dep ${depDone ? "done" : "pending"}`}>
                                {depDone ? "✓ " : "○ "}
                                {depView?.title ?? dep}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <footer className="foot">数据仅保存在本机浏览器 localStorage，不接入企业账号。</footer>
    </main>
  );
}
