<script lang="ts">
  import { guestById, type Conflict } from '../lib/rules';
  import type { AppState, Guest } from '../lib/types';

  export let appState: AppState;
  export let conflictList: Conflict[] = [];
  export let unseatedList: Guest[] = [];

  $: settings = appState.settings;
  $: tables = Array.from({ length: settings.tableCount }, (_, i) => i);

  function occupant(table: number, seat: number): Guest | undefined {
    for (const [id, s] of Object.entries(appState.assignments)) {
      if (s.table === table && s.seat === seat) return guestById(appState, id);
    }
    return undefined;
  }

  $: overflow = Object.entries(appState.assignments)
    .filter(([, s]) => s.table >= settings.tableCount || s.seat >= settings.seatsPerTable)
    .map(([id, s]) => ({ guest: guestById(appState, id), seat: s }))
    .filter((x) => x.guest);

  const today = new Date().toLocaleDateString('zh-CN');
</script>

<div id="print-sheet">
  <h1>宴席席位表</h1>
  <p class="meta">
    共 {settings.tableCount} 桌，每桌 {settings.seatsPerTable} 座（其中无障碍座位
    {settings.accessiblePerTable} 个） · 打印日期 {today}
  </p>

  {#each tables as t}
    <section class="p-table">
      <h2>第 {t + 1} 桌</h2>
      <table>
        <thead>
          <tr><th>座位</th><th>宾客</th><th>备注</th></tr>
        </thead>
        <tbody>
          {#each Array.from({ length: settings.seatsPerTable }) as _, s}
            {@const g = occupant(t, s)}
            <tr>
              <td>{s + 1}{s < settings.accessiblePerTable ? '（无障碍）' : ''}</td>
              <td>{g ? g.name : '—'}</td>
              <td>{g?.needsAccessible ? '需无障碍座位' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}

  {#if overflow.length > 0}
    <section class="p-table">
      <h2>超员宾客（超出当前桌位范围）</h2>
      <ul>
        {#each overflow as item}
          <li>
            {item.guest?.name}（原安排在 {item.seat.table + 1} 桌 {item.seat.seat + 1} 号）
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="p-table">
    <h2>未安排名单（{unseatedList.length} 人）</h2>
    {#if unseatedList.length === 0}
      <p>全部宾客均已入座。</p>
    {:else}
      <p>{unseatedList.map((g) => g.name).join('、')}</p>
    {/if}
  </section>

  {#if conflictList.length > 0}
    <section class="p-table">
      <h2>待处理冲突（{conflictList.length} 项）</h2>
      <ul>
        {#each conflictList as c}
          <li>{c.message}</li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  #print-sheet {
    display: none;
    padding: 24px;
    color: #000;
  }
  @media print {
    #print-sheet { display: block; }
    .p-table { break-inside: avoid; }
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #444; margin: 0 0 16px; font-size: 13px; }
  .p-table { margin-bottom: 18px; }
  h2 { font-size: 16px; margin: 0 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 4px 10px; font-size: 13px; text-align: left; }
  ul { margin: 4px 0; padding-left: 20px; font-size: 13px; }
  p { font-size: 13px; }
</style>
