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

export interface MissingPartReport {
  id: string;
  partId: string;
  /** 登记时的零件信息快照：即使管理员之后从方案中删除该零件，补件记录仍可读 */
  partCode?: string;
  partName?: string;
  partUnit?: string;
  quantity: number;
  note: string;
  stepId: string | null;
  reportedAt: number;
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
