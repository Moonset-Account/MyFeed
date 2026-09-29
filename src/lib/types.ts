export type TaskCategory = 'feeding' | 'walking' | 'cleaning' | 'medication';

export interface Pet {
  id: string;
  name: string;
  species: string;
  avatar: string;
  note?: string;
}

export interface Caregiver {
  id: string;
  name: string;
}

export interface CareTask {
  id: string;
  petId: string;
  category: TaskCategory;
  title: string;
  /** 计划日期，格式 YYYY-MM-DD */
  date: string;
  /** 计划时间，格式 HH:mm */
  time: string;
  detail?: string;
}

export interface CompletionRecord {
  id: string;
  taskId: string;
  /** ISO 时间串，确认完成的时刻 */
  completedAt: string;
  /** 执行人姓名 */
  completedBy: string;
  note: string;
  /** 该事项此前已被确认过时为 true */
  duplicate: boolean;
}

export interface BoardState {
  pets: Pet[];
  caregivers: Caregiver[];
  tasks: CareTask[];
  records: CompletionRecord[];
}
