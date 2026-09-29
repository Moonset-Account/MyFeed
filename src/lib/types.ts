export type CareTaskType = 'water' | 'fertilize' | 'repot';

export type LightLocation =
  | '东向阳台'
  | '南向阳台'
  | '西向阳台'
  | '北向阳台'
  | '半阴处'
  | '室内窗台';

export interface Plant {
  id: string;
  name: string;
  species: string;
  lightLocation: LightLocation;
  waterIntervalDays: number;
  fertilizeIntervalDays?: number;
  repotIntervalDays?: number;
  photoDataUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface CareEvent {
  id: string;
  plantId: string;
  kind: 'care';
  taskType: CareTaskType;
  date: string;
  note?: string;
}

export interface Postponement {
  id: string;
  plantId: string;
  kind: 'postponement';
  taskType: 'water';
  date: string;
  days: number;
  reason: string;
  resolvedByEventId?: string;
}

export type PlantRecord = CareEvent | Postponement;

export interface AppData {
  version: 1;
  plants: Plant[];
  records: PlantRecord[];
}

export type TodoStatus = 'overdue' | 'today' | 'upcoming';

export interface CareTodo {
  id: string;
  plantId: string;
  plantName: string;
  taskType: CareTaskType;
  title: string;
  intervalDays: number;
  lastCareDate?: string;
  dueDate: string;
  daysFromToday: number;
  postponedDays: number;
  status: TodoStatus;
}
