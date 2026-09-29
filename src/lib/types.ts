export type GearCategory = '帐篷' | '炉具' | '照明' | '睡眠' | '炊具' | '工具' | '其他';

export type Gear = {
  id: string;
  name: string;
  category: GearCategory;
  total: number;
  damaged: number;
  uncharged: number;
  usesBatteries: boolean;
  notes: string;
};

export type Allocation = {
  gearId: string;
  quantity: number;
  charged: number;
};

export type ReturnItem = {
  gearId: string;
  expected: number;
  returned: number;
  damaged: number;
  uncharged: number;
  checked: boolean;
  preexistingDamaged?: number;
};

export type TripStatus = '准备中' | '出行中' | '已归来';

export type Trip = {
  id: string;
  name: string;
  destination: string;
  date: string;
  status: TripStatus;
  allocations: Allocation[];
  returnItems?: ReturnItem[];
  startedAt?: string;
  returnedAt?: string;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  allocations: Allocation[];
};

export type RepairTodo = {
  id: string;
  gearId: string;
  quantity: number;
  note: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
};

export type AppData = {
  gears: Gear[];
  trips: Trip[];
  templates: Template[];
  repairTodos: RepairTodo[];
};

export type AllocationIssue = {
  gearId: string;
  name: string;
  shortage: number;
  damaged: number;
  uncharged: number;
};

export type ReturnSummary = {
  returned: number;
  missing: number;
  damaged: number;
  uncharged: number;
};
