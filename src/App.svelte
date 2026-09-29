<script lang="ts">
  import { canUndo, conflicts, seating, stats, toast, undo } from './lib/store';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import GuestPanel from './components/GuestPanel.svelte';
  import GuestEditor from './components/GuestEditor.svelte';
  import TablesView from './components/TablesView.svelte';
  import ConflictPanel from './components/ConflictPanel.svelte';
  import PrintSheet from './components/PrintSheet.svelte';

  let printScope = 'all';
  let includeUnassigned = true;
  let printedAt = new Date();

  function handlePrint(): void {
    printedAt = new Date();
    requestAnimationFrame(() => window.print());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="screen">
  <header class="topbar">
    <h1>宴席座位安排图</h1>
    <div class="stats">
      <span class="chip">宾客 {$stats.totalGuests}</span>
      <span class="chip ok">已入座 {$stats.seatedCount}</span>
      <span class="chip" class:warn={$stats.unassignedCount > 0}>未安排 {$stats.unassignedCount}</span>
      <span class="chip">空余座位 {$stats.freeSeats}</span>
      {#if $stats.overCapacityBy > 0}
        <span class="chip danger">超员 {$stats.overCapacityBy} 人</span>
      {/if}
    </div>
    <div class="actions">
      <button type="button" on:click={undo} disabled={!$canUndo} title="快捷键 Ctrl/⌘+Z">
        撤销上一步
      </button>
      <label class="print-scope">
        打印范围
        <select bind:value={printScope}>
          <option value="all">全部餐桌</option>
          {#each $seating.tables as t (t.id)}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>
      </label>
      <label class="print-flag">
        <input type="checkbox" bind:checked={includeUnassigned} /> 含未安排名单
      </label>
      <button type="button" class="primary" on:click={handlePrint}>打印席位表</button>
    </div>
  </header>

  <main class="layout">
    <aside class="col side">
      <SettingsPanel />
      <GuestPanel />
    </aside>
    <section class="col center">
      <TablesView />
    </section>
    <aside class="col side">
      <GuestEditor />
      <ConflictPanel />
    </aside>
  </main>

  {#if $toast}
    <div class="toast" role="status">{$toast}</div>
  {/if}
</div>

<PrintSheet
  state={$seating}
  conflicts={$conflicts}
  scope={printScope}
  {includeUnassigned}
  {printedAt}
/>
