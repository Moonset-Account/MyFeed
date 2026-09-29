import type { AppState, Guest, SeatRef } from './types';

export type ConflictType = 'overcapacity' | 'avoid' | 'together' | 'accessible';

export interface Conflict {
  type: ConflictType;
  table: number | null; // 从 0 开始；与桌无关时为 null
  guestIds: string[];
  message: string;
}

export function guestById(appState: AppState, id: string): Guest | undefined {
  return appState.guests.find((g) => g.id === id);
}

export function seatLabel(seat: SeatRef): string {
  return `${seat.table + 1} 桌 ${seat.seat + 1} 号`;
}

/** 某桌已入座的宾客 id（含超员座位） */
export function tableGuests(appState: AppState, table: number): string[] {
  return Object.entries(appState.assignments)
    .filter(([, s]) => s.table === table)
    .sort((a, b) => a[1].seat - b[1].seat)
    .map(([id]) => id);
}

/** 未安排座位的宾客 */
export function unseated(appState: AppState): Guest[] {
  return appState.guests.filter((g) => !appState.assignments[g.id]);
}

/** 某座位是否无障碍座位 */
export function isAccessibleSeat(appState: AppState, seat: SeatRef): boolean {
  return seat.seat < appState.settings.accessiblePerTable;
}

function hasRelation(a: Guest, b: Guest, key: 'together' | 'avoid'): boolean {
  return a[key].includes(b.id) || b[key].includes(a.id);
}

/** 计算当前全部冲突：超员、需避开同席、同行未同席、无障碍需求未满足 */
export function conflicts(appState: AppState): Conflict[] {
  const result: Conflict[] = [];
  const { tableCount, seatsPerTable } = appState.settings;
  const name = (id: string) => guestById(appState, id)?.name ?? '未知宾客';

  // 1. 超员：座位落在当前桌数/座位数范围之外
  const overflowByTable = new Map<number, string[]>();
  for (const [id, s] of Object.entries(appState.assignments)) {
    if (s.table >= tableCount || s.seat >= seatsPerTable) {
      const list = overflowByTable.get(s.table) ?? [];
      list.push(id);
      overflowByTable.set(s.table, list);
    }
  }
  for (const [table, ids] of overflowByTable) {
    result.push({
      type: 'overcapacity',
      table,
      guestIds: ids,
      message: `${table + 1} 桌超员 ${ids.length} 人：${ids.map(name).join('、')}`,
    });
  }

  // 2. 同桌两两检查“需避开”
  for (let t = 0; t < tableCount; t++) {
    const ids = tableGuests(appState, t).filter((id) => {
      const s = appState.assignments[id];
      return s && s.seat < seatsPerTable;
    });
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = guestById(appState, ids[i]);
        const b = guestById(appState, ids[j]);
        if (a && b && hasRelation(a, b, 'avoid')) {
          result.push({
            type: 'avoid',
            table: t,
            guestIds: [a.id, b.id],
            message: `${t + 1} 桌：${a.name} 与 ${b.name} 需避开却同席`,
          });
        }
      }
    }
  }

  // 3. 同行关系：同席要求未满足（桌不同或仅一方未安排）
  const seen = new Set<string>();
  for (const g of appState.guests) {
    for (const otherId of g.together) {
      const key = [g.id, otherId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const other = guestById(appState, otherId);
      if (!other) continue;
      const sa = appState.assignments[g.id];
      const sb = appState.assignments[otherId];
      if (!sa && !sb) continue; // 都未安排，不算冲突
      if (!sa || !sb || sa.table !== sb.table) {
        result.push({
          type: 'together',
          table: null,
          guestIds: [g.id, otherId],
          message: `${g.name} 与 ${other.name} 需同行，但未安排在同一桌`,
        });
      }
    }
  }

  // 4. 无障碍需求：需要无障碍座位但未坐在无障碍座位
  for (const g of appState.guests) {
    if (!g.needsAccessible) continue;
    const s = appState.assignments[g.id];
    if (s && !isAccessibleSeat(appState, s)) {
      result.push({
        type: 'accessible',
        table: s.table,
        guestIds: [g.id],
        message: `${g.name} 需要无障碍座位，当前坐在 ${seatLabel(s)}`,
      });
    }
  }

  return result;
}

/** 每桌冲突（供桌卡角标使用） */
export function conflictsByTable(all: Conflict[]): Map<number, Conflict[]> {
  const map = new Map<number, Conflict[]>();
  for (const c of all) {
    if (c.table === null) continue;
    const list = map.get(c.table) ?? [];
    list.push(c);
    map.set(c.table, list);
  }
  return map;
}
