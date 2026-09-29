/** 宾客：姓名、无障碍需求，以及同行 / 需避开关系（对称存储双方 id）。 */
export interface Guest {
  id: string;
  name: string;
  needsAccessible: boolean;
  together: string[];
  avoid: string[];
}

/** 餐桌：每桌 capacity 个座位，其中前 accessibleSeats 个为无障碍座位。 */
export interface TableSpec {
  id: string;
  name: string;
  capacity: number;
  accessibleSeats: number;
}

/** tableId -> 座位数组，元素为 guestId 或 null（空位）。 */
export type SeatMap = Record<string, (string | null)[]>;

export interface SeatingState {
  guests: Guest[];
  tables: TableSpec[];
  seats: SeatMap;
}

export interface SeatLocation {
  tableId: string;
  seatIndex: number;
}

export type ConflictType = 'capacity' | 'avoid' | 'together' | 'accessible';

export interface Conflict {
  type: ConflictType;
  message: string;
  guestIds: string[];
  tableId?: string;
}

export interface SeatingStats {
  totalGuests: number;
  seatedCount: number;
  unassignedCount: number;
  totalSeats: number;
  freeSeats: number;
  overCapacityBy: number;
}
