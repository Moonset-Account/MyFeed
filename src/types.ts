export interface Member {
  id: string;
  name: string;
  /** 行李箱预设限重，单位千克 */
  luggageLimitKg: number;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  /** 单件重量，单位克 */
  weightGrams: number;
  /** 共享物品全员共用，但只能指定一名负责人 */
  shared: boolean;
  /** 携带人 / 负责人，null 表示未分配 */
  assigneeId: string | null;
  packed: boolean;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  days: number;
  members: Member[];
  items: Item[];
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  trips: Trip[];
}
