export interface Part {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ToolItem {
  id: string;
  name: string;
  note: string;
}

export interface Checkpoint {
  id: string;
  text: string;
  required: boolean;
}

export interface StepPartUse {
  partId: string;
  quantity: number;
}

export interface AssemblyStep {
  id: string;
  title: string;
  description: string;
  /** 内置插图 key，见 components/Illustration.tsx */
  imageKey: string;
  /** 图片说明（无障碍/打印时展示） */
  imageAlt: string;
  parts: StepPartUse[];
  toolIds: string[];
  checkpoints: Checkpoint[];
}

export interface AssemblyPlan {
  id: string;
  name: string;
  description: string;
  parts: Part[];
  tools: ToolItem[];
  steps: AssemblyStep[];
}

export interface MissingPartSnapshot {
  code: string;
  name: string;
  unit: string;
}

export interface MissingPartReport {
  id: string;
  partId: string;
  /** 报缺时的零件信息；管理员之后删除零件时用于保留可理解的补件记录 */
  partSnapshot?: MissingPartSnapshot;
  quantity: number;
  note: string;
  stepId: string | null;
  /** 报缺时的步骤标题，步骤配置后续调整时仍能说明补件来源 */
  stepTitle?: string | null;
  reportedAt: number;
  /** 为空表示仍待补件；恢复组装时写入时间，记录本身继续保留 */
  resolvedAt?: number | null;
}

export interface ProgressState {
  planId: string;
  completedStepIds: string[];
  /** stepId -> 已勾选检查点 id 列表 */
  checkedCheckpoints: Record<string, string[]>;
  missingParts: MissingPartReport[];
  paused: boolean;
  updatedAt: number;
}
