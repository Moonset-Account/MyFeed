export interface Guest {
  id: string;
  name: string;
  /** 需要无障碍座位 */
  needsAccessible: boolean;
  /** 希望同席的宾客 id 列表 */
  together: string[];
  /** 需要避开的宾客 id 列表 */
  avoid: string[];
}

export interface Settings {
  tableCount: number;
  seatsPerTable: number;
  /** 每桌无障碍座位数（每桌前 N 个座位视为无障碍座位） */
  accessiblePerTable: number;
}

export interface SeatRef {
  table: number; // 从 0 开始
  seat: number; // 从 0 开始
}

export interface AppState {
  settings: Settings;
  guests: Guest[];
  /** guestId -> 座位 */
  assignments: Record<string, SeatRef>;
}
