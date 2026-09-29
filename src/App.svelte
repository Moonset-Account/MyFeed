<script lang="ts">
  import { conflicts, unseated } from './lib/rules';
  import { history, appState, undo } from './lib/store';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import GuestPanel from './components/GuestPanel.svelte';
  import TableBoard from './components/TableBoard.svelte';
  import PrintSheet from './components/PrintSheet.svelte';

  $: conflictList = conflicts($appState);
  $: unseatedList = unseated($appState);
  $: canUndo = $history.length > 0;

  function print() {
    window.print();
  }
</script>

<div id="app-root">
  <header>
    <h1>宴席座位安排图</h1>
    <div class="actions">
      <span class="badge" class:badge-danger={conflictList.length > 0}>
        {conflictList.length > 0 ? `冲突 ${conflictList.length} 项` : '暂无冲突'}
      </span>
      <span class="badge" class:badge-warn={unseatedList.length > 0}>
        未安排 {unseatedList.length} 人
      </span>
      <button on:click={undo} disabled={!canUndo}>撤销上一步</button>
      <button class="primary" on:click={print}>打印席位表</button>
    </div>
  </header>

  {#if conflictList.length > 0}
    <section class="conflict-bar" aria-live="polite">
      <strong>需要处理：</strong>
      <ul>
        {#each conflictList as c}
          <li>{c.message}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <main>
    <aside>
      <SettingsPanel />
      <GuestPanel />
    </aside>
    <TableBoard conflictList={conflictList} />
  </main>
</div>

<PrintSheet appState={$appState} conflictList={conflictList} unseatedList={unseatedList} />

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 24px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
  }
  h1 { font-size: 20px; margin: 0; }
  .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .badge {
    padding: 4px 12px;
    border-radius: 999px;
    background: #e7f0e9;
    color: var(--ok);
    font-size: 13px;
  }
  .badge.badge-danger { background: var(--danger-soft); color: var(--danger); }
  .badge.badge-warn { background: #fdf3e0; color: #8a6d1a; }

  .conflict-bar {
    margin: 12px 24px 0;
    padding: 10px 16px;
    background: var(--danger-soft);
    border: 1px solid var(--danger);
    border-radius: 8px;
    font-size: 14px;
  }
  .conflict-bar ul { margin: 6px 0 0; padding-left: 20px; }

  main {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 16px;
    padding: 16px 24px 32px;
    align-items: start;
  }
  aside { display: flex; flex-direction: column; gap: 16px; }

  @media (max-width: 900px) {
    main { grid-template-columns: 1fr; }
  }
</style>
