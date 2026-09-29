/** 零件 */
export interface Part {
  id: string;
  name: string;
  quantity: number;
  spec?: string;
}

/** 工具 */
export interface Tool {
  id: string;
  name: string;
  note?: string;
}

/** 步骤检查点：required 为 true 时未勾选不得完成该步骤 */
export interface Checkpoint {
  text: string;
  required: boolean;
}

/** 组装步骤 */
export interface AssemblyStep {
  id: string;
  title: string;
  description: string;
  /** 插图 key，由 Illustration 组件渲染 */
  illustration: string;
  partIds: string[];
  toolIds: string[];
  checkpoint: Checkpoint | null;
}

/** 一套组装方案（管理员配置） */
export interface AssemblyPlan {
  id: string;
  name: string;
  description: string;
  parts: Part[];
  tools: Tool[];
  steps: AssemblyStep[];
}

/** 缺件登记项 */
export interface MissingPartEntry {
  partId: string;
  quantity: number;
  note?: string;
}

export type AssemblyStatus = 'assembling' | 'paused-missing-parts' | 'finished';

/** 用户进度（持久化到 localStorage） */
export interface ProgressState {
  version: 1;
  planId: string;
  completedStepIds: string[];
  /** 已勾选检查点的步骤 id */
  checkedCheckpoints: string[];
  status: AssemblyStatus;
  missingParts: MissingPartEntry[];
  updatedAt: string;
}
