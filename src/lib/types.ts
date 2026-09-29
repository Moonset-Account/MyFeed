export type TaskCategory = "账号申请" | "设备领取" | "权限开通" | "培训" | "实践任务";

export interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  /** 负责人 */
  owner: string;
  /** 入职第几天前完成（相对入职日期） */
  dueInDays: number;
  /** 前置任务 id，全部完成后本任务才可开始 */
  dependsOn: string[];
  /** 任务备注 */
  notes: string;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  tasks: TaskTemplate[];
}

export interface RoleProgress {
  /** 入职日期 YYYY-MM-DD */
  startDate: string;
  /** taskId -> 完成时间 ISO 字符串 */
  done: Record<string, string>;
}

export interface StoredState {
  version: 1;
  activeRoleId: string;
  roles: Record<string, RoleProgress>;
}

export type TaskStatus = "done" | "blocked" | "overdue" | "available";

export interface TaskView extends TaskTemplate {
  status: TaskStatus;
  /** 截止日期 YYYY-MM-DD */
  dueDate: string;
  /** 未完成的前置任务 */
  blockedBy: TaskTemplate[];
  completedAt?: string;
}
