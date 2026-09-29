<script lang="ts">
  import { CATEGORY_META, formatDateTime } from '../lib/logic';
  import type { CareTask, CompletionRecord, Pet } from '../lib/types';

  interface Props {
    records: CompletionRecord[];
    tasks: CareTask[];
    pets: Pet[];
    scope: 'day' | 'all';
    onScopeChange: (scope: 'day' | 'all') => void;
    onExportJson: () => void;
    onExportCsv: () => void;
  }
  let { records, tasks, pets, scope, onScopeChange, onExportJson, onExportCsv }: Props = $props();

  const taskById = $derived(new Map(tasks.map((t) => [t.id, t])));
  const petById = $derived(new Map(pets.map((p) => [p.id, p])));
</script>

<section class="log">
  <div class="log-header">
    <h2>交接记录</h2>
    <div class="log-controls">
      <div class="scope" role="group" aria-label="记录范围">
        <button class:active={scope === 'day'} onclick={() => onScopeChange('day')}>当日</button>
        <button class:active={scope === 'all'} onclick={() => onScopeChange('all')}>全部</button>
      </div>
      <button class="btn ghost" onclick={onExportCsv} disabled={records.length === 0}>导出 CSV</button>
      <button class="btn ghost" onclick={onExportJson} disabled={records.length === 0}>导出 JSON</button>
    </div>
  </div>

  {#if records.length === 0}
    <p class="empty">当前范围内还没有交接记录。</p>
  {:else}
    <ul class="log-list">
      {#each records as r (r.id)}
        {@const task = taskById.get(r.taskId)}
        {@const pet = task ? petById.get(task.petId) : undefined}
        <li class:duplicate={r.duplicate}>
          <span class="log-time">{formatDateTime(r.completedAt)}</span>
          <span class="log-what">
            {#if task}
              {pet?.avatar} {pet?.name} · {CATEGORY_META[task.category].icon} {task.title}
              <span class="log-plan">（计划 {task.date} {task.time}）</span>
            {:else}
              （事项已删除）
            {/if}
          </span>
          <span class="log-by">{r.completedBy}</span>
          {#if r.note}<span class="log-note">“{r.note}”</span>{/if}
          {#if r.duplicate}<span class="dup-badge">重复确认</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
