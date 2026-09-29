import type { RoleTemplate, TaskTemplate, TaskView } from "./types";

/** 日期加天数，输入输出均为 YYYY-MM-DD（按本地时区解释） */
export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toISODate(date);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * 汇总角色下每个任务的展示状态：
 * - done：已完成
 * - blocked：存在未完成的前置任务
 * - overdue：未完成且截止日期早于今天
 * - available：可以开始
 */
export function buildTaskViews(
  role: RoleTemplate,
  done: Record<string, string>,
  startDate: string,
  today: string,
): TaskView[] {
  return role.tasks.map((task) => {
    const completedAt = done[task.id];
    const blockedBy = task.dependsOn
      .map((depId) => role.tasks.find((t) => t.id === depId))
      .filter((t): t is TaskTemplate => Boolean(t))
      .filter((t) => !done[t.id]);
    const dueDate = addDays(startDate, task.dueInDays);
    let status: TaskView["status"];
    if (completedAt) {
      status = "done";
    } else if (blockedBy.length > 0) {
      status = "blocked";
    } else if (dueDate < today) {
      status = "overdue";
    } else {
      status = "available";
    }
    return { ...task, status, dueDate, blockedBy, completedAt };
  });
}

/** 逾期项：未完成且已过截止日期（被前置阻塞但已逾期的任务也计入） */
export function getOverdue(views: TaskView[], today: string): TaskView[] {
  return views.filter((v) => v.status !== "done" && v.dueDate < today);
}

/** 被前置任务阻塞、暂不可开始的任务 */
export function getBlocked(views: TaskView[]): TaskView[] {
  return views.filter((v) => v.status === "blocked");
}

/** 是否允许标记完成：前置任务全部完成才允许 */
export function canComplete(view: TaskView): boolean {
  return view.status !== "blocked";
}

/**
 * 计算每个任务在依赖图中的层数（拓扑深度），用于地图分列布局。
 * 无依赖的任务在第 0 列，其余任务在 max(前置层数)+1 列。带环保护。
 */
export function computeLayers(tasks: TaskTemplate[]): Map<string, number> {
  const layers = new Map<string, number>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visiting = new Set<string>();

  const depth = (task: TaskTemplate): number => {
    const cached = layers.get(task.id);
    if (cached !== undefined) return cached;
    if (visiting.has(task.id)) return 0; // 环保护，示例数据不应出现
    visiting.add(task.id);
    let layer = 0;
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (dep) layer = Math.max(layer, depth(dep) + 1);
    }
    visiting.delete(task.id);
    layers.set(task.id, layer);
    return layer;
  };

  tasks.forEach(depth);
  return layers;
}

export interface ProgressSummary {
  done: number;
  total: number;
  percent: number;
}

export function progressSummary(views: TaskView[]): ProgressSummary {
  const done = views.filter((v) => v.status === "done").length;
  const total = views.length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
