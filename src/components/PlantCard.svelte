<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { waterDueDate, diffDays, todayStr } from '../lib/care';
  import { LIGHT_LABELS, type Plant } from '../lib/types';

  let { plant, onOpen, onEdit }: { plant: Plant; onOpen: () => void; onEdit: () => void } = $props();

  const today = todayStr();
  const due = $derived(waterDueDate(plant, store.events, store.postponements));
  const days = $derived(diffDays(due, today));
  const waterText = $derived(
    days < 0 ? `浇水已逾期 ${-days} 天` : days === 0 ? '今天该浇水了' : `${days} 天后浇水`
  );
</script>

<article class="card">
  <button class="photo" onclick={onOpen} title="照片占位，点击查看详情">
    <span>{plant.icon}</span>
  </button>
  <div class="info">
    <button class="name" onclick={onOpen}>{plant.name}</button>
    <div class="species">{plant.species || '未填写品种'}</div>
    <div class="meta">
      <span class="badge gray">{LIGHT_LABELS[plant.light]}</span>
      <span class="badge gray">每 {plant.waterIntervalDays} 天浇水</span>
    </div>
    <div class="due" class:late={days < 0} class:now={days === 0}>{waterText}（{due}）</div>
  </div>
  <div class="ops">
    <button class="small" onclick={onEdit}>编辑</button>
  </div>
</article>

<style>
  .card {
    display: flex;
    gap: 14px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px;
    align-items: flex-start;
  }
  .photo {
    width: 64px;
    height: 64px;
    flex: none;
    border-radius: 12px;
    border: 1px dashed var(--accent);
    background: linear-gradient(135deg, #e8f3ea, #d3e8d8);
    font-size: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .info { flex: 1; min-width: 0; }
  .name {
    border: none;
    background: none;
    padding: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .species { color: var(--muted); font-size: 12px; margin: 2px 0 8px; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .due { font-size: 13px; color: var(--accent); }
  .due.late { color: var(--warn); font-weight: 600; }
  .due.now { color: var(--accent); font-weight: 600; }
</style>
