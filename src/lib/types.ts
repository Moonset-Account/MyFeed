/** 装备类别 */
export const CATEGORIES = ['帐篷', '睡眠', '炉具', '照明', '炊具', '背包', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 一件装备（按数量管理） */
export interface GearItem {
  id: string;
  name: string;
  category: Category;
  /** 拥有总数量 */
  owned: number;
  /** 其中损坏数量 */
  damaged: number;
  /** 是否使用电池 */
  batteryPowered: boolean;
  /** 电池是否已充电（仅电池装备有意义） */
  batteryCharged: boolean;
  notes: string;
}

/** 行程对某件装备的需求 */
export interface Requirement {
  gearId: string;
  quantity: number;
}

export type TripStatus = 'planning' | 'departed' | 'returned';

/** 出发清单中的一项（出发时快照） */
export interface ChecklistEntry {
  gearId: string;
  name: string;
  quantity: number;
  /** 归来时已核对 */
  checked: boolean;
  /** 归来时实际收回数量 */
  returnedQty: number;
  /** 归来时新增损坏数量 */
  newlyDamaged: number;
}

export interface Trip {
  id: string;
  name: string;
  date: string;
  requirements: Requirement[];
  status: TripStatus;
  /** 出发时生成的清单快照 */
  checklist: ChecklistEntry[];
}

/** 可复用的行程模板 */
export interface TripTemplate {
  id: string;
  name: string;
  requirements: Requirement[];
}

/** 维修待办 */
export interface RepairTask {
  id: string;
  /** 关联装备，可为空（手工任务） */
  gearId: string | null;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface AppState {
  gear: GearItem[];
  trips: Trip[];
  templates: TripTemplate[];
  repairs: RepairTask[];
}

/** 某件装备的需求评估结果 */
export interface RequirementAssessment {
  gearId: string;
  name: string;
  category: Category;
  required: number;
  owned: number;
  damaged: number;
  /** 可用数量 = 拥有 - 损坏 */
  available: number;
  /** 缺件数量 */
  shortage: number;
  /** 存在损坏件 */
  hasDamaged: boolean;
  /** 电池装备且未充电 */
  batteryLow: boolean;
}

export type WarningKind = 'shortage' | 'damaged' | 'battery';

export interface TripWarning {
  kind: WarningKind;
  gearId: string;
  gearName: string;
  message: string;
}
