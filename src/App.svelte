<script lang="ts">
  import { board } from './lib/state.svelte';
  import {
    buildCompletion,
    toDateKey,
    incompleteInstances,
    instancesForDate,
    recordsForInstance,
    recordsToCSV,
    recordsToJSON,
    shiftDateKey,
    sortRecordsDesc
  } from './lib/careLogic';
  import { SAMPLE_CAREGIVERS, SAMPLE_PETS, SAMPLE_TEMPLATES } from './lib/sampleData';
  import type { TaskInstance } from './lib/types';
  import TaskCard from './lib/components/TaskCard.svelte';
  import CompleteDialog from './lib/components/CompleteDialog.svelte';

  let selectedDate = $state(toDateKey(new Date()));
  let onlyIncomplete = $state(false);
  let pending = $state<TaskInstance | null>(null);

  const todayKey = toDateKey(new Date());

  const petsById = new Map(SAMPLE_PETS.map((p) => [p.id, p]));

  const allInstances = $derived(instancesForDate(SAMPLE_TEMPLATES, selectedDate));
  const visibleInstances = $derived(
    onlyIncomplete ? incompleteInstances(allInstances, board.records) : allInstances
  );
  const remaining = $derived(incompleteInstances(allInstances, board.records).length);
  const logRecords = $derived(sortRecordsDesc(board.records));

  function petNameOf(instance: TaskInstance): string {
    return petsById.get(instance.petId)?.name ?? instance.petId;
  }

  function confirmCompletion(completedBy: string, note: string) {
    if (!pending) return;
    const record = buildCompletion(pending, petNameOf(pending), completedBy, note, board.records);
    board.add(record);
    pending = null;
  }

  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    download(`照护交接记录-${todayKey}.csv`, recordsToCSV(board.records), 'text/csv;charset=utf-8');
  }

  function exportJSON() {
    download(
      `照护交接记录-${todayKey}.json`,
      recordsToJSON(board.records),
      'application/json;charset=utf-8'
    );
  }

  function fmtLogTime(iso: string): string {
    const d = new Date(iso);
    return `${toDateKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
</script>

<main>
  <header>
    <h1>🐾 宠物照护交接板</h1>
    <p class="subtitle">多人协作照看，完成即记录，交接有依据（示例数据均为虚构宠物）</p>
  </header>

  <section class="pets" aria-label="在册宠物">
    {#each SAMPLE_PETS as pet (pet.id)}
      <div class="pet-chip" title={pet.note}>
        <span class="emoji">{pet.emoji}</span>
        <div>
          <strong>{pet.name}</strong>
          <small>{pet.species}</small>
        </div>
      </div>
    {/each}
  </section>

  <section class="toolbar">
    <div class="date-nav">
      <button onclick={() => (selectedDate = shiftDateKey(selectedDate, -1))} aria-label="前一天">◀</button>
      <input type="date" bind:value={selectedDate} />
      <button onclick={() => (selectedDate = shiftDateKey(selectedDate, 1))} aria-label="后一天">▶</button>
      {#if selectedDate !== todayKey}
        <button class="today" onclick={() => (selectedDate = todayKey)}>回到今天</button>
      {/if}
    </div>
    <div class="status">
      <span class:alert={remaining > 0}>
        {selectedDate} 未完成 {remaining} / 共 {allInstances.length} 项
      </span>
      <label class="filter">
        <input type="checkbox" bind:checked={onlyIncomplete} />
        只看未完成
      </label>
    </div>
  </section>

  <section class="tasks" aria-label="当日事项">
    {#if visibleInstances.length === 0}
      <p class="empty">🎉 该日期没有{onlyIncomplete ? '未完成' : ''}事项。</p>
    {:else}
      {#each visibleInstances as inst (inst.instanceId)}
        <TaskCard
          instance={inst}
          pet={petsById.get(inst.petId)}
          records={recordsForInstance(board.records, inst.instanceId)}
          oncomplete={(i) => (pending = i)}
        />
      {/each}
    {/if}
  </section>

  <section class="log" aria-label="交接记录">
    <div class="log-head">
      <h2>交接记录（{logRecords.length} 条）</h2>
      <div class="log-actions">
        <button onclick={exportCSV}>导出 CSV</button>
        <button onclick={exportJSON}>导出 JSON</button>
        <button class="danger" onclick={() => board.reset()}>重置示例数据</button>
      </div>
    </div>
    {#if logRecords.length === 0}
      <p class="empty">还没有交接记录。</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>完成时间</th>
            <th>事项</th>
            <th>宠物</th>
            <th>执行人</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {#each logRecords.slice(0, 30) as r (r.id)}
            <tr class:dup={r.duplicate}>
              <td class="t-time">{fmtLogTime(r.completedAt)}</td>
              <td>
                {r.taskTitle}
                {#if r.duplicate}<span class="dup-tag">重复确认</span>{/if}
              </td>
              <td>{r.petName}</td>
              <td>{r.completedBy}</td>
              <td class="t-note">{r.note || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if logRecords.length > 30}
        <p class="more">仅显示最近 30 条，完整记录请使用导出。</p>
      {/if}
    {/if}
  </section>
</main>

{#if pending}
  <CompleteDialog
    instance={pending}
    petName={petNameOf(pending)}
    existing={recordsForInstance(board.records, pending.instanceId)}
    caregivers={SAMPLE_CAREGIVERS}
    onconfirm={confirmCompletion}
    oncancel={() => (pending = null)}
  />
{/if}

<style>
  :global(body) {
    margin: 0;
    background: #f4f1ea;
    color: #33302a;
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  }
  main {
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 16px 64px;
    display: grid;
    gap: 20px;
  }
  header h1 { margin: 0 0 4px; font-size: 26px; }
  .subtitle { margin: 0; color: #7a7264; font-size: 14px; }

  .pets {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .pet-chip {
    display: flex;
    gap: 8px;
    align-items: center;
    background: #fff;
    border: 1px solid #e3e0da;
    border-radius: 10px;
    padding: 8px 12px;
  }
  .pet-chip .emoji { font-size: 22px; }
  .pet-chip small { display: block; color: #8a8172; }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .date-nav {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .date-nav button, .today {
    font: inherit;
    border: 1px solid #d5cfc2;
    background: #fff;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .date-nav input {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid #d5cfc2;
    border-radius: 8px;
  }
  .status {
    display: flex;
    gap: 14px;
    align-items: center;
    font-size: 14px;
  }
  .status .alert { color: #b26a00; font-weight: 600; }
  .filter {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #5b5548;
  }

  .tasks {
    display: grid;
    gap: 10px;
  }
  .empty { color: #8a8172; }

  .log {
    background: #fff;
    border: 1px solid #e3e0da;
    border-radius: 12px;
    padding: 16px;
  }
  .log-head {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }
  .log-head h2 { margin: 0; font-size: 18px; }
  .log-actions {
    display: flex;
    gap: 8px;
  }
  .log-actions button {
    font: inherit;
    font-size: 13px;
    border: 1px solid #2f6427;
    color: #2f6427;
    background: #fff;
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
  }
  .log-actions .danger {
    border-color: #c9c2b2;
    color: #8a8172;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 13px;
  }
  th, td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid #eee9df;
  }
  th { color: #8a8172; font-weight: 600; }
  .t-time { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .t-note { color: #6b6355; }
  tr.dup { background: #fdf6e3; }
  .dup-tag {
    font-size: 12px;
    background: #f8e3b0;
    color: #8a5a00;
    border-radius: 999px;
    padding: 1px 8px;
    margin-left: 6px;
  }
  .more { color: #8a8172; font-size: 13px; }
</style>
