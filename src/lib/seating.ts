import type {
  Conflict,
  Guest,
  SeatLocation,
  SeatingState,
  SeatingStats,
  SeatMap,
  TableSpec,
} from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createTables(
  tableCount: number,
  seatsPerTable: number,
  accessiblePerTable: number,
): TableSpec[] {
  const tables: TableSpec[] = [];
  for (let i = 0; i < tableCount; i += 1) {
    tables.push({
      id: `table-${i + 1}`,
      name: `${i + 1} 号桌`,
      capacity: seatsPerTable,
      accessibleSeats: Math.max(0, Math.min(accessiblePerTable, seatsPerTable)),
    });
  }
  return tables;
}

export function emptySeatMap(tables: TableSpec[]): SeatMap {
  const seats: SeatMap = {};
  for (const t of tables) seats[t.id] = Array<string | null>(t.capacity).fill(null);
  return seats;
}

export function createState(tableCount = 6, seatsPerTable = 10, accessiblePerTable = 1): SeatingState {
  const tables = createTables(tableCount, seatsPerTable, accessiblePerTable);
  return { guests: [], tables, seats: emptySeatMap(tables) };
}

export function isAccessibleSeat(table: TableSpec, seatIndex: number): boolean {
  return seatIndex < table.accessibleSeats;
}

export function seatLocationOf(state: SeatingState, guestId: string): SeatLocation | null {
  for (const t of state.tables) {
    const arr = state.seats[t.id] ?? [];
    const idx = arr.indexOf(guestId);
    if (idx >= 0) return { tableId: t.id, seatIndex: idx };
  }
  return null;
}

export function addGuest(
  state: SeatingState,
  name: string,
  options: { needsAccessible?: boolean } = {},
): SeatingState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const guest: Guest = {
    id: uid(),
    name: trimmed,
    needsAccessible: Boolean(options.needsAccessible),
    together: [],
    avoid: [],
  };
  return { ...state, guests: [...state.guests, guest] };
}

export function removeGuest(state: SeatingState, guestId: string): SeatingState {
  if (!state.guests.some((g) => g.id === guestId)) return state;
  const guests = state.guests
    .filter((g) => g.id !== guestId)
    .map((g) => ({
      ...g,
      together: g.together.filter((id) => id !== guestId),
      avoid: g.avoid.filter((id) => id !== guestId),
    }));
  const seats: SeatMap = {};
  for (const [tid, arr] of Object.entries(state.seats)) {
    seats[tid] = arr.map((id) => (id === guestId ? null : id));
  }
  return { ...state, guests, seats };
}

export function updateGuest(
  state: SeatingState,
  guestId: string,
  patch: { name?: string; needsAccessible?: boolean },
): SeatingState {
  let changed = false;
  const guests = state.guests.map((g) => {
    if (g.id !== guestId) return g;
    const name = patch.name !== undefined ? patch.name.trim() || g.name : g.name;
    const needsAccessible = patch.needsAccessible ?? g.needsAccessible;
    if (name === g.name && needsAccessible === g.needsAccessible) return g;
    changed = true;
    return { ...g, name, needsAccessible };
  });
  return changed ? { ...state, guests } : state;
}

export type RelationKind = 'together' | 'avoid';

function patchRelation(g: Guest, peerId: string, kind: RelationKind, on: boolean): Guest {
  let together = g.together;
  let avoid = g.avoid;
  if (on) {
    // “同行”与“需避开”互斥：建立一种关系时清除两人之间的另一种关系。
    if (kind === 'together') {
      if (!together.includes(peerId)) together = [...together, peerId];
      avoid = avoid.filter((id) => id !== peerId);
    } else {
      if (!avoid.includes(peerId)) avoid = [...avoid, peerId];
      together = together.filter((id) => id !== peerId);
    }
  } else if (kind === 'together') {
    together = together.filter((id) => id !== peerId);
  } else {
    avoid = avoid.filter((id) => id !== peerId);
  }
  if (together === g.together && avoid === g.avoid) return g;
  return { ...g, together, avoid };
}

/** 对称地建立 / 解除两位宾客之间的关系。 */
export function setRelation(
  state: SeatingState,
  aId: string,
  bId: string,
  kind: RelationKind,
  on: boolean,
): SeatingState {
  if (aId === bId) return state;
  if (!state.guests.some((g) => g.id === aId) || !state.guests.some((g) => g.id === bId)) {
    return state;
  }
  let changed = false;
  const guests = state.guests.map((g) => {
    if (g.id !== aId && g.id !== bId) return g;
    const peerId = g.id === aId ? bId : aId;
    const next = patchRelation(g, peerId, kind, on);
    if (next !== g) changed = true;
    return next;
  });
  return changed ? { ...state, guests } : state;
}

export interface AssignResult {
  state: SeatingState;
  ok: boolean;
  reason?: string;
}

/** 把宾客安排到指定座位；已在别处入座时视为移动。座位被占用则失败。 */
export function assignSeat(
  state: SeatingState,
  guestId: string,
  tableId: string,
  seatIndex: number,
): AssignResult {
  if (!state.guests.some((g) => g.id === guestId)) {
    return { state, ok: false, reason: '宾客不存在' };
  }
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return { state, ok: false, reason: '餐桌不存在' };
  const arr = state.seats[tableId];
  if (!arr || seatIndex < 0 || seatIndex >= arr.length) {
    return { state, ok: false, reason: '座位不存在' };
  }
  const occupant = arr[seatIndex];
  if (occupant && occupant !== guestId) {
    return { state, ok: false, reason: '该座位已被占用' };
  }
  const current = seatLocationOf(state, guestId);
  if (current && current.tableId === tableId && current.seatIndex === seatIndex) {
    return { state, ok: true };
  }
  const seats: SeatMap = { ...state.seats };
  if (current) {
    const oldArr = [...seats[current.tableId]];
    oldArr[current.seatIndex] = null;
    seats[current.tableId] = oldArr;
  }
  const newArr = [...(seats[tableId] ?? [])];
  newArr[seatIndex] = guestId;
  seats[tableId] = newArr;
  return { state: { ...state, seats }, ok: true };
}

export function unseatGuest(state: SeatingState, guestId: string): SeatingState {
  const current = seatLocationOf(state, guestId);
  if (!current) return state;
  const arr = [...state.seats[current.tableId]];
  arr[current.seatIndex] = null;
  return { ...state, seats: { ...state.seats, [current.tableId]: arr } };
}

/** 调整桌数 / 每桌座位数 / 无障碍座位数；保留未受影响的入座，被裁掉的宾客回到未安排名单。 */
export function resizeTables(
  state: SeatingState,
  tableCount: number,
  seatsPerTable: number,
  accessiblePerTable: number,
): SeatingState {
  const first = state.tables[0];
  if (
    state.tables.length === tableCount &&
    first &&
    first.capacity === seatsPerTable &&
    first.accessibleSeats === Math.max(0, Math.min(accessiblePerTable, seatsPerTable))
  ) {
    return state;
  }
  const tables = createTables(tableCount, seatsPerTable, accessiblePerTable);
  const seats: SeatMap = {};
  for (const t of tables) {
    const prev = state.seats[t.id] ?? [];
    const next = Array<string | null>(t.capacity).fill(null);
    for (let i = 0; i < Math.min(prev.length, t.capacity); i += 1) next[i] = prev[i];
    seats[t.id] = next;
  }
  return { ...state, tables, seats };
}

export function computeStats(state: SeatingState): SeatingStats {
  const totalSeats = state.tables.reduce((n, t) => n + t.capacity, 0);
  let seatedCount = 0;
  for (const t of state.tables) {
    for (const id of state.seats[t.id] ?? []) if (id) seatedCount += 1;
  }
  const totalGuests = state.guests.length;
  return {
    totalGuests,
    seatedCount,
    unassignedCount: totalGuests - seatedCount,
    totalSeats,
    freeSeats: totalSeats - seatedCount,
    overCapacityBy: Math.max(0, totalGuests - totalSeats),
  };
}

export function computeConflicts(state: SeatingState): Conflict[] {
  const conflicts: Conflict[] = [];
  const guestById = new Map(state.guests.map((g) => [g.id, g]));
  const tableById = new Map(state.tables.map((t) => [t.id, t]));
  const locationByGuest = new Map<string, SeatLocation>();
  for (const t of state.tables) {
    (state.seats[t.id] ?? []).forEach((id, idx) => {
      if (id) locationByGuest.set(id, { tableId: t.id, seatIndex: idx });
    });
  }

  // 1. 超员：宾客总数超过总座位数。
  const stats = computeStats(state);
  if (stats.overCapacityBy > 0) {
    conflicts.push({
      type: 'capacity',
      message: `宾客共 ${stats.totalGuests} 人，总座位 ${stats.totalSeats} 个，超出 ${stats.overCapacityBy} 人无法安排`,
      guestIds: [],
    });
  }

  // 2. 无障碍：需要无障碍座位的宾客坐到了普通座位。
  for (const [gid, loc] of locationByGuest) {
    const g = guestById.get(gid);
    const t = tableById.get(loc.tableId);
    if (g && t && g.needsAccessible && !isAccessibleSeat(t, loc.seatIndex)) {
      conflicts.push({
        type: 'accessible',
        message: `${g.name} 需要无障碍座位，但 ${t.name} ${loc.seatIndex + 1} 号位不是无障碍座位`,
        guestIds: [gid],
        tableId: loc.tableId,
      });
    }
  }

  // 3. 需避开：互相避开的宾客被排到同一桌（任一方向登记即算）。
  const seenPairs = new Set<string>();
  for (const g of state.guests) {
    for (const otherId of g.avoid) {
      const key = [g.id, otherId].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const other = guestById.get(otherId);
      if (!other) continue;
      const la = locationByGuest.get(g.id);
      const lb = locationByGuest.get(otherId);
      if (la && lb && la.tableId === lb.tableId) {
        const t = tableById.get(la.tableId);
        conflicts.push({
          type: 'avoid',
          message: `${g.name} 与 ${other.name} 需避开，却被排到同一桌（${t?.name ?? la.tableId}）`,
          guestIds: [g.id, otherId],
          tableId: la.tableId,
        });
      }
    }
  }

  // 4. 同行：通过并查集把“同行”关系连成组，同组成员被分到不同桌即冲突。
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b));
  };
  for (const g of state.guests) parent.set(g.id, g.id);
  for (const g of state.guests) {
    for (const o of g.together) {
      if (parent.has(o)) union(g.id, o);
    }
  }
  const groups = new Map<string, string[]>();
  for (const g of state.guests) {
    const root = find(g.id);
    const list = groups.get(root) ?? [];
    list.push(g.id);
    groups.set(root, list);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const seated = members.filter((id) => locationByGuest.has(id));
    const tablesUsed = new Set(seated.map((id) => (locationByGuest.get(id) as SeatLocation).tableId));
    if (tablesUsed.size > 1) {
      const names = members.map((id) => guestById.get(id)?.name ?? id).join('、');
      const tableNames = [...tablesUsed].map((tid) => tableById.get(tid)?.name ?? tid).join('、');
      conflicts.push({
        type: 'together',
        message: `同行宾客 ${names} 被分到了不同桌（${tableNames}）`,
        guestIds: seated,
      });
    }
  }

  return conflicts;
}
