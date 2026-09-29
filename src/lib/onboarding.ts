// 入职任务地图核心逻辑：与 UI 无关，便于独立测试。

export type TaskCategory = "账号" | "设备" | "培训" | "行政" | "团队";

export interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  /** 负责人（角色或姓名），仅作展示，不接入企业账号 */
  owner: string;
  /** 任务备注 */
  note: string;
  /** 前置任务 id 列表，全部完成后本任务才可开始 */
  dependsOn: string[];
  /** 入职第几天截止（入职当天为第 0 天） */
  dueInDays: number;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  tasks: TaskTemplate[];
}

export type TaskStatus = "done" | "available" | "blocked";

export interface TaskView extends TaskTemplate {
  status: TaskStatus;
  /** 未完成的前置任务标题 */
  blockedBy: string[];
  /** 截止日期（ISO 日期串，yyyy-mm-dd） */
  dueDate: string;
  overdue: boolean;
  completedAt: string | null;
}

export interface OnboardingState {
  roleId: string | null;
  /** 入职日期，yyyy-mm-dd */
  startDate: string;
  /** taskId -> 完成时间 ISO 串 */
  completed: Record<string, string>;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** 校验角色模板：依赖必须指向已存在任务且不成环。返回错误信息列表。 */
export function validateRole(role: Role): string[] {
  const errors: string[] = [];
  const ids = new Set(role.tasks.map((t) => t.id));
  for (const t of role.tasks) {
    for (const dep of t.dependsOn) {
      if (!ids.has(dep)) errors.push(`${role.id}/${t.id} 依赖了不存在的任务 ${dep}`);
      if (dep === t.id) errors.push(`${role.id}/${t.id} 不能依赖自身`);
    }
  }
  // 拓扑排序检测环
  const indeg = new Map<string, number>();
  const edges = new Map<string, string[]>();
  for (const t of role.tasks) {
    indeg.set(t.id, t.dependsOn.filter((d) => ids.has(d)).length);
    for (const d of t.dependsOn) {
      if (!ids.has(d)) continue;
      const list = edges.get(d) ?? [];
      list.push(t.id);
      edges.set(d, list);
    }
  }
  const queue = role.tasks.filter((t) => (indeg.get(t.id) ?? 0) === 0).map((t) => t.id);
  let visited = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    visited++;
    for (const next of edges.get(cur) ?? []) {
      const deg = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  if (visited < role.tasks.length) errors.push(`${role.id} 的任务依赖存在环`);
  return errors;
}

/**
 * 计算某角色下所有任务的展示状态。
 * now 默认为当前时间；逾期判定按“截止日期当天 23:59 之后仍未完成”计算。
 */
export function computeTasks(
  role: Role,
  state: Pick<OnboardingState, "completed" | "startDate">,
  now: Date = new Date()
): TaskView[] {
  const byId = new Map(role.tasks.map((t) => [t.id, t]));
  const today = toDateString(now);
  return role.tasks.map((t) => {
    const completedAt = state.completed[t.id] ?? null;
    const blockedBy = t.dependsOn
      .filter((dep) => !state.completed[dep])
      .map((dep) => byId.get(dep)?.title ?? dep);
    const dueDate = addDays(state.startDate, t.dueInDays);
    const status: TaskStatus = completedAt ? "done" : blockedBy.length > 0 ? "blocked" : "available";
    // 完成时间晚于截止日也算曾逾期；未完成则以今天比较
    const overdue = completedAt
      ? completedAt.slice(0, 10) > dueDate
      : today > dueDate;
    return { ...t, status, blockedBy, dueDate, overdue, completedAt };
  });
}

/** 逾期且未完成的任务，按截止日升序，供“逾期项集中显示”面板使用。 */
export function overdueTasks(tasks: TaskView[]): TaskView[] {
  return tasks
    .filter((t) => t.overdue && t.status !== "done")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** 尝试完成任务：前置未完成时返回提醒文案，否则返回 null 表示允许。 */
export function completionBlocker(task: TaskView): string | null {
  if (task.status !== "blocked") return null;
  return `前置事项未完成：请先完成「${task.blockedBy.join("」「")}」后再办理「${task.title}」。`;
}

/** 按拓扑顺序排序任务，保证前置事项排在前面（同级按截止日）。 */
export function topoSort(role: Role): TaskTemplate[] {
  const byId = new Map(role.tasks.map((t) => [t.id, t]));
  const done = new Set<string>();
  const out: TaskTemplate[] = [];
  let guard = role.tasks.length * role.tasks.length + 10;
  while (out.length < role.tasks.length && guard-- > 0) {
    const ready = role.tasks
      .filter((t) => !done.has(t.id) && t.dependsOn.every((d) => done.has(d) || !byId.has(d)))
      .sort((a, b) => a.dueInDays - b.dueInDays || a.id.localeCompare(b.id));
    for (const t of ready) {
      done.add(t.id);
      out.push(t);
    }
    if (ready.length === 0) break; // 有环时兜底退出
  }
  return out;
}
