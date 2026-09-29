<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { computeTodos, todayStr, type TodoItem } from '../lib/care';
  import { CARE_LABELS } from '../lib/types';

  let { onOpenPlant }: { onOpenPlant: (id: string) => void } = $props();

  const today = todayStr();
  const todos = $derived(computeTodos(store.plants, store.events, store.postponements, today));
  const due = $derived(todos.filter((t) => t.status !== 'upcoming'));
  const upcoming = $derived(todos.filter((t) => t.status === 'upcoming' && t.daysUntil <= 7));

  function statusText(t: TodoItem): string {
    if (t.status === 'overdue') return `已逾期 ${-t.daysUntil} 天`;
    if (t.status === 'today') return '今天到期';
    return `${t.daysUntil} 天后`;
  }
</script>

<section class="panel">
  <h2>🔔 本地提醒</h2>
  {#if due.length === 0}
    <p class="ok">今天没有到期或逾期的养护任务 🎉</p>
  {:else}
    <ul>
      {#each due as t (t.plantId + t.type)}
        <li>
          <button class="name" onclick={() => onOpenPlant(t.plantId)}>
            {t.plantIcon} {t.plantName}
          </button>
          <span class="task">{CARE_LABELS[t.type]}</span>
          <span class="badge" class:warn={t.status === 'overdue'}>{statusText(t)}</span>
          {#if t.postponedDays > 0}
            <span class="badge gray">已顺延 {t.postponedDays} 天（未完成）</span>
          {/if}
          <span class="actions">
            {#if t.type === 'water'}
              <button class="small primary" onclick={() => store.addEvent(t.plantId, 'water', today)}>浇水完成</button>
              <button class="small" onclick={() => store.postpone(t.plantId, 1, '连续阴雨')}>阴雨顺延 1 天</button>
            {:else}
              <button class="small primary" onclick={() => store.addEvent(t.plantId, 'fertilize', today)}>施肥完成</button>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if upcoming.length > 0}
    <h3>未来 7 天</h3>
    <ul class="upcoming">
      {#each upcoming as t (t.plantId + t.type)}
        <li>
          <button class="name" onclick={() => onOpenPlant(t.plantId)}>
            {t.plantIcon} {t.plantName}
          </button>
          <span class="task">{CARE_LABELS[t.type]}</span>
          <span class="muted">{t.dueDate} · {statusText(t)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 16px 20px;
  }
  h2 { font-size: 17px; margin: 0 0 10px; }
  h3 { font-size: 14px; color: var(--muted); margin: 16px 0 6px; }
  .ok { color: var(--accent); margin: 4px 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 8px 0;
    border-top: 1px dashed var(--line);
  }
  li:first-child { border-top: none; }
  .name {
    border: none;
    background: none;
    padding: 0;
    font-weight: 600;
  }
  .task { color: var(--muted); font-size: 14px; }
  .actions { margin-left: auto; display: flex; gap: 8px; }
  .muted { color: var(--muted); font-size: 13px; }
  .upcoming .name { font-weight: 400; }
</style>
