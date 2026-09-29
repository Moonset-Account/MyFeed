<script lang="ts">
  import type { Conflict, SeatingState, TableSpec } from '../lib/types';

  export let state: SeatingState;
  export let conflicts: Conflict[];
  export let scope: string;
  export let includeUnassigned: boolean;
  export let printedAt: Date;

  $: tables = scope === 'all' ? state.tables : state.tables.filter((t) => t.id === scope);
  $: guestById = new Map(state.guests.map((g) => [g.id, g]));
  $: seatedIds = new Set(
    state.tables.flatMap((t) => (state.seats[t.id] ?? []).filter((x): x is string => Boolean(x))),
  );
  $: unassigned = state.guests.filter((g) => !seatedIds.has(g.id));
  $: globalConflicts = conflicts.filter((c) => !c.tableId);

  function tableConflicts(tableId: string): Conflict[] {
    return conflicts.filter((c) => c.tableId === tableId);
  }

  function fmt(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function seatedCount(table: TableSpec): number {
    return (state.seats[table.id] ?? []).filter(Boolean).length;
  }
</script>

<div class="print-sheet">
  <h1>宴席席位表</h1>
  <p class="meta">
    生成时间：{fmt(printedAt)} ｜ 宾客 {state.guests.length} 人 ｜ 餐桌 {state.tables.length} 张
  </p>

  {#if globalConflicts.length > 0}
    <section class="print-block">
      <h2>整体提示</h2>
      <ul class="warn-list">
        {#each globalConflicts as c, i (i)}
          <li>{c.message}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each tables as table (table.id)}
    {@const seats = state.seats[table.id] ?? []}
    <section class="print-block print-table">
      <h2>{table.name}（已坐 {seatedCount(table)}/{table.capacity}）</h2>
      <table class="seat-table">
        <thead>
          <tr><th>座位</th><th>宾客</th><th>备注</th></tr>
        </thead>
        <tbody>
          {#each seats as gid, i (i)}
            {@const g = gid ? guestById.get(gid) : undefined}
            <tr>
              <td>{i + 1}{i < table.accessibleSeats ? ' ♿' : ''}</td>
              <td>{g ? g.name : '（空位）'}</td>
              <td>{g?.needsAccessible ? '需无障碍座位' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if tableConflicts(table.id).length > 0}
        <ul class="warn-list">
          {#each tableConflicts(table.id) as c, i (i)}
            <li>注意：{c.message}</li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}

  {#if includeUnassigned}
    <section class="print-block">
      <h2>未安排名单（{unassigned.length} 人）</h2>
      {#if unassigned.length === 0}
        <p>全部宾客均已安排座位。</p>
      {:else}
        <p>{unassigned.map((g) => g.name + (g.needsAccessible ? '（需无障碍座位）' : '')).join('、')}</p>
      {/if}
    </section>
  {/if}
</div>
