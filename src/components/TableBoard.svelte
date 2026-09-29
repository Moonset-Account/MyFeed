<script lang="ts">
  import { draggedGuestId } from '../lib/dnd';
  import { conflictsByTable, guestById, type Conflict } from '../lib/rules';
  import { assign, appState, unassign } from '../lib/store';

  export let conflictList: Conflict[] = [];

  $: settings = $appState.settings;
  $: tables = Array.from({ length: settings.tableCount }, (_, i) => i);
  $: byTable = conflictsByTable(conflictList);

  /** 桌 -> 座位号 -> 宾客 id */
  $: seatMap = buildSeatMap($appState.assignments);
  function buildSeatMap(assignments: typeof $appState.assignments) {
    const map = new Map<string, string>();
    for (const [id, s] of Object.entries(assignments)) {
      map.set(`${s.table}:${s.seat}`, id);
    }
    return map;
  }

  /** 超出当前桌数/座位数范围的宾客（超员） */
  $: overflowByTable = buildOverflow($appState.assignments, settings.tableCount, settings.seatsPerTable);
  function buildOverflow(
    assignments: typeof $appState.assignments,
    tableCount: number,
    seatsPerTable: number,
  ) {
    const map = new Map<number, string[]>();
    for (const [id, s] of Object.entries(assignments)) {
      if (s.table >= tableCount || s.seat >= seatsPerTable) {
        const list = map.get(s.table) ?? [];
        list.push(id);
        map.set(s.table, list);
      }
    }
    return map;
  }

  function occupant(table: number, seat: number): string | undefined {
    return seatMap.get(`${table}:${seat}`);
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    draggedGuestId.set(id);
  }

  function onDropSeat(e: DragEvent, table: number, seat: number) {
    e.preventDefault();
    const id = $draggedGuestId ?? e.dataTransfer?.getData('text/plain');
    if (id) assign(id, { table, seat });
    draggedGuestId.set(null);
  }
</script>

<section class="board">
  {#each tables as t (t)}
    <div class="table-card" class:has-conflict={(byTable.get(t) ?? []).length > 0}>
      <header>
        <h2>{t + 1} 桌</h2>
        <span class="count">
          {Array.from({ length: settings.seatsPerTable }).filter((_, s) => occupant(t, s)).length}
          / {settings.seatsPerTable} 座
        </span>
      </header>

      <div class="seats" style={`grid-template-columns: repeat(${Math.min(settings.seatsPerTable, 5)}, 1fr);`}>
        {#each Array.from({ length: settings.seatsPerTable }) as _, s}
          {@const gid = occupant(t, s)}
          {@const g = gid ? guestById($appState, gid) : undefined}
          <div
            class="seat"
            class:accessible={s < settings.accessiblePerTable}
            class:occupied={!!g}
            class:drop-active={$draggedGuestId !== null}
            on:dragover|preventDefault
            on:drop={(e) => onDropSeat(e, t, s)}
            role="button"
            tabindex="-1"
            aria-label={`${t + 1} 桌 ${s + 1} 号座位`}
          >
            <span class="seat-no">
              {s + 1}{#if s < settings.accessiblePerTable} ♿{/if}
            </span>
            {#if g && gid}
              <span
                class="chip"
                draggable="true"
                role="button"
                tabindex="0"
                on:dragstart={(e) => onDragStart(e, gid)}
                on:dragend={() => draggedGuestId.set(null)}
                on:dblclick={() => unassign(gid)}
                title="拖动换座，双击取消安排"
              >
                {#if g.needsAccessible}<span class="wheelchair">♿</span>{/if}
                {g.name}
              </span>
            {:else}
              <span class="empty">空位</span>
            {/if}
          </div>
        {/each}
      </div>

      {#if overflowByTable.get(t)}
        <div class="overflow">
          <strong>超员：</strong>
          {#each overflowByTable.get(t) ?? [] as gid (gid)}
            {@const g = guestById($appState, gid)}
            {#if g}
              <span
                class="chip chip-danger"
                draggable="true"
                role="button"
                tabindex="0"
                on:dragstart={(e) => onDragStart(e, gid)}
                on:dragend={() => draggedGuestId.set(null)}
              >
                {g.name}
              </span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if (byTable.get(t) ?? []).length > 0}
        <ul class="table-conflicts">
          {#each byTable.get(t) ?? [] as c}
            <li>{c.message}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <p class="hint">请先在左侧设置桌数。</p>
  {/each}
</section>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .table-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px;
  }
  .table-card.has-conflict { border-color: var(--danger); }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  h2 { font-size: 16px; margin: 0 0 10px; }
  .count { font-size: 13px; color: var(--muted); }
  .seats { display: grid; gap: 8px; }
  .seat {
    border: 1px dashed var(--line);
    border-radius: 8px;
    padding: 6px;
    min-height: 58px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
  .seat.accessible { background: #eef5ff; }
  .seat.occupied { border-style: solid; }
  .seat.drop-active { border-color: var(--accent); }
  .seat-no { font-size: 11px; color: var(--muted); }
  .empty { font-size: 12px; color: var(--muted); }
  .chip { font-size: 13px; padding: 2px 8px; }
  .chip-danger { background: var(--danger-soft); color: var(--danger); }
  .overflow {
    margin-top: 10px;
    padding: 8px;
    background: var(--danger-soft);
    border-radius: 8px;
    font-size: 13px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    color: var(--danger);
  }
  .table-conflicts {
    margin: 10px 0 0;
    padding-left: 18px;
    color: var(--danger);
    font-size: 13px;
  }
  .hint { color: var(--muted); }
</style>
